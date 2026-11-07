// Robyn's own notes (Word and PDF course handouts) imported in a batch from the Import page.
// Each file becomes a source of kind "notes" with metadata built from its file name.

/** Where the notes come from. Used as each note's source URL; the file name is in the title. */
export const NOTES_FOLDER_URL = "https://www.dropbox.com/home/Ayric%20Wright/Homeopathy%20Notes%20SIH";

export const NOTES_EXTENSIONS = [".docx", ".pdf", ".txt"];

/** The file name without its extension, with underscores and runs of spaces tidied. */
export function notesTitle(filename: string): string {
  return filename
    .replace(/\.[^.]+$/, "")
    .replace(/[_]+/g, " ")
    .replace(/\s+-\s+Copy$|\s*\(\d+\)$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** A library id for a note, e.g. "notes-arnica-mm". At most 81 characters, as the Worker requires. */
export function notesId(filename: string): string {
  const slug = notesTitle(filename)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 74)
    .replace(/-+$/, "");
  return `notes-${slug || "untitled"}`;
}

/**
 * Why a file should be left out by default, or null. Case files hold real people's details and
 * intake forms and waivers are blank paperwork, so they are not reference material.
 */
export function notesSkipReason(filename: string): string | null {
  const name = notesTitle(filename);
  if (/\bcases?\b(?!\s*(?:tak|analys|manag|energ|study|studies))/i.test(name)) return "Looks like a client case file (real people's details).";
  if (/\b(intake|waiver|consent)\b/i.test(name)) return "A form, not reference material.";
  if (!NOTES_EXTENSIONS.some((ext) => filename.toLowerCase().endsWith(ext))) return "Only Word (.docx), PDF and text files can be read.";
  return null;
}

export function notesMetadata(filename: string, author: string): Record<string, unknown> {
  return {
    id: notesId(filename),
    title: notesTitle(filename),
    author,
    source_url: NOTES_FOLDER_URL,
    attribution: `Course notes, from the file "${filename}".`,
    reuse_terms: "Private study copy for Robyn's practice. Do not share or publish.",
    notes: null,
    kind: "notes",
  };
}

/**
 * Text from a PDF's pages, one page per block with a page marker the passage splitter understands.
 * Lines within a page are joined as the PDF gives them. Pages with no text are skipped.
 */
export function pdfPagesToText(pages: string[]): string {
  return pages
    .map((t, i) => [i + 1, t.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim()] as const)
    .filter(([, t]) => t)
    .map(([n, t]) => `[Pg ${n}]\n${t}`)
    .join("\n\n");
}
