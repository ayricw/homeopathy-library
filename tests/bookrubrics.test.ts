import { describe, expect, it } from "vitest";
import { checkEntries, chapters, indexRepertory, quoteFound } from "../shared/bookrubrics";
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
