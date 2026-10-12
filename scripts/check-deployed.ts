// Checks a deployed environment without needing an Access login:
//   1. The website, API and original files are not reachable without signing in.
//   2. The remote D1 database has the schema, and every import is complete and consistent.
//   3. Stored passages match the original extracted text in R2 at their offsets,
//      and the original file in R2 still matches its recorded SHA-256.
//
//   npm run check:deployed -- --env dev --url https://homeopathy-library-dev.<subdomain>.workers.dev
//
// Uses your `wrangler login` session; it never prints secrets.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

const args = process.argv.slice(2);
const opt = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const env = opt("env") ?? "dev";
const url = opt("url")?.replace(/\/+$/, "");
// --local runs the database and file checks against local state (for testing this script).
const local = args.includes("--local");
const where = local ? "--local" : "--remote";
const bucket = local ? "homeopathy-library-local" : `homeopathy-library-${env === "production" ? "prod" : env}`;
if (!url && !local) {
  console.error("Usage: npm run check:deployed -- --env dev --url https://...workers.dev");
  process.exit(2);
}

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || detail === undefined ? "" : `\n      ${JSON.stringify(detail)}`}`);
  if (!ok) failures++;
}

const isWin = process.platform === "win32";
function wrangler(argv: string[], binary = false) {
  // With shell: true (needed for npx.cmd on Windows) arguments are joined unquoted, so quote any with spaces.
  const quoted = isWin ? argv.map((a) => (/[\s"]/.test(a) ? `"${a.replace(/"/g, '""')}"` : a)) : argv;
  const r = spawnSync(isWin ? "npx.cmd" : "npx", ["wrangler", ...quoted], {
    encoding: binary ? "buffer" : "utf8",
    shell: isWin,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (r.status !== 0) throw new Error(`wrangler ${argv.slice(0, 3).join(" ")} failed:\n${r.stderr}`);
  return r.stdout;
}

// Small identifiers only are interpolated, and they come from our own database.
function sql<T = Record<string, unknown>>(query: string): T[] {
  const out = wrangler(["d1", "execute", "DB", ...(local ? [] : ["--env", env]), where, "--json", "--command", query]) as string;
  const parsed = JSON.parse(out.slice(out.indexOf("[")));
  return parsed[0].results as T[];
}

function r2(key: string): Buffer {
  return wrangler(["r2", "object", "get", `${bucket}/${key}`, where, "--pipe"], true) as Buffer;
}

async function main() {
  // 1. Nothing is reachable without Access.
  if (!local) for (const path of ["/", "/api/sources", "/api/search?q=cough", "/api/sources/anshutz-1900-new-old-forgotten-remedies/original", "/assets/"]) {
    const res = await fetch(url + path, { redirect: "manual" });
    const location = res.headers.get("location") ?? "";
    const blocked = (res.status >= 300 && res.status < 400 && /cloudflareaccess\.com/.test(location)) || res.status === 401 || res.status === 403;
    check(`${path} requires sign-in (got ${res.status}${location ? ` → ${new URL(location).host}` : ""})`, blocked);
  }
  if (!local) {
    const forged = await fetch(`${url}/api/sources`, { redirect: "manual", headers: { "cf-access-jwt-assertion": "forged.token.value" } });
    check("a forged Access token is refused", forged.status !== 200, forged.status);
  }

  // 2. Database state.
  const tables = sql<{ name: string }>("SELECT name FROM sqlite_master WHERE type IN ('table') ORDER BY name").map((t) => t.name);
  for (const t of ["sources", "imports", "import_issues", "passages", "passage_corrections", "passages_fts"]) {
    check(`table ${t} exists`, tables.includes(t), tables);
  }
  const sources = sql<{ id: string; sha256: string; original_r2_key: string; extracted_r2_key: string | null; title: string }>(
    "SELECT id, sha256, original_r2_key, extracted_r2_key, title FROM sources",
  );
  console.log(`      ${sources.length} source(s) in ${env}`);
  for (const s of sources) {
    const [imp] = sql<{ status: string; total_passages: number; processed_passages: number }>(
      `SELECT status, total_passages, processed_passages FROM imports WHERE source_id = '${s.id.replace(/'/g, "")}' ORDER BY created_at DESC LIMIT 1`,
    );
    if (imp?.status === "failed") {
      check(`${s.id}: failed import is recorded with an issue`, sql(`SELECT 1 FROM import_issues ii JOIN imports i ON i.id = ii.import_id WHERE i.source_id = '${s.id}'`).length > 0);
      continue;
    }
    check(`${s.id}: import complete`, imp?.status === "complete", imp);
    const [{ n }] = sql<{ n: number }>(`SELECT COUNT(*) AS n FROM passages WHERE source_id = '${s.id}'`);
    check(`${s.id}: ${n} passages stored, matching the import`, n === imp?.total_passages, { n, imp });
    const [{ gaps }] = sql<{ gaps: number }>(
      `SELECT COUNT(*) - (MAX(ordinal) - MIN(ordinal) + 1) AS gaps FROM passages WHERE source_id = '${s.id}'`,
    );
    check(`${s.id}: passages are contiguous`, gaps === 0, gaps);

    // 3. Files and references.
    const original = r2(s.original_r2_key);
    check(`${s.id}: original file matches its SHA-256`, createHash("sha256").update(original).digest("hex") === s.sha256);
    if (!s.extracted_r2_key) continue;
    const text = r2(s.extracted_r2_key).toString("utf8");
    const sample = sql<{ ordinal: number; char_start: number; char_end: number; text: string; page_start: string | null }>(
      `SELECT ordinal, char_start, char_end, text, page_start FROM passages WHERE source_id = '${s.id}' AND (ordinal % 25 = 0 OR ordinal = (SELECT MAX(ordinal) FROM passages WHERE source_id = '${s.id}'))`,
    );
    const mismatched = sample.filter((p) => text.slice(p.char_start, p.char_end) !== p.text).map((p) => p.ordinal);
    check(`${s.id}: ${sample.length} sampled passages match the stored text at their offsets`, mismatched.length === 0, mismatched);
    if (!/\[(?:Pg|Page|p\.)\s*[0-9ivxlcdm]+\]/i.test(text)) {
      check(`${s.id}: no page numbers recorded for a text without page markers`, sample.every((p) => p.page_start === null));
    }
  }

  // Keyword index answers queries.
  const [{ n: indexed }] = sql<{ n: number }>("SELECT COUNT(*) AS n FROM passages_fts");
  const [{ n: total }] = sql<{ n: number }>("SELECT COUNT(*) AS n FROM passages");
  check(`keyword index covers all ${total} passages`, indexed === total, { indexed, total });
  if (total > 0) {
    const hits = sql<{ n: number }>(`SELECT COUNT(*) AS n FROM passages_fts WHERE passages_fts MATCH '"cough"'`);
    check(`keyword search works in the remote database ("cough": ${hits[0].n} passages)`, hits[0].n > 0);
  }

  console.log(failures ? `\n${failures} check(s) failed` : "\nAll deployed checks passed");
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
