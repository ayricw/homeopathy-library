// Turning a materia medica's text into repertory-style entries ("Ear, pain, burning: Pulsatilla (Nash)").
// Claude proposes the entries (scripts/book-rubrics.ts); this file holds the checks applied to them,
// which are pure so they can be tested: every entry must quote the passage word for word, and its
// rubric and remedy are matched to the repertory's own where they exist.
import type { RepertoryFile } from "./repertory";

/** One entry as Claude returns it. */
export interface ProposedEntry {
  remedy: string;
  rubric: string;
  quote: string;
}

/** A checked entry, ready to report or, later, to add to the repertory. */
export interface BookEntry extends ProposedEntry {
  /** The repertory's own rubric path when one matches exactly (ignoring case and spacing), else null. */
  rubricPath: string | null;
  /** The repertory's remedy index when the name matches one, else null. */
  remedyIndex: number | null;
  passage: { ordinal: number; pageStart: string | null; lineStart: number };
}

/** Lower case, one space between words, punctuation other than commas dropped: for comparing text. */
export const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[^\p{L}\p{N}',]+/gu, " ")
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s+/g, " ")
    .trim();

/** Words only, for checking a quote against OCR text whose line breaks and hyphens vary. */
const words = (s: string) => normalize(s).replace(/,/g, " ").replace(/-\s*/g, "").split(" ").filter(Boolean).join(" ");

/** True when the quote's words appear, in order and together, in the passage. */
export function quoteFound(passage: string, quote: string): boolean {
  const q = words(quote);
  return q.split(" ").length >= 3 && words(passage.replace(/-\n\s*/g, "")).includes(q);
}

/** The repertory's chapters, in its order: the first part of every rubric path. */
export function chapters(data: RepertoryFile): string[] {
  return [...new Set(data.rubrics.map(([path]) => path.split(",")[0].trim()))];
}

export interface RepertoryIndex {
  rubricByKey: Map<string, string>;
  remedyByKey: Map<string, number>;
}

export function indexRepertory(data: RepertoryFile): RepertoryIndex {
  const rubricByKey = new Map<string, string>();
  for (const [path] of data.rubrics) rubricByKey.set(normalize(path), path);
  const remedyByKey = new Map<string, number>();
  data.remedies.forEach(([abbrev, name], i) => {
    remedyByKey.set(normalize(name), i);
    remedyByKey.set(normalize(abbrev).replace(/ /g, ""), i);
  });
  return { rubricByKey, remedyByKey };
}

/** Checks Claude's entries for one passage: drops any whose quote is not in the passage, and matches the rest. */
export function checkEntries(
  index: RepertoryIndex,
  passage: { text: string; ordinal: number; pageStart: string | null; lineStart: number },
  proposed: ProposedEntry[],
): { kept: BookEntry[]; dropped: ProposedEntry[] } {
  const kept: BookEntry[] = [];
  const dropped: ProposedEntry[] = [];
  const seen = new Set<string>();
  for (const e of proposed) {
    const key = `${normalize(e.remedy)}|${normalize(e.rubric)}`;
    if (!e.rubric.includes(",") || !quoteFound(passage.text, e.quote) || seen.has(key)) {
      dropped.push(e);
      continue;
    }
    seen.add(key);
    kept.push({
      ...e,
      rubricPath: index.rubricByKey.get(normalize(e.rubric)) ?? null,
      remedyIndex: index.remedyByKey.get(normalize(e.remedy)) ?? null,
      passage: { ordinal: passage.ordinal, pageStart: passage.pageStart, lineStart: passage.lineStart },
    });
  }
  return { kept, dropped };
}

// ---------- Saved entries, used by the app ----------

/** [rubric path, remedy abbreviation, quote, page] */
export type SavedEntry = [string, string, string, string | null];

export interface SavedBook {
  source: string;
  title: string;
  /** Short name shown on tags, e.g. "Nash". */
  label: string;
  model: string;
  run: string;
  entries: SavedEntry[];
}

/** public/book-rubrics.json: the checked entries of every book read so far. */
export interface BookRubricsFile {
  format: 1;
  books: SavedBook[];
}

/** The repertory's remedy for a name, also trying common spelling variants ("Hepar sulphur", "Phosphoricum acidum"). */
export function matchRemedy(index: RepertoryIndex, data: RepertoryFile, name: string): number | null {
  const n = normalize(name).replace(/,/g, "");
  const exact = index.remedyByKey.get(n) ?? index.remedyByKey.get(n.replace(/ /g, ""));
  if (exact !== undefined) return exact;
  const parts = n.replace(/\bacid\b/g, "acidum").split(" ");
  const swapped = parts.length === 2 ? index.remedyByKey.get(`${parts[1]} ${parts[0]}`) : undefined;
  if (swapped !== undefined) return swapped;
  if (parts.length < 2) return null;
  // Same first word, second word starting alike: accept only when exactly one remedy fits.
  const stem = parts[1].slice(0, 4);
  const hits: number[] = [];
  data.remedies.forEach(([, full], i) => {
    const w = normalize(full).split(" ");
    if (w[0] === parts[0] && (w[1] ?? "").startsWith(stem)) hits.push(i);
  });
  return hits.length === 1 ? hits[0] : null;
}

