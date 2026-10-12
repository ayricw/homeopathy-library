// Import one UTF-8 text file into the library.
//
//   npm run import -- <book.txt> <metadata.json> [--server http://localhost:5173]
//
// Running the same command again after an interruption resumes the import;
// running it after completion reports a duplicate and changes nothing.
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { decodeUtf8, PARSER_VERSION, splitPassages } from "../shared/text";

const BATCH = 100;

async function main() {
  const args = process.argv.slice(2);
  const serverIdx = args.indexOf("--server");
  const server = (serverIdx >= 0 ? args.splice(serverIdx, 2)[1] : process.env.LIBRARY_URL) ?? "http://localhost:5173";
  const [filePath, metaPath] = args;
  if (!filePath || !metaPath) {
    console.error("Usage: npm run import -- <book.txt> <metadata.json> [--server URL]");
    process.exit(2);
  }

  const bytes = new Uint8Array(await readFile(filePath));
  const metadata = JSON.parse(await readFile(metaPath, "utf8"));

  const form = new FormData();
  form.set("file", new Blob([bytes], { type: "text/plain" }), basename(filePath));
  form.set("metadata", JSON.stringify(metadata));
  const created = await call(`${server}/api/imports`, { method: "POST", body: form });
  const imp = created.import;
  console.log(`${created.duplicate ? "Already uploaded" : "Uploaded"}: ${created.sourceId} (import ${imp.id}, status ${imp.status})`);

  if (imp.status === "complete") {
    console.log(`Duplicate file: this exact file is already imported as "${created.sourceId}". Nothing changed.`);
    return;
  }
  if (imp.status === "failed") {
    console.error(`Import failed earlier: ${imp.error}`);
    process.exit(1);
  }

  const decoded = decodeUtf8(bytes);
  if (!decoded.ok) throw new Error(decoded.error);
  const { passages, issues } = splitPassages(decoded.text!);
  for (const i of issues) console.log(`  [${i.severity}] ${i.kind}: ${i.detail}`);

  let start = imp.processed_passages as number;
  if (start > 0) console.log(`Resuming at passage ${start} of ${passages.length}`);
  while (start < passages.length) {
    const batch = passages.slice(start, start + BATCH);
    const status = await call(`${server}/api/imports/${imp.id}/passages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ parserVersion: PARSER_VERSION, total: passages.length, start, passages: batch, issues }),
    });
    start = status.processed_passages;
    process.stdout.write(`\r  ${start}/${passages.length} passages`);
  }
  console.log(`\nDone: "${metadata.title}" imported with ${passages.length} passages.`);
}

async function call(url: string, init: RequestInit): Promise<any> {
  const res = await fetch(url, init);
  const body: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${init.method} ${new URL(url).pathname} -> ${res.status}: ${body.error ?? res.statusText}`);
  return body;
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
