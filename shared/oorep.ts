// Reads one repertory out of an OOREP PostgreSQL dump (the `COPY ... FROM stdin;` blocks) and turns it
// into SQLite INSERT statements for D1. Pure and deterministic: the same dump gives the same SQL.

export interface RepertoryMeta {
  id: string;
  id_base: number;
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
  const used = entries.filter((e) => kept.has(e.rubric) && allRemedies.has(e.remedy) && e.grade >= 1 && e.grade <= 4);
  const remedies = new Map([...new Set(used.map((e) => e.remedy))].sort((a, b) => a - b).map((id) => [id, allRemedies.get(id)!]));
  return { remedies, rubrics, entries: used };
}

const q = (v: string | number | null) => (v === null ? "NULL" : typeof v === "number" ? String(v) : `'${v.replace(/'/g, "''")}'`);

/** Groups row values into INSERT statements below D1's 100 KB statement limit. */
function inserts(head: string, rows: string[], maxBytes = 20_000): string[] {
  const out: string[] = [];
  let batch: string[] = [];
  let size = head.length;
  for (const r of rows) {
    if (batch.length && size + r.length + 2 > maxBytes) {
      out.push(`${head}\n${batch.join(",\n")};`);
      batch = [];
      size = head.length;
    }
    batch.push(r);
    size += r.length + 2;
  }
  if (batch.length) out.push(`${head}\n${batch.join(",\n")};`);
  return out;
}

/**
 * SQL that loads the repertory. Every insert is OR IGNORE with fixed ids, so running it twice changes
 * nothing and an interrupted run can simply be repeated.
 */
export function repertorySql(meta: RepertoryMeta, parsed: ParsedRepertory, file: { name: string; sha256: string }): string[] {
  const base = meta.id_base * 10_000_000;
  const counts = new Map<number, number>();
  for (const e of parsed.entries) counts.set(e.rubric, (counts.get(e.rubric) ?? 0) + 1);
  return [
    `INSERT OR IGNORE INTO repertories (id, id_base, title, author, edition, publication_year, publisher, language, source_url, attribution, reuse_terms, notes, original_filename, sha256) VALUES (${[
      meta.id,
      meta.id_base,
      meta.title,
      meta.author,
      meta.edition,
      meta.publication_year,
      meta.publisher,
      meta.language,
      meta.source_url,
      meta.attribution,
      meta.reuse_terms,
      meta.notes,
      file.name,
      file.sha256,
    ]
      .map(q)
      .join(", ")});`,
    ...inserts(
      "INSERT OR IGNORE INTO remedies (id, abbrev, name) VALUES",
      [...parsed.remedies].map(([id, r]) => `(${id}, ${q(r.abbrev)}, ${q(r.name)})`),
    ),
    ...inserts(
      "INSERT OR IGNORE INTO rubrics (id, repertory_id, chapter, path, remedy_count) VALUES",
      parsed.rubrics.map((r) => `(${base + r.sourceId}, ${q(meta.id)}, ${q(r.chapter)}, ${q(r.path)}, ${counts.get(r.sourceId) ?? 0})`),
    ),
    ...inserts(
      "INSERT OR IGNORE INTO rubric_remedies (rubric_id, remedy_id, grade) VALUES",
      parsed.entries.map((e) => `(${base + e.rubric},${e.remedy},${e.grade})`),
    ),
  ];
}
