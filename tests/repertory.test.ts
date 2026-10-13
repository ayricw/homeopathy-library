import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseOorep, repertorySql, type RepertoryMeta } from "../shared/oorep";
import { repertorize, type RubricEntry } from "../shared/repertory";

const dump = readFileSync(new URL("./fixtures/sample-oorep.sql", import.meta.url), "utf8");
const meta = JSON.parse(readFileSync(new URL("./fixtures/sample-repertory.json", import.meta.url), "utf8")) as RepertoryMeta;

describe("OOREP import", () => {
  const parsed = parseOorep(dump, "testrep");

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

  it("writes idempotent SQL with namespaced rubric ids and escaped quotes", () => {
    const sql = repertorySql(meta, parsed, { name: "sample-oorep.sql", sha256: "abc" }).join("\n");
    expect(sql).toContain("INSERT OR IGNORE INTO rubrics");
    expect(sql).toContain("(90000011, 'testrep', 'Mind', 'Mind, anxiety', 2)");
    expect(sql).toContain("'O''Rem.'");
    expect(sql).not.toMatch(/INSERT INTO (?!.*OR IGNORE)/);
  });
});

describe("repertorisation", () => {
  const e = (rubric_id: number, remedy_id: number, grade: number): RubricEntry => ({ rubric_id, remedy_id, abbrev: `R${remedy_id}`, name: `Remedy ${remedy_id}`, grade });
  const entries = [e(1, 1, 3), e(1, 2, 1), e(2, 2, 1), e(3, 2, 1), e(2, 3, 3), e(3, 3, 3), e(9, 1, 3)];

  it("ranks by rubrics covered, then total grade", () => {
    const r = repertorize([1, 2, 3], entries);
    expect(r.map((x) => [x.id, x.covered, x.total])).toEqual([
      [2, 3, 3],
      [3, 2, 6],
      [1, 1, 3],
    ]);
    expect(r[0].grades).toEqual([1, 1, 1]);
    expect(r[1].grades).toEqual([0, 3, 3]);
  });

  it("can rank by total grade instead, breaking ties by rubrics covered", () => {
    expect(repertorize([1, 2, 3], entries, "grades").map((x) => x.id)).toEqual([3, 2, 1]);
  });

  it("ignores rubrics outside the case", () => {
    expect(repertorize([2], entries).map((x) => x.id)).toEqual([3, 2]);
  });
});
