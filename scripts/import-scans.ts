// Scanned books from the Internet Archive: build their text with page markers, then preview or import them.
//
//   npm run scans -- preview [source-id ...]   build the text, print hashes and a sample (no server needed)
//   npm run scans -- import  [source-id ...]   build and import into LIBRARY_URL
//
// The books are the library/sources/*.json files that have a "scan" entry:
//   "scan": { "archive_id": "<Internet Archive identifier>",
//             "sha256": { "searchtext": "...", "pageindex": "...", "page_numbers": "..." } }
// Importing requires the pinned hashes, so a changed file on the Internet Archive stops the import
// instead of silently changing the text; preview prints the hashes to pin.
// A deployed library needs a Cloudflare Access service token in CF_ACCESS_CLIENT_ID and
// CF_ACCESS_CLIENT_SECRET (DEPLOY.md). Normally this runs from the "Import books" GitHub workflow.
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { importText } from "../shared/importer";
import { buildScanText, OCR_CONVERTER_VERSION } from "../shared/ocr";
import { splitPassages } from "../shared/text";

const FILES = {
  searchtext: (id: string) => `${id}_hocr_searchtext.txt.gz`,
  pageindex: (id: string) => `${id}_hocr_pageindex.json.gz`,
  page_numbers: (id: string) => `${id}_page_numbers.json`,
} as const;
type FileKey = keyof typeof FILES;

interface ScanSource {
  id: string;
  title: string;
  notes?: string | null;
  scan: { archive_id: string; sha256?: Partial<Record<FileKey, string>> };
  [key: string]: unknown;
}

async function loadSources(only: string[]): Promise<ScanSource[]> {
  const dir = new URL("../library/sources/", import.meta.url);
  const all: ScanSource[] = [];
  for (const f of (await readdir(dir)).sort()) {
    if (!f.endsWith(".json")) continue;
    const meta = JSON.parse(await readFile(new URL(f, dir), "utf8"));
    if (meta.scan) all.push(meta);
  }
  const unknown = only.filter((id) => !all.some((s) => s.id === id));
  if (unknown.length) throw new Error(`No scanned book with id: ${unknown.join(", ")}`);
  return only.length ? all.filter((s) => only.includes(s.id)) : all;
}

async function download(archiveId: string, key: FileKey) {
  const name = FILES[key](archiveId);
  const url = `https://archive.org/download/${archiveId}/${name}`;
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${url} -> ${res.status}`);
      const bytes = new Uint8Array(await res.arrayBuffer());
      return { name, url, bytes, sha256: createHash("sha256").update(bytes).digest("hex") };
    } catch (err) {
      if (attempt >= 6) throw err;
      await new Promise((r) => setTimeout(r, Math.min(2000 * 2 ** attempt, 30000)));
    }
  }
}

async function build(source: ScanSource, requirePinned: boolean) {
  const id = source.scan.archive_id;
  const files = {} as Record<FileKey, Awaited<ReturnType<typeof download>>>;
  const mismatched: string[] = [];
  for (const key of Object.keys(FILES) as FileKey[]) {
    const f = (files[key] = await download(id, key));
    const pinned = source.scan.sha256?.[key];
    if (pinned && pinned !== f.sha256) mismatched.push(`${f.name}: expected ${pinned}, got ${f.sha256}`);
    if (!pinned && requirePinned) mismatched.push(`${f.name}: no pinned sha256 (got ${f.sha256})`);
  }
  if (mismatched.length) throw new Error(`File check failed for ${source.id}:\n  ${mismatched.join("\n  ")}`);

  const searchtext = new TextDecoder("utf-8", { fatal: true }).decode(gunzipSync(files.searchtext.bytes));
  const pageindex = JSON.parse(gunzipSync(files.pageindex.bytes).toString("utf8"));
  const pageNumbers = JSON.parse(new TextDecoder().decode(files.page_numbers.bytes));
  const scan = buildScanText(searchtext, pageindex, pageNumbers);

  const provenance =
    `Text built by ${OCR_CONVERTER_VERSION} from the Internet Archive's OCR of item ${id} ` +
    `(https://archive.org/details/${id}): ` +
    Object.values(files)
      .map((f) => `${f.name} sha256 ${f.sha256}`)
      .join("; ") +
    ". Page numbers are those Internet Archive read from the printed pages; the OCR text is not proofread.";
  const { scan: _scan, ...metadata } = source;
  metadata.notes = [source.notes, provenance].filter(Boolean).join(" ");

  const bytes = new TextEncoder().encode(scan.text);
  const name = `${source.id}.ocr.txt`;
  await mkdir(new URL("../library/originals/", import.meta.url), { recursive: true });
  await writeFile(new URL(`../library/originals/${name}`, import.meta.url), bytes);
  return { scan, metadata, bytes, name, files };
}

