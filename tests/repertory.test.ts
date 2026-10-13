import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseOorep, repertoryFile, type RepertoryMeta } from "../shared/oorep";
import { repertorize, rubricRemedies, searchRubrics, tokenize } from "../shared/repertory";

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
