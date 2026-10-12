// Import one UTF-8 text file into the library.
//
//   npm run import -- <book.txt> <metadata.json> [--server http://localhost:5173]
//
// Running the same command again after an interruption resumes the import;
// running it after completion reports a duplicate and changes nothing.
// For a deployed (Access-protected) library, use the Import page in the browser.
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { importText } from "../shared/importer";

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

  const outcome = await importText(server, { bytes, name: basename(filePath) }, metadata, {
    log: (m) => console.log(m),
    issues: (issues) => issues.forEach((i) => console.log(`  [${i.severity}] ${i.kind}: ${i.detail}`)),
    progress: (done, total) => process.stdout.write(`\r  ${done}/${total} passages`),
  });
  if (outcome.kind === "duplicate") {
    console.log(`Duplicate file: this exact file is already imported as "${outcome.sourceId}". Nothing changed.`);
  } else if (outcome.kind === "failed") {
    console.error(`Import failed: ${outcome.error}`);
    process.exit(1);
  } else {
    console.log(`\nDone: "${metadata.title}" imported with ${outcome.passages} passages.`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
