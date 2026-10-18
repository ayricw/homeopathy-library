// Builds an importable UTF-8 text from a scanned book's OCR on the Internet Archive.
// Internet Archive derives three files for each scanned item, which this reads as given:
//   <id>_hocr_searchtext.txt.gz  the OCR text, one line per OCR paragraph
//   <id>_hocr_pageindex.json.gz  for each scanned leaf, [charStart, charEnd, ...] into that text (code points)
//   <id>_page_numbers.json       for each leaf, the page number printed on it ("" when none was found)
// Each page with a printed number gets a "[Pg N]" marker, which the passage splitter turns into page
// references; a page without one gets "[Unnumbered page]", so its text carries no page number.
// Page numbers are never computed or guessed. The OCR text itself is not corrected.

import { isHeading, type Issue } from "./text";

export const OCR_CONVERTER_VERSION = "ia-ocr-v1";

export interface ScanPage {
  leafNum: number;
  pageNumber: string;
}

export interface ScanText {
  text: string;
  issues: Issue[];
  stats: { leaves: number; numbered: number; unnumbered: number; blank: number; boilerplate: number; watermarks: number; footers: number };
}

// Google's notice on the first leaf of its scans ("This is a digital copy of a book that was preserved...").
const GOOGLE_NOTICE = /digital copy of a book that was preserved for generations|books\.google\.com/i;
// The "Digitized by Google" stamp at the foot of each page, often misread by the OCR ("Digitized by VjOOQ IC").
const WATERMARK = /^\s*Digiti[sz]ed\s+by\b.{0,30}$/i;
const PAGE_NUMBER = /^([0-9]+|[ivxlcdm]+)$/i;

export function buildScanText(searchtext: string, pageindex: unknown, pageNumbers: unknown): ScanText {
  const pages = readPages(pageNumbers);
  if (!Array.isArray(pageindex) || !pageindex.every((p) => Array.isArray(p) && Number.isInteger(p[0]) && Number.isInteger(p[1]))) {
    throw new Error("The page index is not a list of [start, end] offsets.");
  }
  if (pageindex.length !== pages.length) {
    throw new Error(`The page index has ${pageindex.length} leaves but the page-number file has ${pages.length}, so page numbers cannot be matched to text.`);
  }
  // Offsets count Unicode code points, not UTF-16 units.
  const chars = Array.from(searchtext);
  const stats = { leaves: pages.length, numbered: 0, unnumbered: 0, blank: 0, boilerplate: 0, watermarks: 0, footers: 0 };
  const out: string[] = [];

  for (let i = 0; i < pages.length; i++) {
    const [start, end] = pageindex[i] as number[];
    if (start < 0 || end < start || end > chars.length) throw new Error(`Leaf ${pages[i].leafNum} points outside the OCR text.`);
    const raw = chars.slice(start, end).join("");
    if (i < 4 && GOOGLE_NOTICE.test(raw)) {
      stats.boilerplate++;
      continue;
    }
    const lines: string[] = [];
    for (const line of raw.split(/\r?\n/)) {
      const t = line.replace(/\s+$/, "");
      if (!t.trim()) continue;
      if (WATERMARK.test(t)) {
        stats.watermarks++;
        continue;
      }
      lines.push(t);
    }
    if (!lines.length) {
      stats.blank++;
      continue;
    }

    const number = pages[i].pageNumber.trim();
    const numbered = PAGE_NUMBER.test(number);
    if (numbered) stats.numbered++;
    else stats.unnumbered++;
    const marker = numbered ? `[Pg ${number}]` : "[Unnumbered page]";
    // The marker goes at the start of the page's first line that is not a heading, so headings stay
    // headings (in many books the running head, "PHOSPHORUS 781", names the remedy on the page) and
    // the marker stays with the page's own text.
    const at = lines.findIndex((l) => !isHeading([l]));
    if (at < 0) lines.push(marker);
    else lines[at] = `${marker} ${lines[at].trimStart()}`;
    // A printer's mark at the foot of the page ("VOL. II. 49") would read as a heading on its own,
    // so it stays attached to the line above it.
    let page = lines.join("\n\n");
    const last = lines[lines.length - 1];
    if (lines.length > 1 && isHeading([last]) && last.trim().length <= 24 && /\d|^\s*VOL\b/i.test(last)) {
      stats.footers++;
      page = lines.slice(0, -1).join("\n\n") + "\n" + last;
    }
    out.push(page);
  }

  const issues: Issue[] = [
    {
      kind: "uncertain_ocr",
      severity: "warning",
      detail:
        "This text was read from page scans by machine (OCR) and has not been proofread. Words, symbols and abbreviations can be misread; check the scanned page before relying on a passage.",
    },
  ];
  if (stats.unnumbered) {
    issues.push({
      kind: "structure",
      severity: "info",
      detail: `${stats.unnumbered} scanned page(s) with text have no printed page number, so passages from them show no page number.`,
    });
  }
  if (stats.boilerplate || stats.watermarks) {
    issues.push({
      kind: "structure",
      severity: "info",
      detail: `Left out of the text: ${stats.boilerplate} leaf/leaves of the scanner's usage notice and ${stats.watermarks} "Digitized by" stamp line(s).`,
    });
  }
  return { text: out.join("\n\n") + "\n", issues, stats };
}

function readPages(raw: unknown): ScanPage[] {
  const pages = (raw as { pages?: unknown })?.pages;
  if (!Array.isArray(pages)) throw new Error("The page-number file has no list of pages.");
  return pages.map((p, i) => {
    const leafNum = (p as ScanPage)?.leafNum;
    const pageNumber = (p as ScanPage)?.pageNumber;
    if (leafNum !== i + 1 || typeof pageNumber !== "string") throw new Error(`The page-number file's entry ${i + 1} is not in leaf order.`);
    return { leafNum, pageNumber };
  });
}
