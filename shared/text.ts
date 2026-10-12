// Pure text-processing helpers shared by the import CLI and the Worker.
// Everything here is deterministic: the same input text always yields the
// same passages, which is what makes imports resumable and verifiable.

export const PARSER_VERSION = "text-v1";

export interface Passage {
  ordinal: number;
  chapter: string | null;
  section: string | null;
  charStart: number; // offset into the extracted text (UTF-16 code units)
  charEnd: number; // exclusive
  lineStart: number; // 1-based line numbers in the extracted text
  lineEnd: number;
  pageStart: string | null; // only from explicit page markers in the text
  pageEnd: string | null;
  text: string; // exactly extractedText.slice(charStart, charEnd)
}

export interface Issue {
  kind: "encoding" | "structure" | "extraction_failure" | "uncertain_ocr";
  severity: "info" | "warning" | "error";
  detail: string;
  location?: string;
}

export interface SplitResult {
  passages: Passage[];
  issues: Issue[];
  body: { charStart: number; charEnd: number; lineStart: number; lineEnd: number };
}

export interface DecodeResult {
  ok: boolean;
  text?: string;
  error?: string;
}

/** Strict UTF-8 decode. Invalid byte sequences are an extraction failure, never silently replaced. */
export function decodeUtf8(bytes: Uint8Array): DecodeResult {
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return { ok: true, text };
  } catch {
    return { ok: false, error: "File is not valid UTF-8. Convert it to UTF-8 (or wait for PDF/OCR support) and import again." };
  }
}

export async function sha256Hex(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

interface Line {
  text: string;
  start: number;
  end: number; // exclusive, excludes the newline
  number: number;
}

function toLines(text: string): Line[] {
  const lines: Line[] = [];
  const re = /\r\n|\n|\r/g;
  let start = 0;
  let number = 1;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    lines.push({ text: text.slice(start, m.index), start, end: m.index, number: number++ });
    start = m.index + m[0].length;
  }
  if (start < text.length) lines.push({ text: text.slice(start), start, end: text.length, number });
  return lines;
}

const GUTENBERG_START = /^\s*\*{3}\s*START OF (THE|THIS) PROJECT GUTENBERG E(BOOK|TEXT)/i;
const GUTENBERG_END = /^\s*\*{3}\s*END OF (THE|THIS) PROJECT GUTENBERG E(BOOK|TEXT)/i;

// Explicit page markers as used in transcriptions, e.g. "[Pg 12]", "[Page 12]", "[p. xii]".
const PAGE_MARKER = /\[(?:Pg|Page|p\.)\s*([0-9]+|[ivxlcdm]+)\]/gi;

const CHAPTER_HEADING = /^(CHAPTER|PART|BOOK|LECTURE|SECTION)\b[\s.:]+[\dIVXLCDM]+\b/i;

