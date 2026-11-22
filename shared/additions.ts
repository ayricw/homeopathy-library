// Robyn's own repertory additions: a remedy she adds to a rubric from her experience. They are merged
// into the repertory in the browser (always counted in ranking) and marked as hers wherever shown.
import type { RepertoryFile } from "./repertory";

export interface Addition {
  id: number;
  rubric_path: string;
  /** The repertory's abbreviation. */
  remedy: string;
  grade: number;
  note: string | null;
  created_at?: string;
}

export interface AdditionMerge {
  data: RepertoryFile;
  /** By rubric id, then remedy index: Robyn's addition, and whether it added the remedy (false when the repertory already lists it). */
  marks: Map<number, Map<number, { addition: Addition; added: boolean }>>;
  /** Additions whose rubric or remedy is not in this repertory file. */
  unmatched: Addition[];
}

/**
 * Adds each remedy to its rubric at the grade given. A remedy the rubric already lists keeps the
 * higher of the two grades. Rubric ids and paths never change, so the search index and the tree
 * built from the repertory stay valid.
 */
export function mergeAdditions(base: RepertoryFile, additions: Addition[]): AdditionMerge {
  const marks: AdditionMerge["marks"] = new Map();
  const unmatched: Addition[] = [];
  if (additions.length === 0) return { data: base, marks, unmatched };
  const rubricByPath = new Map<string, number>();
  base.rubrics.forEach(([path], id) => {
    if (!rubricByPath.has(path)) rubricByPath.set(path, id);
  });
  const remedyByAbbrev = new Map(base.remedies.map(([a], i) => [a.toLowerCase(), i]));
  const rubrics = base.rubrics.slice();
  for (const a of additions) {
    const id = rubricByPath.get(a.rubric_path);
    const remedy = remedyByAbbrev.get(a.remedy.toLowerCase());
    if (id === undefined || remedy === undefined) {
      unmatched.push(a);
      continue;
    }
    const [path, entries] = rubrics[id];
    const at = entries.findIndex((e) => e >> 2 === remedy);
    const grade = Math.min(Math.max(a.grade, 1), 3);
    let next: number[];
    if (at < 0) next = [...entries, remedy * 4 + grade];
    else next = entries.map((e, i) => (i === at ? remedy * 4 + Math.max(e & 3, grade) : e));
    // Entries stay highest grade first, as in the file.
    next.sort((x, y) => (y & 3) - (x & 3));
    rubrics[id] = [path, next];
    let m = marks.get(id);
    if (!m) marks.set(id, (m = new Map()));
    m.set(remedy, { addition: a, added: at < 0 });
  }
  return { data: { ...base, rubrics }, marks, unmatched };
}
