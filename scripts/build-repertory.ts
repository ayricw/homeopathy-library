// Build the repertory data file from an OOREP database dump.
//
//   npm run build:repertory -- <oorep.sql.gz> library/repertories/publicum.json
//
// Writes public/data/repertory.json, which Vite copies into the app at build time. The file is served
// behind Cloudflare Access like every other path, and the Symptoms page searches it in the browser,
// so the repertory uses no database rows. Like the books, the dump and the file stay out of Git.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname } from "node:path";
import { gunzipSync } from "node:zlib";
import { parseOorep, repertoryFile, type RepertoryMeta } from "../shared/oorep";

const args = process.argv.slice(2);
const outIdx = args.indexOf("--out");
const out = outIdx >= 0 ? args.splice(outIdx, 2)[1] : "public/data/repertory.json";
const [dumpPath, metaPath] = args;
if (!dumpPath || !metaPath) {
  console.error("Usage: npm run build:repertory -- <oorep.sql.gz> <library/repertories/<id>.json> [--out FILE]");
  process.exit(2);
}

const bytes = readFileSync(dumpPath);
const sha256 = createHash("sha256").update(bytes).digest("hex");
const dump = (dumpPath.endsWith(".gz") ? gunzipSync(bytes) : bytes).toString("utf8");
const meta = JSON.parse(readFileSync(metaPath, "utf8")) as RepertoryMeta;
const parsed = parseOorep(dump, meta.oorep_abbrev);
if (!parsed.rubrics.length) {
  console.error(`No rubrics for "${meta.oorep_abbrev}" in ${dumpPath}.`);
  process.exit(1);
}
const file = repertoryFile(meta, parsed, { name: basename(dumpPath), sha256 });
mkdirSync(dirname(out), { recursive: true });
const json = JSON.stringify(file);
writeFileSync(out, json);
console.log(
  `${meta.title}: ${file.rubrics.length} rubrics with remedies, ${parsed.entries.length} entries, ${file.remedies.length} remedies.\n` +
    `Wrote ${out} (${(json.length / 1e6).toFixed(1)} MB). Deploy to publish it: npm run deploy:dev`,
);
