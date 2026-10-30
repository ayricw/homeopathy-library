import { describe, expect, it } from "vitest";
import type { RepertoryFile } from "../shared/repertory";
import { buildSuggestIndex, phrasesFromAnswers, suggestRubrics } from "../shared/suggest";

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
