// Repertory search and repertorisation, run in the browser over the repertory data file.
// "symptoms" ranks by the number of rubrics a remedy appears in, then by its total grade.
// "grades" ranks by total grade, then by rubrics covered.

import type { RepertoryMeta } from "./oorep";

export const MAX_CASE_RUBRICS = 40;

export type RankMethod = "symptoms" | "grades";

/** The file written by scripts/build-repertory.ts and served as a static asset. */
export interface RepertoryFile {
  format: 1;
  source: Omit<RepertoryMeta, "oorep_abbrev"> & { original_filename: string; sha256: string };
  /** [abbreviation, full name] */
  remedies: [string, string][];
  /** [path, entries], each entry remedyIndex * 4 + grade, highest grade first */
  rubrics: [string, number[]][];
}

export interface Rubric {
  /** Index into RepertoryFile.rubrics */
  id: number;
  path: string;
  chapter: string;
  remedyCount: number;
}

export interface RankedRemedy {
  index: number;
  abbrev: string;
  name: string;
  covered: number;
  total: number;
  /** Grade in each case rubric, in case order; 0 when the remedy is not listed. */
  grades: number[];
}

const words = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .split(/[^\p{L}\p{N}']+/u)
    .filter(Boolean);

type Term = { words: string[]; prefix: boolean };

/** Same rules as the keyword search: every term must match; "quotes" make a phrase; a trailing * matches word starts. */
export function parseTerms(input: string): Term[] {
  const terms: Term[] = [];
  const re = /"([^"]*)"|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(input))) {
    const raw = m[1] ?? m[2];
    const prefix = m[1] === undefined && raw.endsWith("*");
    const w = words(raw);
    if (w.length) terms.push({ words: w, prefix: prefix && w.length === 1 });
  }
  return terms;
}

function matches(tokens: string[], t: Term): boolean {
  if (t.prefix) return tokens.some((w) => w.startsWith(t.words[0]));
  outer: for (let i = 0; i + t.words.length <= tokens.length; i++) {
    for (let j = 0; j < t.words.length; j++) if (tokens[i + j] !== t.words[j]) continue outer;
    return true;
  }
  return false;
}

export function toRubric(data: RepertoryFile, id: number): Rubric {
  const [path, entries] = data.rubrics[id];
  return { id, path, chapter: path.split(",")[0].trim(), remedyCount: entries.length };
}

/** Rubrics containing every term: general ones (fewest levels) first, then the ones listing more remedies. */
export function searchRubrics(data: RepertoryFile, tokens: string[][], input: string, limit = 40): Rubric[] {
  const terms = parseTerms(input);
  if (!terms.length) return [];
  const hits: Rubric[] = [];
  data.rubrics.forEach((_, id) => {
    if (terms.every((t) => matches(tokens[id], t))) hits.push(toRubric(data, id));
  });
  const depth = (p: string) => p.split(",").length;
  hits.sort((a, b) => depth(a.path) - depth(b.path) || b.remedyCount - a.remedyCount || a.path.localeCompare(b.path));
  return hits.slice(0, limit);
}

/** Lower-case words of every rubric path, computed once after loading. */
export function tokenize(data: RepertoryFile): string[][] {
  return data.rubrics.map(([path]) => words(path));
}

export function rubricRemedies(data: RepertoryFile, id: number): { abbrev: string; name: string; grade: number }[] {
  return data.rubrics[id][1].map((e) => {
    const [abbrev, name] = data.remedies[e >> 2];
    return { abbrev, name, grade: e & 3 };
  });
}

export function repertorize(data: RepertoryFile, rubricIds: number[], method: RankMethod = "symptoms"): RankedRemedy[] {
  const byRemedy = new Map<number, RankedRemedy>();
  rubricIds.forEach((id, col) => {
    for (const e of data.rubrics[id]?.[1] ?? []) {
      const index = e >> 2;
      const grade = e & 3;
      let r = byRemedy.get(index);
      if (!r) {
        const [abbrev, name] = data.remedies[index];
        r = { index, abbrev, name, covered: 0, total: 0, grades: rubricIds.map(() => 0) };
        byRemedy.set(index, r);
      }
      if (r.grades[col] === 0) r.covered++;
      r.total += grade - r.grades[col];
      r.grades[col] = grade;
    }
  });
  const ranked = [...byRemedy.values()];
  ranked.sort((a, b) =>
    method === "symptoms"
      ? b.covered - a.covered || b.total - a.total || a.abbrev.localeCompare(b.abbrev)
      : b.total - a.total || b.covered - a.covered || a.abbrev.localeCompare(b.abbrev),
  );
  return ranked;
}
