import { describe, expect, it } from "vitest";
import { isRemedyHeading, MAX_SYMPTOMS, parseSymptoms, rankRemedies, remedyKey, type HeadingHits } from "../shared/symptoms";

const hit = (symptom: number, heading: string, hits = 1, first_passage = 10, source_id = "a"): HeadingHits => ({ symptom, source_id, heading, hits, first_passage });

describe("symptom search", () => {
  it("cleans symptom lines", () => {
    const { symptoms, skipped } = parseSymptoms(["  burning   pain ", "", "Burning pain", "!!!", '"worse at night"']);
    expect(symptoms).toEqual([
      { label: "burning pain", match: '"burning" "pain"' },
      { label: '"worse at night"', match: '"worse at night"' },
    ]);
    expect(skipped).toEqual(["!!!"]);
    expect(parseSymptoms(Array.from({ length: 20 }, (_, i) => `s${i}`)).symptoms).toHaveLength(MAX_SYMPTOMS);
  });

  it("recognises remedy headings and skips book furniture and body-system subheadings", () => {
    expect(isRemedyHeading("ABIES CANADENSIS.")).toBe(true);
    expect(isRemedyHeading("PREFACE.")).toBe(false);
    expect(isRemedyHeading("HEAD.")).toBe(false);
    expect(isRemedyHeading("CHAPTER IV.")).toBe(false);
    expect(isRemedyHeading(null)).toBe(false);
    expect(remedyKey("Abies  canadensis.")).toBe(remedyKey("ABIES CANADENSIS"));
  });

  it("ranks by symptoms covered, then by passage count, merging books", () => {
    const { remedies, total } = rankRemedies(3, [
      hit(0, "ALPHA.", 5, 30),
      hit(0, "BETA.", 1, 40),
      hit(1, "BETA.", 1, 41),
      hit(2, "Beta", 2, 7, "b"),
      hit(1, "PREFACE.", 9, 1),
    ]);
    expect(total).toBe(2);
    expect(remedies.map((r) => [r.remedy, r.covered, r.totalHits])).toEqual([
      ["BETA", 3, 4],
      ["ALPHA", 1, 5],
    ]);
    expect(remedies[0].sources).toEqual(["a", "b"]);
    expect(remedies[0].cells.map((c) => c.passageId)).toEqual([40, 41, 7]);
    expect(remedies[1].cells[1]).toEqual({ hits: 0, passageId: null });
  });
});
