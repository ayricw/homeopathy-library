// Reads one repertory out of an OOREP PostgreSQL dump (the `COPY ... FROM stdin;` blocks) and turns it
// into the compact data file the Symptoms page loads. Pure and deterministic: the same dump gives the same file.

import type { RepertoryFile } from "./repertory";

export interface RepertoryMeta {
  id: string;
  oorep_abbrev: string;
  title: string;
  author: string;
  edition: string | null;
  publication_year: number | null;
  publisher: string | null;
  language: string | null;
  source_url: string;
  attribution: string;
  reuse_terms: string;
  notes: string | null;
}

export interface ParsedRepertory {
  remedies: Map<number, { abbrev: string; name: string }>;
  rubrics: { sourceId: number; chapter: string; path: string }[];
  entries: { rubric: number; remedy: number; grade: number }[];
}

/** Undoes PostgreSQL COPY text escaping. Returns null for \N. */
function field(raw: string): string | null {
  if (raw === "\\N") return null;
  return raw.replace(/\\(.)/g, (_, c: string) => ({ t: "\t", n: "\n", r: "\r", "\\": "\\" })[c] ?? c);
}

/** Yields [table, columns, row] for every data row in every COPY block. */
function* copyRows(dump: string): Generator<[string, string[], (string | null)[]]> {
  let table: string | null = null;
  let columns: string[] = [];
  for (const line of dump.split("\n")) {
    if (table === null) {
      const m = line.match(/^COPY public\.(\w+) \(([^)]*)\) FROM stdin;$/);
      if (m) {
        table = m[1];
        columns = m[2].split(",").map((c) => c.trim());
      }
      continue;
    }
    if (line === "\\.") {
      table = null;
      continue;
    }
    yield [table, columns, line.split("\t").map(field)];
  }
}

export function parseOorep(dump: string, abbrev: string): ParsedRepertory {
  const allRemedies = new Map<number, { abbrev: string; name: string }>();
  const rubrics: ParsedRepertory["rubrics"] = [];
  const entries: ParsedRepertory["entries"] = [];
  for (const [table, columns, row] of copyRows(dump)) {
    const get = (c: string) => row[columns.indexOf(c)];
    if (table === "remedy") {
      allRemedies.set(Number(get("id")), { abbrev: get("nameabbrev") ?? "", name: get("namelong") ?? "" });
    } else if (table === "rubric" && get("abbrev") === abbrev) {
      const path = (get("fullpath") ?? "").trim();
      const chapter = path.split(",")[0].trim();
      // OOREP's chapter headings are letters only ("Mind", "Heart & Circulation"); skip stray rows.
      if (path && /^\p{L}[\p{L} &]*$/u.test(chapter)) rubrics.push({ sourceId: Number(get("id")), chapter, path });
    } else if (table === "rubricremedy" && get("abbrev") === abbrev) {
      entries.push({ rubric: Number(get("rubricid")), remedy: Number(get("remedyid")), grade: Number(get("weight")) });
    }
  }
  const kept = new Set(rubrics.map((r) => r.sourceId));
  const used = entries.filter((e) => kept.has(e.rubric) && allRemedies.has(e.remedy) && e.grade >= 1 && e.grade <= 3);
  const remedies = new Map([...new Set(used.map((e) => e.remedy))].sort((a, b) => a - b).map((id) => [id, allRemedies.get(id)!]));
  return { remedies, rubrics, entries: used };
}

/** Builds the data file: remedies once, then each rubric with its remedies packed as remedyIndex * 4 + grade. */
export function repertoryFile(meta: RepertoryMeta, parsed: ParsedRepertory, file: { name: string; sha256: string }): RepertoryFile {
  const { oorep_abbrev: _, ...source } = meta;
  const remedyIds = [...parsed.remedies.keys()];
  const index = new Map(remedyIds.map((id, i) => [id, i]));
  const byRubric = new Map<number, Map<number, number>>();
  for (const e of parsed.entries) {
    const m = byRubric.get(e.rubric) ?? new Map<number, number>();
    m.set(index.get(e.remedy)!, e.grade); // a repeated rubric/remedy pair keeps the last grade
    byRubric.set(e.rubric, m);
  }
  return {
    format: 1,
    source: { ...source, original_filename: file.name, sha256: file.sha256 },
    remedies: remedyIds.map((id) => [parsed.remedies.get(id)!.abbrev, parsed.remedies.get(id)!.name]),
    rubrics: parsed.rubrics
      .filter((r) => byRubric.has(r.sourceId))
      .map((r) => [r.path, [...byRubric.get(r.sourceId)!].sort((a, b) => b[1] - a[1] || a[0] - b[0]).map(([rem, grade]) => rem * 4 + grade)]),
  };
}
