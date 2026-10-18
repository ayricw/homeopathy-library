import { describe, expect, it } from "vitest";
import { buildScanText } from "../shared/ocr";
import { splitPassages } from "../shared/text";

// A small item laid out the way Internet Archive's files are: OCR text with one line per paragraph,
// a page index of code-point offsets per leaf, and the printed page number for each leaf.
function item(leaves: { text: string; page: string }[]) {
  let searchtext = "";
  const pageindex: number[][] = [];
  for (const l of leaves) {
    const start = Array.from(searchtext).length;
    searchtext += l.text;
    pageindex.push([start, Array.from(searchtext).length, 0, 0]);
    searchtext += "\n";
  }
  return { searchtext, pageindex, pageNumbers: { pages: leaves.map((l, i) => ({ leafNum: i + 1, pageNumber: l.page })) } };
}

const leaves = [
  { text: "Google\nThis is a digital copy of a book that was preserved for generations on library shelves.", page: "" },
  { text: "A DICTIONARY OF PRACTICAL MATERIA MEDICA\nBy John Henry Clarke.", page: "" },
  { text: "", page: "" },
  { text: "PHOSPHORUS.\nPhosphorus. The element. Trituration.\nBurning pains everywhere; in the stomach, better from cold drinks.", page: "769" },
  { text: "770 PHOSPHORUS\nMind.—Anxiety, worse at twilight. Désir de compagnie.\nDigitized by VjOOQ IC", page: "770" },
  { text: "Plate showing the plant.", page: "" },
  { text: "PHYTOLACCA.\nPain in the throat, worse from hot drinks.\nVOL. II. 49", page: "771" },
];

describe("buildScanText", () => {
  const { searchtext, pageindex, pageNumbers } = item(leaves);
  const scan = buildScanText(searchtext, pageindex, pageNumbers);

  it("marks each page with its printed number and nothing else", () => {
    expect(scan.text).toContain("PHOSPHORUS.\n\n[Pg 769] Phosphorus. The element.");
    expect(scan.text).toContain("770 PHOSPHORUS\n\n[Pg 770] Mind.—Anxiety");
    expect(scan.text).toContain("[Unnumbered page] Plate showing the plant.");
    expect(scan.text).toContain("PHYTOLACCA.\n\n[Pg 771] Pain in the throat, worse from hot drinks.\nVOL. II. 49\n");
    expect(scan.stats).toMatchObject({ leaves: 7, numbered: 3, unnumbered: 2, blank: 1, boilerplate: 1, watermarks: 1, footers: 1 });
  });

  it("leaves out Google's notice and the Digitized-by stamp, and keeps the OCR text otherwise as given", () => {
    expect(scan.text).not.toMatch(/digital copy|Digitized/);
    expect(scan.text).toContain("Désir de compagnie.");
    expect(scan.issues[0].kind).toBe("uncertain_ocr");
  });

  it("gives passages page numbers only from printed numbers, and none on unnumbered pages", () => {
    const { passages } = splitPassages(scan.text, { targetChars: 1 });
    const page = (s: string) => passages.find((p) => p.text.includes(s));
    expect(page("By John Henry Clarke")).toMatchObject({ pageStart: null, pageEnd: null });
    expect(page("Burning pains")).toMatchObject({ section: "PHOSPHORUS.", pageStart: "769" });
    expect(page("Anxiety")).toMatchObject({ section: "770 PHOSPHORUS", pageStart: "770", pageEnd: "770" });
    expect(page("Plate showing")).toMatchObject({ pageStart: null, pageEnd: null });
    expect(page("Pain in the throat")).toMatchObject({ section: "PHYTOLACCA.", pageStart: "771" });
    expect(passages.some((p) => p.section?.startsWith("VOL"))).toBe(false);
  });

  it("reads offsets as code points", () => {
    const astral = item([
      { text: "𝔄 symbol first.", page: "1" },
      { text: "Second page.", page: "2" },
    ]);
    const t = buildScanText(astral.searchtext, astral.pageindex, astral.pageNumbers).text;
    expect(t).toBe("[Pg 1] 𝔄 symbol first.\n\n[Pg 2] Second page.\n");
  });

  it("refuses files whose leaves do not line up", () => {
    expect(() => buildScanText(searchtext, pageindex.slice(1), pageNumbers)).toThrow(/cannot be matched/);
    expect(() => buildScanText(searchtext, pageindex, { pages: [{ leafNum: 2, pageNumber: "" }] })).toThrow();
  });
});
