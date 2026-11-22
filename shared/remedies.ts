// Remedy-centred views of the repertory, run in the browser: every rubric a remedy appears in
// (the reverse repertory), side-by-side comparison of a few remedies, and the family view of a case.
import { groupOf, type Kingdom } from "./families";
import type { RankedRemedy, RepertoryFile } from "./repertory";

export interface RemedyRubric {
  id: number;
  path: string;
  chapter: string;
  grade: number;
  /** How many remedies the rubric lists: small rubrics are the most characteristic. */
  remedyCount: number;
}

/** For each remedy, its rubric ids and grades. Built once per repertory file (about 735,000 entries). */
export interface RemedyIndex {
  data: RepertoryFile;
  /** byRemedy[remedy] = flat [rubricId, grade, rubricId, grade, ...] */
  byRemedy: number[][];
}

export function buildRemedyIndex(data: RepertoryFile): RemedyIndex {
  const byRemedy: number[][] = data.remedies.map(() => []);
  data.rubrics.forEach(([, entries], id) => {
    for (const e of entries) byRemedy[e >> 2]?.push(id, e & 3);
  });
  return { data, byRemedy };
}

/** Every rubric the remedy appears in, highest grade first, then the smallest (most characteristic) rubrics. */
export function remedyRubrics(index: RemedyIndex, remedy: number, minGrade = 1): RemedyRubric[] {
  const flat = index.byRemedy[remedy] ?? [];
  const out: RemedyRubric[] = [];
  for (let i = 0; i < flat.length; i += 2) {
    if (flat[i + 1] < minGrade) continue;
    const [path, entries] = index.data.rubrics[flat[i]];
    out.push({ id: flat[i], path, chapter: path.split(",")[0].trim(), grade: flat[i + 1], remedyCount: entries.length });
  }
  out.sort((a, b) => b.grade - a.grade || a.remedyCount - b.remedyCount || a.path.localeCompare(b.path));
  return out;
}

/** Counts of rubrics by chapter, in the order chapters first appear in the repertory. */
export function chapterCounts(rubrics: RemedyRubric[]): { chapter: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const r of rubrics) counts.set(r.chapter, (counts.get(r.chapter) ?? 0) + 1);
  return [...counts].map(([chapter, count]) => ({ chapter, count }));
}

/** A remedy by abbreviation or full name, ignoring case and the trailing dot. */
export function findRemedy(data: RepertoryFile, key: string): number | null {
  const k = key.trim().toLowerCase().replace(/\.$/, "");
  if (!k) return null;
  const i = data.remedies.findIndex(([a, n]) => a.toLowerCase().replace(/\.$/, "") === k || n.toLowerCase() === k);
  return i < 0 ? null : i;
}

/** Remedies whose name or abbreviation starts with (or, failing that, contains) the typed words. */
export function searchRemedies(data: RepertoryFile, input: string, limit = 20): number[] {
  const q = input.trim().toLowerCase();
  if (!q) return [];
  const starts: number[] = [];
  const contains: number[] = [];
  data.remedies.forEach(([a, n], i) => {
    const name = n.toLowerCase();
    const abbrev = a.toLowerCase();
    if (name.startsWith(q) || abbrev.startsWith(q)) starts.push(i);
    else if (name.includes(q)) contains.push(i);
  });
  return [...starts, ...contains].slice(0, limit);
}

export interface Comparison {
  /** Rubrics every compared remedy is in, at grade 2 or more for at least one: strongest shared first. */
  shared: { id: number; path: string; grades: number[]; remedyCount: number }[];
  /** For each remedy, its grade 3 rubrics none of the others have. */
  unique: RemedyRubric[][];
  /** Rubric counts for each remedy. */
  totals: number[];
}

export function compareRemedies(index: RemedyIndex, remedies: number[], limit = 60): Comparison {
  const maps = remedies.map((r) => {
    const m = new Map<number, number>();
    const flat = index.byRemedy[r] ?? [];
    for (let i = 0; i < flat.length; i += 2) m.set(flat[i], flat[i + 1]);
    return m;
  });
  const shared: Comparison["shared"] = [];
  if (maps.length > 1) {
    const [first, ...rest] = maps;
    for (const [id, g] of first) {
      if (!rest.every((m) => m.has(id))) continue;
      const grades = [g, ...rest.map((m) => m.get(id)!)];
      if (Math.max(...grades) < 2) continue;
      const [path, entries] = index.data.rubrics[id];
      shared.push({ id, path, grades, remedyCount: entries.length });
    }
  }
  const sum = (g: number[]) => g.reduce((a, b) => a + b, 0);
  shared.sort((a, b) => sum(b.grades) - sum(a.grades) || a.remedyCount - b.remedyCount || a.path.localeCompare(b.path));
  const unique = remedies.map((r, i) =>
    remedyRubrics(index, r, 3)
      .filter((x) => maps.every((m, j) => j === i || !m.has(x.id)))
      .slice(0, limit),
  );
  return { shared: shared.slice(0, limit), unique, totals: maps.map((m) => m.size) };
}

export interface FamilyResult {
  kingdom: Kingdom;
  family: string;
  /** Case rubrics covered by at least one member. */
  covered: number;
  /** Members among the ranked remedies, best first. */
  members: RankedRemedy[];
}

/**
 * The family view of a case: groups the ranked remedies by family and counts how many of the case's
 * rubrics the family covers between its members. A family that covers the case well, even when no
 * single member does, is worth a look in the books.
 */
export function familyView(ranked: RankedRemedy[]): { families: FamilyResult[]; kingdoms: { kingdom: Kingdom; covered: number; members: number }[] } {
  const byFamily = new Map<string, { kingdom: Kingdom; family: string; cols: Set<number>; members: RankedRemedy[] }>();
  const byKingdom = new Map<Kingdom, { cols: Set<number>; members: number }>();
  for (const r of ranked) {
    const g = groupOf(r.abbrev, r.name);
    const key = `${g.kingdom}|${g.family}`;
    let f = byFamily.get(key);
    if (!f) byFamily.set(key, (f = { kingdom: g.kingdom, family: g.family, cols: new Set(), members: [] }));
    let k = byKingdom.get(g.kingdom);
    if (!k) byKingdom.set(g.kingdom, (k = { cols: new Set(), members: 0 }));
    f.members.push(r);
    k.members++;
    r.grades.forEach((grade, col) => {
      if (grade > 0) {
        f!.cols.add(col);
        k!.cols.add(col);
      }
    });
  }
  const families = [...byFamily.values()]
    .filter((f) => f.family !== "Not grouped yet")
    .map((f) => ({ kingdom: f.kingdom, family: f.family, covered: f.cols.size, members: f.members }))
    .sort((a, b) => b.covered - a.covered || b.members.length - a.members.length || a.family.localeCompare(b.family));
  const kingdoms = [...byKingdom].map(([kingdom, k]) => ({ kingdom, covered: k.cols.size, members: k.members }));
  kingdoms.sort((a, b) => b.covered - a.covered || b.members - a.members);
  return { families, kingdoms };
}
