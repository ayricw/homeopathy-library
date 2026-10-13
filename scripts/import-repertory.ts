// Load one repertory from an OOREP database dump into D1.
//
//   npm run import:repertory -- <oorep.sql.gz> <library/repertories/<id>.json> --env dev
//   npm run import:repertory -- <oorep.sql.gz> <meta.json> --local [--persist-to DIR]
//
// Writes the generated SQL to .wrangler/repertory-<id>-NN.sql (parts of a few MB, which local D1 needs),
// then runs `wrangler d1 execute` on each part in order.
// Every insert uses fixed ids and OR IGNORE, so running it again is safe and finishes an interrupted run.
// Add --sql-only to write the file without running wrangler.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { gunzipSync } from "node:zlib";
import { parseOorep, repertorySql, type RepertoryMeta } from "../shared/oorep";

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args.splice(i, 1).length > 0 : false;
};
const option = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args.splice(i, 2)[1] : undefined;
};
const sqlOnly = flag("--sql-only");
const local = flag("--local");
const env = option("--env");
const persistTo = option("--persist-to");
const [dumpPath, metaPath] = args;
if (!dumpPath || !metaPath || (!sqlOnly && !local && !env)) {
  console.error("Usage: npm run import:repertory -- <oorep.sql.gz> <meta.json> (--env dev | --local [--persist-to DIR] | --sql-only)");
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
console.log(`${meta.title}: ${parsed.rubrics.length} rubrics, ${parsed.entries.length} remedy entries, ${parsed.remedies.size} remedies.`);

mkdirSync(".wrangler", { recursive: true });
const PART_BYTES = 2_000_000;
const parts: string[][] = [[]];
let size = 0;
for (const stmt of repertorySql(meta, parsed, { name: basename(dumpPath), sha256 })) {
  if (size + stmt.length > PART_BYTES && parts[parts.length - 1].length) {
    parts.push([]);
    size = 0;
  }
  parts[parts.length - 1].push(stmt);
  size += stmt.length;
}
const files = parts.map((stmts, i) => {
  const file = `.wrangler/repertory-${meta.id}-${String(i + 1).padStart(2, "0")}.sql`;
  writeFileSync(file, stmts.join("\n") + "\n");
  return file;
});
console.log(`Wrote ${files.length} SQL files to .wrangler/`);
if (sqlOnly) process.exit(0);

const npx = process.platform === "win32" ? "npx.cmd" : "npx";
for (const [i, file] of files.entries()) {
  const wranglerArgs = ["wrangler", "d1", "execute", "DB", "--file", file, "--yes"];
  if (local) wranglerArgs.push("--local", ...(persistTo ? ["--persist-to", persistTo] : []));
  else wranglerArgs.push("--env", env!, "--remote");
  console.log(`Part ${i + 1}/${files.length}: npx ${wranglerArgs.join(" ")}`);
  const r = spawnSync(npx, wranglerArgs, { stdio: ["ignore", "pipe", "inherit"], shell: process.platform === "win32" });
  if (r.status !== 0) {
    console.error(`Part ${i + 1} failed. Fix the problem and run the same command again; finished parts are skipped by OR IGNORE.`);
    process.exit(r.status ?? 1);
  }
}
console.log(`Done: ${meta.title} loaded.`);
