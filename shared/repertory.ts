// Repertory search and repertorisation, run in the browser over the repertory data file.
// "symptoms" ranks by the number of rubrics a remedy appears in, then by its total grade.
// "grades" ranks by total grade, then by rubrics covered.

import type { RepertoryMeta } from "./oorep";

export const MAX_CASE_RUBRICS = 40;

export type RankMethod = "power" | "symptoms" | "grades";

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
  /** Power score, 0 to 100: see rubricWeight. */
  power: number;
}

/** Chapters of general symptoms (the whole person), which count more than local ones. */
const GENERAL_CHAPTERS = new Set(["generalities", "generals", "sleep", "dreams", "appetite", "perspiration", "fever", "chill", "food"]);

/**
 * How much one case rubric counts in the Power score:
 * - rarity: a rubric listing few remedies says more (1 remedy counts 2.5x, 300 or more count 1x);
 * - kind: mind symptoms 1.5x, general symptoms 1.3x, local symptoms 1x (Kent's order of importance);
 * - key: a rubric starred as a key symptom counts double.
 * A remedy earns the rubric's weight times its grade out of 3; the score is what it earned out of the most it could earn.
 */
export function rubricWeight(path: string, remedyCount: number, key = false): number {
  const n = Math.max(1, remedyCount);
  const rarity = 1 + 1.5 * (1 - Math.min(1, Math.log(n) / Math.log(300)));
  const chapter = path.split(",")[0].trim().toLowerCase();
  const kind = chapter === "mind" ? 1.5 : GENERAL_CHAPTERS.has(chapter) ? 1.3 : 1;
  return rarity * kind * (key ? 2 : 1);
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

export function repertorize(data: RepertoryFile, rubricIds: number[], method: RankMethod = "power", keyIds: number[] = []): RankedRemedy[] {
  const byRemedy = new Map<number, RankedRemedy>();
  rubricIds.forEach((id, col) => {
    for (const e of data.rubrics[id]?.[1] ?? []) {
      const index = e >> 2;
      const grade = e & 3;
      let r = byRemedy.get(index);
      if (!r) {
        const [abbrev, name] = data.remedies[index];
        r = { index, abbrev, name, covered: 0, total: 0, grades: rubricIds.map(() => 0), power: 0 };
        byRemedy.set(index, r);
      }
      if (r.grades[col] === 0) r.covered++;
      r.total += grade - r.grades[col];
      r.grades[col] = grade;
    }
  });
  const ranked = [...byRemedy.values()];
  const keys = new Set(keyIds);
  const weights = rubricIds.map((id) => rubricWeight(data.rubrics[id]?.[0] ?? "", data.rubrics[id]?.[1].length ?? 1, keys.has(id)));
  const most = weights.reduce((a, b) => a + b, 0);
  for (const r of ranked) {
    const earned = r.grades.reduce((sum, g, col) => sum + (weights[col] * Math.min(g, 3)) / 3, 0);
    r.power = most > 0 ? Math.round((earned / most) * 100) : 0;
  }
  ranked.sort((a, b) =>
    method === "symptoms"
      ? b.covered - a.covered || b.total - a.total || a.abbrev.localeCompare(b.abbrev)
      : method === "grades"
        ? b.total - a.total || b.covered - a.covered || a.abbrev.localeCompare(b.abbrev)
        : b.power - a.power || b.covered - a.covered || b.total - a.total || a.abbrev.localeCompare(b.abbrev),
  );
  return ranked;
}

/** One level of a rubric path ("Ear" > "pain" > "burning"). */
export interface RubricNode {
  label: string;
  path: string;
  /** Rubric id, or null for a level the repertory lists no remedies under directly. */
  id: number | null;
  remedyCount: number;
  parent: number | null;
  children: number[];
}

export interface RubricTree {
  nodes: RubricNode[];
  /** Chapters, head to toe in Kent's order; any others follow A to Z. */
  roots: number[];
  byPath: Map<string, number>;
}

/** Kent's chapter order, which most repertories follow: head to toe, then the general sections. */
const CHAPTER_ORDER = [
  "Mind", "Vertigo", "Head", "Eye", "Vision", "Ear", "Hearing", "Nose", "Face", "Mouth", "Teeth", "Throat",
  "External throat", "Appetite", "Stomach", "Abdomen", "Rectum", "Stool", "Bladder", "Kidneys", "Prostate gland",
  "Urethra", "Urine", "Genitalia male", "Genitalia female", "Larynx and trachea", "Respiration", "Cough",
  "Expectoration", "Chest", "Heart & Circulation", "Back", "Extremities", "Sleep", "Chill", "Fever", "Perspiration",
  "Skin", "Blood", "Generalities", "Clinical",
].map((c) => c.toLowerCase());

/** Builds the chapter > rubric > sub-rubric tree from the comma-separated paths. Children are sorted A to Z. */
export function buildTree(data: RepertoryFile): RubricTree {
  const nodes: RubricNode[] = [];
  const roots: number[] = [];
  const byPath = new Map<string, number>();
  const node = (parts: string[]): number => {
    const path = parts.join(", ");
    let n = byPath.get(path);
    if (n !== undefined) return n;
    const parent = parts.length > 1 ? node(parts.slice(0, -1)) : null;
    n = nodes.push({ label: parts[parts.length - 1], path, id: null, remedyCount: 0, parent, children: [] }) - 1;
    byPath.set(path, n);
    if (parent === null) roots.push(n);
    else nodes[parent].children.push(n);
    return n;
  };
  data.rubrics.forEach(([path, entries], id) => {
    const n = nodes[node(path.split(", "))];
    // A repeated path keeps the first rubric; the other is still found by search.
    if (n.id === null) {
      n.id = id;
      n.remedyCount = entries.length;
    }
  });
  const cmp = (a: number, b: number) => nodes[a].label.localeCompare(nodes[b].label, undefined, { numeric: true, sensitivity: "base" });
  for (const n of nodes) n.children.sort(cmp);
  const rank = (n: number) => {
    const i = CHAPTER_ORDER.indexOf(nodes[n].label.toLowerCase());
    return i < 0 ? CHAPTER_ORDER.length : i;
  };
  roots.sort((a, b) => rank(a) - rank(b) || cmp(a, b));
  return { nodes, roots, byPath };
}

/** The nodes from the chapter down to this one. */
export function ancestry(tree: RubricTree, n: number): number[] {
  const chain: number[] = [];
  for (let at: number | null = n; at !== null; at = tree.nodes[at].parent) chain.unshift(at);
  return chain;
}

/** Children whose label contains every typed word (accents and case ignored). */
export function filterChildren(tree: RubricTree, n: number | null, input: string): number[] {
  const list = n === null ? tree.roots : tree.nodes[n].children;
  const want = words(input);
  if (!want.length) return list;
  return list.filter((c) => {
    const have = words(tree.nodes[c].label);
    return want.every((w) => have.some((h) => h.startsWith(w)));
  });
}
