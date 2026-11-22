import { describe, expect, it } from "vitest";
import { checkEntries, chapters, flagKey, indexRepertory, listOnly, matchRemedy, mergeBooks, quoteFound, remedyWords, withoutBooks, type SavedBook } from "../shared/bookrubrics";
import type { RepertoryFile } from "../shared/repertory";

const rep: RepertoryFile = {
  format: 1,
  source: { title: "t", source_url: "u", reuse_terms: "r", original_filename: "f", sha256: "s" } as RepertoryFile["source"],
  remedies: [
    ["Puls.", "Pulsatilla"],
    ["Bry.", "Bryonia alba"],
  ],
  rubrics: [
    ["Ear, pain, burning", [1]],
    ["Mind, weeping, consolation amel.", [1]],
    ["Ear", []],
  ],
};

describe("book entries", () => {
  it("finds a quote across OCR line breaks, hyphens and punctuation", () => {
    const text = "The patient weeps easily, and is better\nfrom conso-\nlation; thirstless.";
    expect(quoteFound(text, "better from consolation")).toBe(true);
    expect(quoteFound(text, "weeps easily and is better")).toBe(true);
    expect(quoteFound(text, "worse from consolation")).toBe(false);
    expect(quoteFound(text, "weeps")).toBe(false); // too short to check
  });

  it("lists chapters in repertory order", () => {
    expect(chapters(rep)).toEqual(["Ear", "Mind"]);
  });

  it("keeps quoted entries, matches rubric and remedy, drops the rest", () => {
    const passage = { text: "Earache with burning pain. Weeps easily, better for consolation.", ordinal: 7, pageStart: "101", lineStart: 40 };
    const { kept, dropped } = checkEntries(indexRepertory(rep), passage, [
      { remedy: "Pulsatilla", rubric: "Ear, pain, burning", quote: "Earache with burning pain" },
      { remedy: "PULSATILLA", rubric: "ear,  pain , burning", quote: "earache with burning pain" }, // duplicate
      { remedy: "Pulsatilla", rubric: "Mind, weeping, easily", quote: "Weeps easily, better" },
      { remedy: "Pulsatilla", rubric: "Mind, fear, dark", quote: "afraid of the dark" }, // not in the passage
      { remedy: "Pulsatilla", rubric: "Burning", quote: "with burning pain" }, // not a rubric path
    ]);
    expect(kept.map((k) => [k.rubricPath, k.remedyIndex, k.passage.pageStart])).toEqual([
      ["Ear, pain, burning", 0, "101"],
      [null, 0, "101"],
    ]);
    expect(dropped).toHaveLength(3);
  });
});

describe("saved book entries", () => {
  const nash: SavedBook = {
    source: "nash",
    title: "Leaders",
    label: "Nash",
    model: "m",
    run: "1",
    entries: [
      ["Ear, pain, burning", "Bry.", "burning pain in the ear", "12"], // added to an existing rubric
      ["Ear, pain, burning", "Puls.", "burning earache of Pulsatilla", "13"], // the repertory already has it
      ["Mind, weeping, twilight", "Puls.", "weeps at twilight", "14"], // a rubric the repertory lacks
    ],
  };

  it("matches remedy spelling variants", () => {
    const r: RepertoryFile = { ...rep, remedies: [["Hep.", "Hepar sulphuris calcareum"], ["Ph-ac.", "Acidum phosphoricum"]] };
    const index = indexRepertory(r);
    expect(matchRemedy(index, r, "Hepar sulphur")).toBe(0);
    expect(matchRemedy(index, r, "Phosphoricum acidum")).toBe(1);
    expect(matchRemedy(index, r, "Phosphoric acid")).toBe(1);
    expect(matchRemedy(index, r, "Unknownia")).toBe(null);
  });

  it("spots quotes that only name remedies", () => {
    const words = remedyWords(rep);
    expect(listOnly("Pulsatilla, Bry. and others", words)).toBe(true);
    expect(listOnly("burning pain in the left ear", words)).toBe(false);
  });

  it("adds book entries without moving the repertory's own rubrics", () => {
    const { data, marks, newRubrics } = mergeBooks(rep, [nash], new Set());
    expect(data.rubrics.slice(0, 3).map(([p]) => p)).toEqual(rep.rubrics.map(([p]) => p));
    expect(data.rubrics[0][1]).toEqual([1, 1 * 4 + 1]); // Bry. added at grade 1 after Puls.
    expect(rep.rubrics[0][1]).toEqual([1]); // the original is untouched
    expect(data.rubrics[3]).toEqual(["Mind, weeping, twilight", [1]]);
    expect(newRubrics.get(3)).toEqual(["Nash"]);
    expect(marks.get(0)?.get(1)?.[0].added).toBe(true);
    expect(marks.get(0)?.get(0)?.[0].added).toBe(false);
    // Switched off: the repertory's own entries, and nothing in the books' rubrics.
    const off = withoutBooks(rep, data);
    expect(off.rubrics[0][1]).toEqual([1]);
    expect(off.rubrics[3]).toEqual(["Mind, weeping, twilight", []]);
  });

  it("leaves out flagged entries but keeps rubric ids", () => {
    const { data, marks } = mergeBooks(rep, [nash], new Set([flagKey("nash", "Puls.", "Mind, weeping, twilight")]));
    expect(data.rubrics[3]).toEqual(["Mind, weeping, twilight", []]);
    expect(marks.get(3)).toBeUndefined();
  });
});
