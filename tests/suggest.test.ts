import { describe, expect, it } from "vitest";
import type { RepertoryFile } from "../shared/repertory";
import { buildSuggestIndex, groupSuggestions, isBroad, phrasesFromAnswers, suggestRubrics } from "../shared/suggest";

const rubrics = [
  "Ear, pain",
  "Ear, pain, burning",
  "Ear, pain, night",
  "Generalities, pain",
  "Generalities, cold, in general agg.",
  "Head, pain",
  "Mind, fear, dark",
  "Mind, grief, ailments, from",
  "Appetite, desires, sweets",
  "Stomach, thirst",
  "Stomach, thirstless",
];
const data: RepertoryFile = {
  format: 1,
  source: {} as RepertoryFile["source"],
  remedies: [["Puls.", "Pulsatilla"]],
  rubrics: rubrics.map((p) => [p, [3]]),
};
const index = buildSuggestIndex(data);
const questions = [
  { id: "main-complaint", label: "Main complaint" },
  { id: "fears", label: "Fears", options: ["The dark"] },
  { id: "cravings", label: "Craves", options: ["Sweets"] },
  { id: "cause", label: "Ailments from", options: ["Grief"] },
  { id: "stomach", label: "Stomach" },
];
const suggest = (answers: Record<string, string>) =>
  suggestRubrics(index, phrasesFromAnswers(answers, questions, "; ")).map((s) => s.path);

describe("suggested rubrics", () => {
  it("matches a sentence to the most specific rubric whose words it contains", () => {
    expect(suggest({ "main-complaint": "Burning earache since August." })).toEqual(["Ear, pain, burning"]);
    expect(suggest({ "main-complaint": "Ear pain, worse at night. Worse from the cold." })).toEqual([
      "Ear, pain, night",
      "Generalities, cold, in general agg.",
    ]);
  });

  it("needs the body part named or implied by the question", () => {
    expect(suggest({ "main-complaint": "Burning pain" })).toEqual(["Generalities, pain"]);
    expect(suggest({ stomach: "Very thirsty" })).toEqual(["Stomach, thirst"]);
  });

  it("turns ticks into repertory words", () => {
    expect(suggest({ fears: "The dark", cravings: "Sweets", cause: "Grief" })).toEqual([
      "Mind, fear, dark",
      "Appetite, desires, sweets",
      "Mind, grief, ailments, from",
    ]);
  });

  it("skips negated words", () => {
    expect(suggest({ stomach: "Not thirsty at all" })).toEqual([]);
  });
});

describe("groupSuggestions", () => {
  const s = (id: number, path: string, remedyCount: number, question: string) => ({ id, path, remedyCount, from: "", question });
  const sections = [
    { title: "Main complaint", questions: [{ id: "main-complaint" }, { id: "worse" }] },
    { title: "Mind", questions: [{ id: "fears" }] },
  ];

  it("groups by section in form order and sets broad rubrics apart", () => {
    const { groups, broad } = groupSuggestions(sections, [
      s(1, "Mind, fear, dark", 24, "fears"),
      s(2, "Ear, pain, burning", 102, "main-complaint"),
      s(3, "Heart, heart", 40, "main-complaint"),
      s(4, "Generalities, cold, agg.", 200, "worse"),
      s(5, "Ear, pain, night", 30, "worse-more"),
      s(6, "Sleep, sleepless, night", 30, "unknown"),
    ]);
    expect(groups.map((g) => [g.title, g.items.map((i) => i.id)])).toEqual([
      ["Main complaint", [2, 5]],
      ["Mind", [1]],
      ["Other answers", [6]],
    ]);
    expect(broad.map((b) => b.id)).toEqual([3, 4]);
  });

  it("calls a two-part or very long rubric broad", () => {
    expect(isBroad({ path: "Mind, restlessness", remedyCount: 20 })).toBe(true);
    expect(isBroad({ path: "Mind, fear, dark", remedyCount: 151 })).toBe(true);
    expect(isBroad({ path: "Mind, fear, dark", remedyCount: 24 })).toBe(false);
  });
});
