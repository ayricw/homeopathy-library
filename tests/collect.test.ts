import { describe, expect, it } from "vitest";
import { excerpt, formatReferences, groupBySource, MAX_ITEMS, parse, toggle, type CollectedItem } from "../src/collect";

const item = (passageId: number, sourceId = "kent", over: Partial<CollectedItem> = {}): CollectedItem => ({
  passageId,
  sourceId,
  title: `Book ${sourceId}`,
  author: "An Author",
  edition: null,
  publicationYear: 1900,
  heading: "Chapter I",
  location: `lines ${passageId}–${passageId + 5}`,
  excerpt: "text",
  addedAt: "2026-10-13T00:00:00Z",
  ...over,
});

describe("collect tray", () => {
  it("toggles an item in and out, newest first", () => {
    const a = toggle([], item(1));
    const b = toggle(a, item(2));
    expect(b.map((i) => i.passageId)).toEqual([2, 1]);
    expect(toggle(b, item(1)).map((i) => i.passageId)).toEqual([2]);
  });

  it("caps the tray size", () => {
    let items: CollectedItem[] = [];
    for (let n = 0; n < MAX_ITEMS + 5; n++) items = toggle(items, item(n));
    expect(items).toHaveLength(MAX_ITEMS);
    expect(items[0].passageId).toBe(MAX_ITEMS + 4);
  });

  it("groups by source in first-collected order", () => {
    const groups = groupBySource([item(1, "a"), item(2, "b"), item(3, "a")]);
    expect(groups.map((g) => [g.sourceId, g.items.map((i) => i.passageId)])).toEqual([
      ["a", [1, 3]],
      ["b", [2]],
    ]);
  });

  it("formats references without empty fields", () => {
    expect(formatReferences([item(4)])).toBe("An Author, Book kent, 1900, Chapter I, lines 4–9");
  });

  it("strips snippet markers and cuts excerpts on a word boundary", () => {
    expect(excerpt("a \u0002match\u0003  here")).toBe("a match here");
    const long = excerpt("word ".repeat(100), 40);
    expect(long.endsWith("…")).toBe(true);
    expect(long.length).toBeLessThanOrEqual(41);
  });

  it("ignores corrupted or malformed stored data", () => {
    expect(parse(null)).toEqual([]);
    expect(parse("not json")).toEqual([]);
    expect(parse('{"a":1}')).toEqual([]);
    expect(parse(JSON.stringify([item(1), { passageId: "x" }, null]))).toEqual([item(1)]);
  });
});
