import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseOorep, repertoryFile, type RepertoryMeta } from "../shared/oorep";
import { ancestry, buildTree, filterChildren, repertorize, rubricRemedies, searchRubrics, tokenize, type RepertoryFile } from "../shared/repertory";

const dump = readFileSync(new URL("./fixtures/sample-oorep.sql", import.meta.url), "utf8");
const meta = JSON.parse(readFileSync(new URL("./fixtures/sample-repertory.json", import.meta.url), "utf8")) as RepertoryMeta;
const parsed = parseOorep(dump, "testrep");
const file = repertoryFile(meta, parsed, { name: "sample-oorep.sql", sha256: "abc" });
const tokens = tokenize(file);
const find = (q: string) => searchRubrics(file, tokens, q).map((r) => r.path);
const id = (path: string) => file.rubrics.findIndex(([p]) => p === path);

describe("OOREP import", () => {
  it("reads only the chosen repertory and skips stray rows", () => {
    expect(parsed.rubrics.map((r) => r.path)).toEqual(["Mind", "Mind, anxiety", "Mind, anxiety, night", "Head, pain, burning", "Sleep, restless"]);
    expect(parsed.rubrics[3].chapter).toBe("Head");
    // remedy 99 does not exist and rubric 15 was skipped
    expect(parsed.entries).toHaveLength(7);
    expect([...parsed.remedies.keys()]).toEqual([1, 2, 4]);
  });

  it("undoes COPY escaping", () => {
    expect(parsed.remedies.get(4)).toEqual({ abbrev: "O'Rem.", name: "Quote\tTab Remedy" });
  });

  it("writes a compact file with source details and only rubrics that list remedies", () => {
    expect(file.source.title).toBe("Test Repertory");
    expect(file.source.sha256).toBe("abc");
    expect(file.rubrics.map(([p]) => p)).toEqual(["Mind, anxiety", "Mind, anxiety, night", "Head, pain, burning", "Sleep, restless"]);
    expect(rubricRemedies(file, id("Mind, anxiety"))).toEqual([
      { abbrev: "Alph.", name: "Alpha Testplant", grade: 3 },
      { abbrev: "Bet.", name: "Beta Testmineral", grade: 1 },
    ]);
  });
});

describe("rubric search", () => {
  it("needs every word, lists general rubrics first", () => {
    expect(find("anxiety")).toEqual(["Mind, anxiety", "Mind, anxiety, night"]);
    expect(find("night anxiety")).toEqual(["Mind, anxiety, night"]);
    expect(find("anxious")).toEqual([]);
  });

  it("supports phrases, prefixes and ignores case and accents", () => {
    expect(find('"pain burning"')).toEqual(["Head, pain, burning"]);
    expect(find('"burning pain"')).toEqual([]);
    expect(find("RESTL*")).toEqual(["Sleep, restless"]);
    expect(find("anxíety")).toHaveLength(2);
    expect(find('NEAR( OR "')).toEqual([]);
  });
});

describe("repertorisation", () => {
  const anxiety = id("Mind, anxiety");
  const head = id("Head, pain, burning");
  const sleep = id("Sleep, restless");

  it("ranks by rubrics covered, then total grade", () => {
    const r = repertorize(file, [anxiety, head, sleep]);
    expect(r.map((x) => `${x.abbrev}:${x.covered}/${x.total}`)).toEqual(["Bet.:3/6", "Alph.:2/4", "O'Rem.:1/1"]);
    expect(r[0].grades).toEqual([1, 3, 2]);
  });

  it("can rank by total grade instead, breaking ties by rubrics covered", () => {
    expect(repertorize(file, [anxiety, sleep], "grades").map((x) => x.abbrev)).toEqual(["Alph.", "Bet."]);
    expect(repertorize(file, [anxiety, sleep], "symptoms").map((x) => x.abbrev)).toEqual(["Alph.", "Bet."]);
  });

  it("ignores unknown rubric ids", () => {
    expect(repertorize(file, [head, 999]).map((x) => x.abbrev)).toEqual(["Bet.", "O'Rem."]);
  });
});

describe("rubric tree", () => {
  const data: RepertoryFile = {
    ...file,
    remedies: [["A.", "A"], ["B.", "B"]],
    rubrics: [
      ["Ear, pain, pulsating", [1 * 4 + 2]],
      ["Ear, pain", [0 * 4 + 3, 1 * 4 + 1]],
      ["Ear, pain, burning", [0 * 4 + 1]],
      ["Mind, anxiety", [0 * 4 + 2]],
      ["Ear, pain, burning", [1 * 4 + 1]],
      ["Ear, noises, roaring", [1 * 4 + 1]],
    ],
  };
  const tree = buildTree(data);
  const at = (path: string) => tree.byPath.get(path)!;
  const labels = (list: number[]) => list.map((n) => tree.nodes[n].label);

  it("orders chapters head to toe and sub-rubrics A to Z", () => {
    expect(labels(tree.roots)).toEqual(["Mind", "Ear"]);
    expect(labels(tree.nodes[at("Ear")].children)).toEqual(["noises", "pain"]);
    expect(labels(tree.nodes[at("Ear, pain")].children)).toEqual(["burning", "pulsating"]);
  });

  it("adds levels the repertory lists no remedies under, and keeps the first of a repeated rubric", () => {
    expect(tree.nodes[at("Ear")].id).toBeNull();
    expect(tree.nodes[at("Ear, noises")].id).toBeNull();
    expect(tree.nodes[at("Ear, pain")]).toMatchObject({ id: 1, remedyCount: 2 });
    expect(tree.nodes[at("Ear, pain, burning")].id).toBe(2);
  });

  it("walks back to the chapter and filters a level by word starts", () => {
    expect(labels(ancestry(tree, at("Ear, pain, burning")))).toEqual(["Ear", "pain", "burning"]);
    expect(labels(filterChildren(tree, at("Ear, pain"), "PULS"))).toEqual(["pulsating"]);
    expect(labels(filterChildren(tree, at("Ear, pain"), "sating"))).toEqual([]);
    expect(labels(filterChildren(tree, null, ""))).toEqual(["Mind", "Ear"]);
  });
});