/** Words that belong to remedy names and abbreviations, to spot quotes that are only a list of remedies. */
export function remedyWords(data: RepertoryFile): Set<string> {
  const set = new Set<string>(["acid", "acidum", "and", "the", "also", "other", "others", "etc", "like"]);
  for (const [abbrev, name] of data.remedies) for (const w of words(`${abbrev} ${name}`).split(" ")) set.add(w);
  return set;
}

/** True when the quote says nothing beyond remedy names (e.g. "Picric acid, Phos. ac."). */
export function listOnly(quote: string, nameWords: Set<string>): boolean {
  return words(quote).split(" ").filter((w) => w.length >= 3 && !nameWords.has(w)).length < 3;
}

/** Turns one model's checked entries into saved entries: known remedies only, list-only quotes dropped. */
export function saveEntries(data: RepertoryFile, entries: BookEntry[]): { saved: SavedEntry[]; skipped: { unknownRemedy: number; listOnly: number } } {
  const index = indexRepertory(data);
  const nameWords = remedyWords(data);
  const saved: SavedEntry[] = [];
  const seen = new Set<string>();
  const skipped = { unknownRemedy: 0, listOnly: 0 };
  for (const e of entries) {
    const r = e.remedyIndex ?? matchRemedy(index, data, e.remedy);
    if (r === null) {
      skipped.unknownRemedy++;
      continue;
    }
    if (listOnly(e.quote, nameWords)) {
      skipped.listOnly++;
      continue;
    }
    const rubric = e.rubricPath ?? e.rubric.replace(/\s*,\s*/g, ", ").replace(/\s+/g, " ").trim();
    const abbrev = data.remedies[r][0];
    const key = `${normalize(rubric)}|${abbrev}`;
    if (seen.has(key)) continue;
    seen.add(key);
    saved.push([rubric, abbrev, e.quote.replace(/\s+/g, " ").trim(), e.passage.pageStart]);
  }
  return { saved, skipped };
}

// ---------- Merging saved entries into the repertory, in the browser ----------

export interface BookMark {
  label: string;
  title: string;
  source: string;
  quote: string;
  page: string | null;
  /** True when the repertory did not already list this remedy in this rubric. */
  added: boolean;
  /** Key used to flag the entry as wrong. */
  key: string;
}

export interface BookMerge {
  data: RepertoryFile;
  /** rubric id → remedy index → marks */
  marks: Map<number, Map<number, BookMark[]>>;
  /** Labels of the books a rubric came from, for rubrics the repertory does not have. */
  newRubrics: Map<number, string[]>;
}

export const flagKey = (source: string, abbrev: string, rubric: string) => `${source}|${abbrev}|${rubric}`;

/**
 * The repertory with the books' entries added: a remedy a book names in an existing rubric is added at
 * grade 1 (when not already listed); rubrics the repertory lacks are appended after its own, so the ids of
 * its own rubrics never change. Flagged entries are left out.
 */
export function mergeBooks(base: RepertoryFile, books: SavedBook[], flagged: Set<string>): BookMerge {
  const rubrics = base.rubrics.map(([p, e]) => [p, [...e]] as [string, number[]]);
  const byKey = new Map<string, number>();
  rubrics.forEach(([p], i) => byKey.set(normalize(p), i));
  const remedyByAbbrev = new Map(base.remedies.map(([a], i) => [a, i]));
  const marks = new Map<number, Map<number, BookMark[]>>();
  const newRubrics = new Map<number, string[]>();
  const original = base.rubrics.length;
  for (const book of books) {
    for (const [rubric, abbrev, quote, page] of book.entries) {
      const key = flagKey(book.source, abbrev, rubric);
      const r = remedyByAbbrev.get(abbrev);
      if (r === undefined || flagged.has(key)) continue;
      let id = byKey.get(normalize(rubric));
      if (id === undefined) {
        id = rubrics.push([rubric, []]) - 1;
        byKey.set(normalize(rubric), id);
      }
      if (id >= original) {
        const labels = newRubrics.get(id) ?? [];
        if (!labels.includes(book.label)) newRubrics.set(id, [...labels, book.label]);
      }
      const entries = rubrics[id][1];
      const listed = entries.some((e) => e >> 2 === r);
      if (!listed) entries.push(r * 4 + 1);
      const byRemedy = marks.get(id) ?? new Map<number, BookMark[]>();
      marks.set(id, byRemedy);
      const list = byRemedy.get(r) ?? [];
      // "added" is true only when the repertory itself did not list it (not when an earlier book did).
      const inRepertory = id < original && base.rubrics[id][1].some((e) => e >> 2 === r);
      list.push({ label: book.label, title: book.title, source: book.source, quote, page, added: !inRepertory, key });
      byRemedy.set(r, list);
    }
  }
  return { data: { ...base, rubrics }, marks, newRubrics };
}
