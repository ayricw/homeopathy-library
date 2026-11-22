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
