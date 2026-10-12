// End-to-end check of import, duplicate detection, resume, search and source
// references against a real local Worker with local D1 and R2.
// Uses its own throwaway state in .wrangler/smoke, so your library is untouched.
//
//   npm run smoke
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { readFileSync, rmSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PARSER_VERSION, splitPassages } from "../shared/text";

const PORT = 5199;
const BASE = `http://localhost:${PORT}`;
const STATE = ".wrangler/smoke";
const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const fixture = (name: string) => join("tests", "fixtures", name);

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || detail === undefined ? "" : `\n      ${JSON.stringify(detail)}`}`);
  if (!ok) failures++;
}

// Test helper: response bodies are loosely typed on purpose.
async function api(path: string, init?: RequestInit): Promise<{ status: number; body: any }> {
  const res = await fetch(BASE + path, init);
  return { status: res.status, body: await res.json().catch(() => null) };
}

function runImport(file: string, meta: string) {
  const r = spawnSync(npx, ["tsx", "scripts/import.ts", file, meta, "--server", BASE], { encoding: "utf8", shell: process.platform === "win32" });
  return { code: r.status, out: (r.stdout ?? "") + (r.stderr ?? "") };
}

function metaFile(dir: string, id: string, extra: Record<string, unknown> = {}) {
  const path = join(dir, `${id}.json`);
  writeFileSync(
    path,
    JSON.stringify({
      id,
      title: `Test book ${id}`,
      author: extra.author ?? "Test Author",
      edition: null,
      publication_year: null,
      source_url: "https://example.org/test",
      attribution: "Synthetic test data",
      reuse_terms: "Test data, no restrictions",
      ...extra,
    }),
  );
  return path;
}

async function waitForServer(proc: ChildProcess) {
  for (let i = 0; i < 120; i++) {
    if (proc.exitCode !== null) throw new Error("Dev server exited early");
    try {
      const r = await fetch(`${BASE}/api/sources`);
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Dev server did not start");
}

async function main() {
  rmSync(STATE, { recursive: true, force: true });
  const mig = spawnSync(npx, ["wrangler", "d1", "migrations", "apply", "DB", "--local", "--persist-to", STATE], {
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  if (mig.status !== 0) throw new Error(`Migrations failed:\n${mig.stdout}${mig.stderr}`);

  const server = spawn(npx, ["vite", "dev", "--port", String(PORT), "--strictPort"], {
    env: { ...process.env, LIBRARY_PERSIST: STATE },
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32",
  });
  let log = "";
  server.stdout!.on("data", (d) => (log += d));
  server.stderr!.on("data", (d) => (log += d));
  try {
    await waitForServer(server);
    await checks();
  } catch (e) {
    failures++;
    console.error(e, "\n--- server log ---\n", log.slice(-3000));
  } finally {
    server.kill();
  }
  console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
  process.exit(failures ? 1 : 0);
}

async function checks() {
  const tmp = mkdtempSync(join(tmpdir(), "hl-smoke-"));
  const bookPath = fixture("sample-gutenberg.txt");
  const book = readFileSync(bookPath, "utf8");
  const bookMeta = metaFile(tmp, "test-gutenberg", { author: "Author A", edition: "First edition" });

  // 1. Import a complete text file
  let r = runImport(bookPath, bookMeta);
  check("import completes", r.code === 0 && /Done:/.test(r.out), r.out);
  const expected = splitPassages(book).passages.length;

  // 2. Source metadata
  const src = await api("/api/sources/test-gutenberg");
  check("source metadata stored", src.body?.source?.title === "Test book test-gutenberg" && src.body.source.edition === "First edition", src.body);
  check("all passages stored", src.body?.source?.passage_count === expected, { got: src.body?.source?.passage_count, expected });
  check("import marked complete", src.body?.imports?.[0]?.status === "complete", src.body?.imports);
  check("missing page markers recorded as a note", src.body?.issues?.some((i: { detail: string }) => /no page markers/.test(i.detail)), src.body?.issues);

  const orig = await fetch(`${BASE}/api/sources/test-gutenberg/original`).then((x) => x.text());
  check("original file preserved byte-for-byte", orig === book);

  // Duplicate detection
  r = runImport(bookPath, bookMeta);
  check("re-importing the same file is detected as a duplicate", r.code === 0 && /Duplicate file/.test(r.out), r.out);
  const again = await api("/api/sources/test-gutenberg");
  check("duplicate import adds no passages", again.body?.source?.passage_count === expected);

  // Same id, different file is refused
  r = runImport(fixture("sample-paged.txt"), bookMeta);
  check("different file under an existing id is refused", r.code !== 0 && /409/.test(r.out), r.out);

  // Resumable import: send one batch by hand, then let the CLI finish
  const pagedPath = fixture("sample-paged.txt");
  const paged = readFileSync(pagedPath, "utf8");
  const pagedMeta = metaFile(tmp, "test-paged", { author: "Author B" });
  const form = new FormData();
  form.set("file", new Blob([paged]), "sample-paged.txt");
  form.set("metadata", readFileSync(pagedMeta, "utf8"));
  const created = await api("/api/imports", { method: "POST", body: form });
  const split = splitPassages(paged);
  const post = (body: unknown) =>
    api(`/api/imports/${created.body.import.id}/passages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  const tampered = { ...split.passages[0], text: split.passages[0].text + " (altered)" };
  const bad = await post({ parserVersion: PARSER_VERSION, total: split.passages.length, start: 0, passages: [tampered] });
  check("passage that does not match the stored text is rejected", bad.status === 400, bad);
  await post({ parserVersion: PARSER_VERSION, total: split.passages.length, start: 0, passages: split.passages.slice(0, 1), issues: split.issues });
  r = runImport(pagedPath, pagedMeta);
  check("interrupted import resumes", r.code === 0 && /Resuming at passage 1/.test(r.out) && /Done:/.test(r.out), r.out);
  const pagedSrc = await api("/api/sources/test-paged");
  check("resumed import has every passage exactly once", pagedSrc.body?.source?.passage_count === split.passages.length, pagedSrc.body?.source);

  // Extraction failure recorded
  const latin1 = join(tmp, "latin1.txt");
  writeFileSync(latin1, Buffer.from([0x63, 0x61, 0x66, 0xe9, 0x0a]));
  r = runImport(latin1, metaFile(tmp, "test-latin1"));
  const failed = await api("/api/sources/test-latin1");
  check(
    "non-UTF-8 file is recorded as an extraction failure",
    r.code !== 0 && failed.body?.imports?.[0]?.status === "failed" && failed.body.issues.some((i: { kind: string }) => i.kind === "extraction_failure"),
    { out: r.out, body: failed.body },
  );

  // 3. Search
  let s = await api("/api/search?q=quillwort");
  check("keyword search finds a word", s.body?.total === 1 && s.body.results[0].section === "ALPHA EXAMPLE.", s.body);
  check("snippet highlights the match", /\u0002quillwort\u0003/i.test(s.body?.results?.[0]?.snippet ?? ""), s.body?.results?.[0]?.snippet);
  s = await api(`/api/search?q=${encodeURIComponent('"burning sensation"')}`);
  check("phrase search finds both sections", s.body?.total === 2, s.body);
  s = await api(`/api/search?q=${encodeURIComponent('"sensation burning"')}`);
  check("phrase search respects word order", s.body?.total === 0, s.body);
  s = await api("/api/search?q=cafe");
  check("accent-insensitive search (cafe finds café)", s.body?.total === 1, s.body);
  s = await api("/api/search?q=quill*");
  check("prefix search", s.body?.total === 1, s.body);
  s = await api(`/api/search?q=${encodeURIComponent("NEAR( OR \"")}`);
  check("FTS operators in user input do not break search", s.status === 200, s);
  s = await api("/api/search?q=license+boilerplate");
  check("Gutenberg boilerplate is not searchable", s.body?.total === 0, s.body);

  // Filters
  s = await api("/api/search?q=page&source=test-gutenberg");
  check("source filter", s.body?.results.every((x: { source_id: string }) => x.source_id === "test-gutenberg"), s.body);
  s = await api("/api/search?q=page&author=Author+B");
  check("author filter", s.body?.total > 0 && s.body.results.every((x: { author: string }) => x.author === "Author B"), s.body);
  s = await api("/api/search?q=burning&edition=First+edition");
  check("edition filter", s.body?.total === 2, s.body);
  s = await api("/api/search?q=burning&edition=Second+edition");
  check("edition filter excludes other editions", s.body?.total === 0, s.body);

  // 4. Open a result with context and references
  s = await api(`/api/search?q=${encodeURIComponent('"throbbing headache"')}`);
  const hit = s.body.results[0];
  const p = await api(`/api/passages/${hit.id}?context=2`);
  const pass = p.body?.passage;
  check("passage text matches the original at its offsets", book.slice(pass.char_start, pass.char_end) === pass.text);
  const lines = book.split("\n");
  check("line references match the original", pass.text.startsWith(lines[pass.line_start - 1]) && pass.text.endsWith(lines[pass.line_end - 1]));
  check("surrounding context is returned", p.body?.before?.length > 0, p.body);
  check("context is in reading order", p.body.before.every((b: { ordinal: number }) => b.ordinal < pass.ordinal));
  check("no page number is invented", pass.page_start === null && pass.page_end === null, pass);
  check("source link is included", p.body?.source?.source_url === "https://example.org/test");

  s = await api(`/api/search?q=${encodeURIComponent('"third page starts"')}`);
  check("page markers produce page references", s.body?.results?.[0]?.page_start === "1" && s.body.results[0].page_end === "3", s.body?.results?.[0]);
  check("chapter references are kept", s.body?.results?.[0]?.chapter === "CHAPTER I. ON TESTING", s.body?.results?.[0]);

  // Front end is served
  const html = await fetch(`${BASE}/`).then((x) => x.text());
  check("web page is served", /<div id="root">/.test(html));
  rmSync(tmp, { recursive: true, force: true });
}

main();
