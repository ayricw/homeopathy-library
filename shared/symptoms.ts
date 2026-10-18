// Symptom search: which remedies do the chosen books discuss alongside the symptoms entered?
// Each symptom is a keyword search. Matching passages are grouped under the heading they sit in
// (in a materia medica that heading is the remedy name), and remedies are ranked by how many of
// the symptoms their passages mention. This measures what the books say, not clinical evidence,
// and it is not a prescription.

import { buildMatchQuery } from "./query";

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

/** The heading without page numbers, as running heads carry them ("796 PHOSPHORUS", "PHOSPHORUS 797."). */
export function remedyLabel(heading: string): string {
  return heading
    .trim()
    .split(/\s+/)
    .filter((w) => !/\d/.test(w))
    .join(" ")
    .replace(/[.:;,]+$/, "");
}

export function isRemedyHeading(heading: string | null): heading is string {
  if (!heading) return false;
  const key = remedyKey(heading);
  return key.length >= 3 && !NOT_A_REMEDY.test(key) && !SUBHEADING.test(key) && !/^(CHAPTER|PART|BOOK|LECTURE|SECTION)\b/.test(key);
}

/** Cleans the typed symptoms: one per line, blank and duplicate lines dropped, unsearchable ones reported. */
export function parseSymptoms(input: string[]): { symptoms: { label: string; match: string }[]; skipped: string[] } {
  const seen = new Set<string>();
  const symptoms: { label: string; match: string }[] = [];
  const skipped: string[] = [];
  for (const raw of input) {
    const label = raw.trim().replace(/\s+/g, " ");
    if (!label) continue;
    const match = buildMatchQuery(label);
    if (!match) {
      skipped.push(label);
      continue;
    }
    const key = match.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    symptoms.push({ label, match });
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
export function rankRemedies(symptomCount: number, rows: HeadingHits[], limit = MAX_REMEDIES): { remedies: RemedyRow[]; total: number } {
  const byKey = new Map<string, RemedyRow>();
  for (const r of rows) {
    if (!isRemedyHeading(r.heading)) continue;
    const key = remedyKey(r.heading);
    let row = byKey.get(key);
    if (!row) {
      row = {
        remedy: remedyLabel(r.heading),
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
