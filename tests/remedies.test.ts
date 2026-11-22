import { describe, expect, it } from "vitest";
import { mergeAdditions } from "../shared/additions";
import { elementsOf, groupOf } from "../shared/families";
import { concepts, plainIndex, searchPlain } from "../shared/plain";
import { buildRemedyIndex, compareRemedies, findRemedy, remedyRubrics, searchRemedies } from "../shared/remedies";
import type { RepertoryFile } from "../shared/repertory";

const e = (remedy: number, grade: number) => remedy * 4 + grade;
const data: RepertoryFile = {
  format: 1,
  source: {} as RepertoryFile["source"],
  remedies: [
    ["Bell.", "Belladonna"],
    ["Kali-c.", "Kalium carbonicum"],
    ["Puls.", "Pulsatilla pratensis"],
  ],
  rubrics: [
    ["Skin, formication", [e(1, 3), e(0, 1)]],
    ["Head, pain, throbbing", [e(0, 3), e(2, 2), e(1, 1)]],
    ["Generals, food and drinks, salt, desires", [e(2, 2)]],
    ["Mind, weeping", [e(2, 3), e(1, 2)]],
  ],
};

describe("reverse repertory", () => {
  const index = buildRemedyIndex(data);
  it("lists every rubric a remedy is in, highest grade first", () => {
    expect(remedyRubrics(index, 1).map((r) => [r.path, r.grade])).toEqual([
      ["Skin, formication", 3],
      ["Mind, weeping", 2],
      ["Head, pain, throbbing", 1],
    ]);
    expect(remedyRubrics(index, 1, 2)).toHaveLength(2);
  });
  it("finds remedies by abbreviation or name", () => {
    expect(findRemedy(data, "kali-c")).toBe(1);
    expect(findRemedy(data, "Belladonna")).toBe(0);
    expect(findRemedy(data, "nope")).toBeNull();
    expect(searchRemedies(data, "pul")).toEqual([2]);
  });
  it("compares remedies: shared rubrics and grade 3 rubrics only one has", () => {
    const c = compareRemedies(index, [1, 2]);
    expect(c.shared.map((s) => s.path)).toEqual(["Mind, weeping", "Head, pain, throbbing"]);
    expect(c.unique[0].map((u) => u.path)).toEqual(["Skin, formication"]);
    expect(c.totals).toEqual([3, 3]);
  });
});

describe("families", () => {
  it("reads elements from Latin names", () => {
    expect(elementsOf("Kalium carbonicum")).toEqual(["K", "C"]);
    expect(groupOf("Kali-c.", "Kalium carbonicum")).toMatchObject({ kingdom: "Mineral", family: "Kalium salts" });
  });
  it("groups listed plants and animals", () => {
    expect(groupOf("Puls.", "Pulsatilla pratensis").kingdom).toBe("Plant");
    expect(groupOf("Lach.", "Lachesis muta").kingdom).toBe("Animal");
  });
});

describe("everyday-language search", () => {
  const index = plainIndex(data);
  it("turns everyday phrases into repertory words", () => {
    expect(concepts("feels like ants crawling")[0].alts).toContain("formication");
  });
  it("finds rubrics from everyday words", () => {
    expect(searchPlain(data, index, "ants crawling on skin")[0].path).toBe("Skin, formication");
    expect(searchPlain(data, index, "throbbing headache")[0].path).toBe("Head, pain, throbbing");
    expect(searchPlain(data, index, "craves salt")[0].path).toBe("Generals, food and drinks, salt, desires");
  });
});

describe("my additions", () => {
  it("adds a remedy to a rubric and keeps the higher grade of an existing one", () => {
    const m = mergeAdditions(data, [
      { id: 1, rubric_path: "Generals, food and drinks, salt, desires", remedy: "bell.", grade: 3, note: null },
      { id: 2, rubric_path: "Skin, formication", remedy: "Bell.", grade: 2, note: null },
      { id: 3, rubric_path: "No such rubric", remedy: "Bell.", grade: 1, note: null },
    ]);
    expect(m.data.rubrics[2][1]).toEqual([e(0, 3), e(2, 2)]);
    expect(m.data.rubrics[0][1]).toContain(e(0, 2));
    expect(m.marks.get(2)?.get(0)?.added).toBe(true);
    expect(m.marks.get(0)?.get(0)?.added).toBe(false);
    expect(m.unmatched.map((a) => a.id)).toEqual([3]);
    expect(data.rubrics[2][1]).toEqual([e(2, 2)]);
  });
});