function preview(source: ScanSource, built: Awaited<ReturnType<typeof build>>) {
  const { scan, files, bytes, name } = built;
  const split = splitPassages(scan.text);
  const pages = split.passages.flatMap((p) => [p.pageStart, p.pageEnd]).filter((p): p is string => p !== null);
  const sections = [...new Set(split.passages.map((p) => p.section).filter(Boolean))];
  console.log(`\n=== ${source.id}: ${source.title}`);
  console.log(`Internet Archive item: https://archive.org/details/${source.scan.archive_id}`);
  console.log(`Pin these in "scan.sha256":`);
  console.log(JSON.stringify(Object.fromEntries(Object.entries(files).map(([k, f]) => [k, f.sha256])), null, 2));
  console.log(`Text: library/originals/${name}, ${bytes.length} bytes`);
  console.log(`Leaves: ${JSON.stringify(scan.stats)}`);
  console.log(`Passages: ${split.passages.length}; pages ${pages[0] ?? "none"} to ${pages[pages.length - 1] ?? "none"}`);
  console.log(`Headings: ${sections.length}. First 40: ${sections.slice(0, 40).join(" | ")}`);
  for (const i of [...scan.issues, ...split.issues]) console.log(`  [${i.severity}] ${i.kind}: ${i.detail}`);
  console.log(`--- Start of text (title page and front matter):\n${scan.text.slice(0, 3000)}\n--- End of sample`);
}

async function alreadyImported(server: string, init: RequestInit): Promise<Map<string, string | null>> {
  const res = await fetch(`${server}/api/sources`, init);
  if (!res.ok) throw new Error(`GET /api/sources -> ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const { sources } = (await res.json()) as { sources: { id: string; import_status: string | null }[] };
  return new Map(sources.map((s) => [s.id, s.import_status]));
}

async function main() {
  const [mode, ...only] = process.argv.slice(2);
  if (mode !== "preview" && mode !== "import") {
    console.error("Usage: npm run scans -- preview|import [source-id ...]");
    process.exit(2);
  }
  const sources = await loadSources(only);
  if (!sources.length) console.log("No scanned books are listed in library/sources.");

  if (mode === "preview") {
    let failed = 0;
    for (const s of sources) {
      try {
        preview(s, await build(s, false));
      } catch (err) {
        failed++;
        console.error(`\n=== ${s.id}: preview failed: ${err instanceof Error ? `${err.message} ${(err as { cause?: unknown }).cause ?? ""}` : err}`);
      }
    }
    if (failed) process.exit(1);
    return;
  }

  const server = (process.env.LIBRARY_URL ?? "http://localhost:5173").replace(/\/+$/, "");
  const headers: Record<string, string> = {};
  if (process.env.CF_ACCESS_CLIENT_ID && process.env.CF_ACCESS_CLIENT_SECRET) {
    headers["CF-Access-Client-Id"] = process.env.CF_ACCESS_CLIENT_ID;
    headers["CF-Access-Client-Secret"] = process.env.CF_ACCESS_CLIENT_SECRET;
  }
  const init: RequestInit = { headers };
  const existing = await alreadyImported(server, init);
  let failed = 0;
  for (const s of sources) {
    if (existing.get(s.id) === "complete") {
      console.log(`${s.id}: already imported, skipped.`);
      continue;
    }
    console.log(`${s.id}: building text from ${s.scan.archive_id}`);
    const built = await build(s, true);
    const outcome = await importText(
      server,
      { bytes: built.bytes, name: built.name },
      built.metadata,
      {
        log: (m) => console.log(`  ${m}`),
        issues: (issues) => issues.forEach((i) => console.log(`  [${i.severity}] ${i.kind}: ${i.detail}`)),
        progress: (done, total) => {
          if (done === total || done % 1000 === 0) console.log(`  ${done}/${total} passages`);
        },
      },
      init,
      built.scan.issues,
    );
    if (outcome.kind === "failed") {
      failed++;
      console.error(`${s.id}: import failed: ${outcome.error}`);
    } else if (outcome.kind === "duplicate") console.log(`${s.id}: this exact text is already imported as "${outcome.sourceId}".`);
    else console.log(`${s.id}: imported, ${outcome.passages} passages.`);
  }
  if (failed) process.exit(1);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
