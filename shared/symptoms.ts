// Symptom search: which remedies do the chosen books discuss alongside the symptoms entered?
// Each symptom is a keyword search. Matching passages are grouped under the heading they sit in
// (in a materia medica that heading is the remedy name), and remedies are ranked by how many of
// the symptoms their passages mention. This measures what the books say, not clinical evidence,
// and it is not a prescription.

import { expandedMatch } from "./oldwords";

export const MAX_SYMPTOMS = 12;
export const MAX_REMEDIES = 60;

/** Headings that are book furniture rather than remedies. */
const NOT_A_REMEDY =
  /^(preface|introduction|contents|table of contents|index|general index|appendix|addenda|errata|footnotes?|notes|bibliography|glossary|the end|transcriber'?s? notes?|advertisements?)$/i;
/** Body-system and section headings used inside a remedy's chapter. Passages under these are not a remedy of their own. */
const SUBHEADING =
  /^(mind|head|scalp|eyes?|vision|ears?|hearing|nose|face|mouth|teeth|tongue|throat|stomach|abdomen|stool|rectum|anus|urine|urinary organs|bladder|kidneys|male|female|male sexual organs|female sexual organs|respiration|respiratory organs|cough|chest|heart|back|neck|extremities|limbs|upper limbs|lower limbs|sleep|fever|chill|skin|generalities|general|modalities|relationship|relations|dose|dosage|clinical|symptoms|characteristics|keynotes|cases?|case \d+|remarks|summary|conclusion|discussion|aggravation|amelioration|worse|better)$/i;

/** "ABIES CANADENSIS." and "Abies canadensis" are the same remedy. */
export function remedyKey(heading: string): string {
  return remedyLabel(heading)
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .toUpperCase();
}

/**
 * The heading without page numbers, as running heads carry them ("796 PHOSPHORUS", "PHOSPHORUS 797.").
 * In an upper-case heading, words with lower-case letters are page numbers the OCR misread ("PHYTOLACCA Sr").
 */
export function remedyLabel(heading: string): string {
  const words = heading.trim().split(/\s+/);
  const upper = words.some((w) => /^\P{Ll}*\p{Lu}{3,}\P{Ll}*$/u.test(w));
  return words
    .filter((w) => !/\d/.test(w) && !(upper && /\p{Ll}/u.test(w)))
    .join(" ")
    .replace(/[.:;,]+$/, "");
}

export function isRemedyHeading(heading: string | null): heading is string {
  if (!heading) return false;
  const key = remedyKey(heading);
  return key.length >= 3 && !NOT_A_REMEDY.test(key) && !SUBHEADING.test(key) && !/^(CHAPTER|PART|BOOK|LECTURE|SECTION)\b/.test(key);
}

/** Cleans the typed symptoms: one per line, blank and duplicate lines dropped, unsearchable ones reported. */
export function parseSymptoms(input: string[]): { symptoms: { label: string; match: string; also: string[] }[]; skipped: string[] } {
  const seen = new Set<string>();
  const symptoms: { label: string; match: string; also: string[] }[] = [];
  const skipped: string[] = [];
  for (const raw of input) {
    const label = raw.trim().replace(/\s+/g, " ");
    if (!label) continue;
    const { match, also } = expandedMatch(label);
    if (!match) {
      skipped.push(label);
      continue;
    }
    const key = match.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    symptoms.push({ label, match, also });
  }
  return { symptoms: symptoms.slice(0, MAX_SYMPTOMS), skipped };
}

/** One row per (symptom, source, heading) from the database. */
export interface HeadingHits {
  symptom: number;
  source_id: string;
  heading: string;
  hits: number;
  first_passage: number;
}

export interface RemedyCell {
  hits: number;
  /** First matching passage, for opening the text behind the count. */
  passageId: number | null;
}

export interface RemedyRow {
  remedy: string;
  sources: string[];
  covered: number;
  totalHits: number;
  cells: RemedyCell[];
}

/** Merges hits from every book under the remedy name and ranks by symptoms covered, then by passages. */
export function rankRemedies(
  symptomCount: number,
  rows: HeadingHits[],
  limit = MAX_REMEDIES,
  /** The remedy a row belongs to, or null to leave it out (e.g. a topic heading in Robyn's notes). */
  nameOf: (row: HeadingHits) => string | null = (r) => remedyLabel(r.heading),
): { remedies: RemedyRow[]; total: number } {
  const byKey = new Map<string, RemedyRow>();
  for (const r of rows) {
    if (!isRemedyHeading(r.heading)) continue;
    const name = nameOf(r);
    if (!name) continue;
    const key = remedyKey(name);
    let row = byKey.get(key);
    if (!row) {
      row = {
        remedy: name,
        sources: [],
        covered: 0,
        totalHits: 0,
        cells: Array.from({ length: symptomCount }, () => ({ hits: 0, passageId: null })),
      };
      byKey.set(key, row);
    }
    if (!row.sources.includes(r.source_id)) row.sources.push(r.source_id);
    const cell = row.cells[r.symptom];
    cell.hits += r.hits;
    cell.passageId = cell.passageId === null ? r.first_passage : Math.min(cell.passageId, r.first_passage);
    row.totalHits += r.hits;
  }
  const all = [...byKey.values()];
  for (const row of all) row.covered = row.cells.filter((c) => c.hits > 0).length;
  all.sort((a, b) => b.covered - a.covered || b.totalHits - a.totalHits || a.remedy.localeCompare(b.remedy));
  return { remedies: all.slice(0, limit), total: all.length };
}

/**
 * A check that a heading names a remedy the repertory knows, by the start of its first word
 * ("ACONITE CASE" matches Aconitum napellus; "FEVER DDX" and "PREGNANCY" match nothing).
 * Used for Robyn's notes, whose headings are often topics rather than remedies; the books are
 * arranged by remedy, so their headings are trusted as they are.
 */
export function remedyNameCheck(names: [string, string][]): (heading: string) => string | null {
  const ALIASES: Record<string, string> = { natru: "natri", kali: "kaliu", merc: "mercu", calc: "calca", phos: "phosp", sulph: "sulph" };
  const keyOf = (word: string) => (word.length >= 5 ? word.slice(0, 5) : word);
  // First-word key to the first remedy name with it ("aconi" -> "Aconitum Napellus").
  const known = new Map<string, string>();
  for (const [abbrev, name] of names) {
    const first = name.toLowerCase().split(/[^a-z]+/).find(Boolean);
    if (first && !known.has(keyOf(first))) known.set(keyOf(first), name);
    const ab = abbrev.toLowerCase().split(/[^a-z]+/).find(Boolean);
    if (ab && ab.length >= 4 && !known.has(keyOf(ab))) known.set(keyOf(ab), name);
  }
  return (heading) => {
    const first = remedyKey(heading).toLowerCase().split(/[^a-z]+/).find(Boolean) ?? "";
    if (first.length < 3) return null;
    const key = keyOf(first);
    return known.get(ALIASES[key] ?? key) ?? known.get(ALIASES[first] ?? key) ?? null;
  };
}
