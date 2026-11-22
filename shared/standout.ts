// Ways to see past the overall ranking: which remedies are strongest in each rubric of the case, and
// where a remedy stands out (top grade in a small rubric) even when its overall score is modest.
import type { RankedRemedy, RepertoryFile } from "./repertory";

/** A rubric is "small" when it lists at most this many remedies: top grade there says the most. */
export const SMALL_RUBRIC = 30;

export interface Strongest {
  id: number;
  /** The highest grade any remedy has in the rubric. */
  grade: number;
  /** Remedies at that grade, best overall rank first; rank is 1-based in the given ranking (or null when not ranked there). */
  remedies: { index: number; rank: number | null }[];
  remedyCount: number;
}

/** For each case rubric, the remedies at its highest grade, in the order of the case's ranking. */
export function strongestByRubric(data: RepertoryFile, rubricIds: number[], ranked: RankedRemedy[]): Strongest[] {
  const rank = new Map(ranked.map((r, i) => [r.index, i + 1]));
  return rubricIds.map((id) => {
    const entries = data.rubrics[id]?.[1] ?? [];
    const grade = entries.reduce((g, e) => Math.max(g, Math.min(e & 3, 3)), 0);
    const remedies = entries
      .filter((e) => Math.min(e & 3, 3) === grade)
      .map((e) => ({ index: e >> 2, rank: rank.get(e >> 2) ?? null }))
      .sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity) || a.index - b.index);
    return { id, grade, remedies, remedyCount: entries.length };
  });
}

/** The case rubric where a remedy stands out most: grade 3 in the smallest rubric of at most SMALL_RUBRIC remedies. */
export function standoutOf(data: RepertoryFile, rubricIds: number[], remedy: RankedRemedy): { id: number; remedyCount: number } | null {
  let best: { id: number; remedyCount: number } | null = null;
  remedy.grades.forEach((g, col) => {
    if (g < 3) return;
    const id = rubricIds[col];
    const n = data.rubrics[id]?.[1].length ?? Infinity;
    if (n <= SMALL_RUBRIC && (!best || n < best.remedyCount)) best = { id, remedyCount: n };
  });
  return best;
}

/** Keeps only the remedies listed in every "must have" rubric (by column in the case). */
export const mustHave = (ranked: RankedRemedy[], cols: number[]) => (cols.length ? ranked.filter((r) => cols.every((c) => r.grades[c] > 0)) : ranked);