/** A short, standalone, mostly upper-case line, or a "CHAPTER 3"-style line. */
export function isHeading(paragraphLines: string[]): boolean {
  if (paragraphLines.length !== 1) return false;
  const t = paragraphLines[0].trim();
  if (t.length === 0 || t.length > 80) return false;
  if (CHAPTER_HEADING.test(t)) return true;
  if (/^\[(?:Pg|Page|p\.)/i.test(t)) return false;
  const letters = t.match(/\p{L}/gu) ?? [];
  if (letters.length < 3) return false;
  const upper = letters.filter((c) => c === c.toUpperCase() && c !== c.toLowerCase()).length;
  return upper / letters.length >= 0.85;
}

export interface SplitOptions {
  targetChars?: number; // start a new passage once this length is reached
  maxChars?: number; // hard cap for a passage built from several paragraphs
}

/**
 * Split extracted text into passages. Passages never cross a heading, keep
 * exact offsets into the source text, and only carry page numbers when the
 * text itself contains page markers.
 */
export function splitPassages(text: string, opts: SplitOptions = {}): SplitResult {
  const targetChars = opts.targetChars ?? 900;
  const maxChars = opts.maxChars ?? 2000;
  const issues: Issue[] = [];
  const lines = toLines(text);

  // Limit to the book body when Project Gutenberg boilerplate is present.
  let first = 0;
  let last = lines.length - 1;
  const startIdx = lines.findIndex((l) => GUTENBERG_START.test(l.text));
  if (startIdx >= 0) first = startIdx + 1;
  const endIdx = lines.findIndex((l, i) => i > first && GUTENBERG_END.test(l.text));
  if (endIdx >= 0) last = endIdx - 1;
  if (startIdx >= 0 && endIdx < 0) {
    issues.push({ kind: "structure", severity: "warning", detail: "Found a Project Gutenberg start marker but no end marker; imported to end of file." });
  }

  // Group lines into paragraphs (runs of non-blank lines).
  type Para = { lines: Line[] };
  const paras: Para[] = [];
  let cur: Line[] = [];
  for (let i = first; i <= last; i++) {
    const l = lines[i];
    if (l.text.trim() === "") {
      if (cur.length) paras.push({ lines: cur });
      cur = [];
    } else cur.push(l);
  }
  if (cur.length) paras.push({ lines: cur });

  const passages: Passage[] = [];
  let chapter: string | null = null;
  let section: string | null = null;
  let currentPage: string | null = null; // page in effect, from the last marker seen
  let headingCount = 0;
  let markerCount = 0;

  let group: Line[] = [];
  let groupPageStart: string | null = null;

  const flush = () => {
    if (!group.length) return;
    const charStart = group[0].start;
    const charEnd = group[group.length - 1].end;
    passages.push({
      ordinal: passages.length,
      chapter,
      section,
      charStart,
      charEnd,
      lineStart: group[0].number,
      lineEnd: group[group.length - 1].number,
      pageStart: groupPageStart,
      pageEnd: currentPage,
      text: text.slice(charStart, charEnd),
    });
    group = [];
  };

  const groupLength = () => (group.length ? group[group.length - 1].end - group[0].start : 0);

  for (const p of paras) {
    const raw = p.lines.map((l) => l.text);
    if (isHeading(raw)) {
      flush();
      const h = raw[0].trim().replace(/\s+/g, " ");
      headingCount++;
      if (CHAPTER_HEADING.test(h)) {
        chapter = h;
        section = null;
      } else section = h;
      continue;
    }

    // Split very long paragraphs on line boundaries so passages stay readable.
    const chunks: Line[][] = [];
    let chunk: Line[] = [];
    for (const l of p.lines) {
      if (chunk.length && l.end - chunk[0].start > maxChars) {
        chunks.push(chunk);
        chunk = [];
      }
      chunk.push(l);
    }
    if (chunk.length) chunks.push(chunk);

    for (const c of chunks) {
      const len = c[c.length - 1].end - c[0].start;
      if (group.length && (groupLength() >= targetChars || groupLength() + len > maxChars)) flush();
      if (!group.length) {
        // A passage that opens with a page marker starts on that page.
        const lead = c[0].text.trimStart().match(/^\[(?:Pg|Page|p\.)\s*([0-9]+|[ivxlcdm]+)\]/i);
        groupPageStart = lead ? lead[1] : currentPage;
      }
      group.push(...c);
      // Advance the page counter past any markers inside this chunk.
      for (const l of c) {
        for (const m of l.text.matchAll(PAGE_MARKER)) {
          markerCount++;
          currentPage = m[1];
        }
      }
    }
  }
  flush();

  if (passages.length === 0) {
    issues.push({ kind: "extraction_failure", severity: "error", detail: "No text passages were found in the file." });
  }
  if (headingCount === 0) {
    issues.push({ kind: "structure", severity: "info", detail: "No chapter or section headings were detected; results will show line numbers only." });
  }
  if (markerCount === 0) {
    issues.push({ kind: "structure", severity: "info", detail: "The text contains no page markers, so no page numbers are recorded." });
  }
  const replacement = (text.match(/�/g) ?? []).length;
  if (replacement) {
    issues.push({ kind: "encoding", severity: "warning", detail: `Text contains ${replacement} Unicode replacement character(s), which usually means damage before import.` });
  }

  const bodyFirst = lines[first];
  const bodyLast = lines[last];
  return {
    passages,
    issues,
    body: {
      charStart: bodyFirst?.start ?? 0,
      charEnd: bodyLast?.end ?? 0,
      lineStart: bodyFirst?.number ?? 0,
      lineEnd: bodyLast?.number ?? 0,
    },
  };
}

/** Join hard-wrapped lines for display while keeping paragraph breaks. */
export function reflow(text: string): string {
  return text
    .split(/(?:\r?\n){2,}/)
    .map((para) => para.replace(/\s*\r?\n\s*/g, " ").trim())
    .join("\n\n");
}
