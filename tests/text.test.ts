import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildMatchQuery } from "../shared/query";
import { decodeUtf8, isHeading, reflow, splitPassages } from "../shared/text";

const gutenberg = readFileSync(new URL("./fixtures/sample-gutenberg.txt", import.meta.url), "utf8");
const paged = readFileSync(new URL("./fixtures/sample-paged.txt", import.meta.url), "utf8");

describe("decodeUtf8", () => {
  it("decodes valid UTF-8", () => {
    expect(decodeUtf8(new TextEncoder().encode("café"))).toEqual({ ok: true, text: "café" });
  });
  it("reports invalid UTF-8 instead of replacing characters", () => {
    const r = decodeUtf8(new Uint8Array([0x63, 0x61, 0x66, 0xe9])); // "café" in Latin-1
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/not valid UTF-8/);
  });
});

describe("splitPassages", () => {
  const { passages, issues } = splitPassages(gutenberg, { targetChars: 200 });

  it("every passage is an exact slice of the source text", () => {
    for (const p of passages) expect(gutenberg.slice(p.charStart, p.charEnd)).toBe(p.text);
  });

  it("line numbers point at the passage's first and last lines", () => {
    const lines = gutenberg.split("\n");
    for (const p of passages) {
      expect(p.text.startsWith(lines[p.lineStart - 1])).toBe(true);
      expect(p.text.endsWith(lines[p.lineEnd - 1])).toBe(true);
    }
  });

  it("skips Project Gutenberg header and licence boilerplate", () => {
    const all = passages.map((p) => p.text).join("\n");
    expect(all).not.toMatch(/invented test data/);
    expect(all).not.toMatch(/licen[cs]e boilerplate/);
    expect(all).toMatch(/quillwort/);
  });

  it("keeps all body text (complete import)", () => {
    const words = (s: string) => s.match(/\p{L}+/gu) ?? [];
    const body = gutenberg.slice(gutenberg.indexOf("A Synthetic Test Book.\n"), gutenberg.indexOf("*** END"));
    const headings = ["PREFACE.", "ALPHA EXAMPLE.", "BETA EXAMPLE."];
    let expected = body;
    for (const h of headings) expected = expected.replace(h, "");
    expect(words(passages.map((p) => p.text).join(" "))).toEqual(words(expected));
  });

  it("labels passages with the nearest heading and never crosses one", () => {
    const quill = passages.find((p) => p.text.includes("quillwort"))!;
    expect(quill.section).toBe("ALPHA EXAMPLE.");
    const headache = passages.find((p) => p.text.includes("throbbing headache"))!;
    expect(headache.section).toBe("BETA EXAMPLE.");
    for (const p of passages) expect(p.text).not.toMatch(/EXAMPLE\./);
  });

  it("does not invent page numbers when the text has no page markers", () => {
    for (const p of passages) {
      expect(p.pageStart).toBeNull();
      expect(p.pageEnd).toBeNull();
    }
    expect(issues.some((i) => /no page markers/.test(i.detail))).toBe(true);
  });

  it("is deterministic, so imports can resume", () => {
    expect(splitPassages(gutenberg, { targetChars: 200 })).toEqual(splitPassages(gutenberg, { targetChars: 200 }));
  });

  it("handles Windows line endings with correct offsets", () => {
    const crlf = gutenberg.replace(/\n/g, "\r\n");
    const r = splitPassages(crlf, { targetChars: 200 });
    expect(r.passages.length).toBe(passages.length);
    for (const p of r.passages) expect(crlf.slice(p.charStart, p.charEnd)).toBe(p.text);
  });

  it("flags replacement characters as an encoding warning", () => {
    const r = splitPassages("Some text with a � damaged character.");
    expect(r.issues.some((i) => i.kind === "encoding")).toBe(true);
  });

  it("records an extraction failure for an empty file", () => {
    expect(splitPassages("").issues.some((i) => i.kind === "extraction_failure")).toBe(true);
  });
});

describe("page markers and chapters", () => {
  const { passages } = splitPassages(paged, { targetChars: 1 });
  const find = (s: string) => passages.find((p) => p.text.includes(s))!;

  it("uses explicit page markers only", () => {
    expect(find("First page text").pageStart).toBe("1");
    expect(find("Second page text").pageStart).toBe("2");
    expect(find("Second page text").pageEnd).toBe("3");
    expect(find("Text on page three").pageStart).toBe("3");
  });

  it("tracks chapter headings", () => {
    expect(find("First page text").chapter).toBe("CHAPTER I. ON TESTING");
    expect(find("Text on page three").chapter).toBe("CHAPTER II. AFTERWARDS");
  });
});

describe("isHeading", () => {
  it("accepts short upper-case lines", () => {
    expect(isHeading(["ACALYPHA INDICA."])).toBe(true);
    expect(isHeading(["Chapter 3"])).toBe(true);
  });
  it("rejects ordinary text", () => {
    expect(isHeading(["COMMON NAME, Indian Acalypha, Indian Nettle."])).toBe(false);
    expect(isHeading(["NAT. ORD., Euphorbiaceæ."])).toBe(false);
    expect(isHeading(["A sentence.", "OVER TWO LINES"])).toBe(false);
  });
});

describe("buildMatchQuery", () => {
  it("quotes every term so FTS operators are literal", () => {
    expect(buildMatchQuery("burning pain")).toBe('"burning" "pain"');
    expect(buildMatchQuery("cough OR NEAR(x)")).toBe('"cough" "OR" "NEAR x"');
    expect(buildMatchQuery('text:evil "drop table"')).toBe('"text evil" "drop table"');
  });
  it("supports exact phrases and prefixes", () => {
    expect(buildMatchQuery('"burning sensation"')).toBe('"burning sensation"');
    expect(buildMatchQuery("burn*")).toBe('"burn"*');
  });
  it("returns null for empty input", () => {
    expect(buildMatchQuery('  "" * ')).toBeNull();
  });
});

describe("reflow", () => {
  it("joins wrapped lines but keeps paragraphs", () => {
    expect(reflow("one\ntwo\n\nthree")).toBe("one two\n\nthree");
  });
});
