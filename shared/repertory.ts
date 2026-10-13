// Repertorisation: rank remedies across the rubrics chosen for a case, the way repertory software does.
// "symptoms" ranks by the number of rubrics a remedy appears in, then by its total grade.
// "grades" ranks by total grade, then by rubrics covered.

export const MAX_CASE_RUBRICS = 40;

export type RankMethod = "symptoms" | "grades";

export interface RubricEntry {
  rubric_id: number;
  remedy_id: number;
  abbrev: string;
  name: string;
  grade: number;
}

export interface RankedRemedy {
  id: number;
  abbrev: string;
  name: string;
  covered: number;
  total: number;
  /** Grade in each case rubric, in the order given; 0 when the remedy is not listed. */
  grades: number[];
}

export function repertorize(rubricIds: number[], entries: RubricEntry[], method: RankMethod = "symptoms"): RankedRemedy[] {
  const index = new Map(rubricIds.map((id, i) => [id, i]));
  const byRemedy = new Map<number, RankedRemedy>();
  for (const e of entries) {
    const col = index.get(e.rubric_id);
    if (col === undefined) continue;
    let r = byRemedy.get(e.remedy_id);
    if (!r) {
      r = { id: e.remedy_id, abbrev: e.abbrev, name: e.name, covered: 0, total: 0, grades: rubricIds.map(() => 0) };
      byRemedy.set(e.remedy_id, r);
    }
    if (r.grades[col] === 0) r.covered++;
    r.total += e.grade - r.grades[col];
    r.grades[col] = e.grade;
  }
  const ranked = [...byRemedy.values()];
  ranked.sort((a, b) =>
    method === "symptoms"
      ? b.covered - a.covered || b.total - a.total || a.abbrev.localeCompare(b.abbrev)
      : b.total - a.total || b.covered - a.covered || a.abbrev.localeCompare(b.abbrev),
  );
  return ranked;
}
