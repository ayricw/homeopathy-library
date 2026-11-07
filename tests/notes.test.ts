import { describe, expect, it } from "vitest";
import { notesId, notesMetadata, notesSkipReason, notesTitle, pdfPagesToText } from "../shared/notes";

describe("notes import", () => {
  it("builds a title and a valid library id from the file name", () => {
    expect(notesTitle("Arnica_MM.docx")).toBe("Arnica MM");
    expect(notesTitle("Snakes Themes - Copy.pdf")).toBe("Snakes Themes");
    expect(notesId("TOP 50 POLYCHRESTS with keynotes (1).docx")).toBe("notes-top-50-polychrests-with-keynotes");
    const long = notesId("x".repeat(200) + ".pdf");
    expect(long).toMatch(/^[a-z0-9][a-z0-9-]{2,80}$/);
    expect(notesMetadata("Arnica_MM.docx", "SIH").kind).toBe("notes");
  });

  it("leaves out case files and forms but keeps case-taking lessons", () => {
    expect(notesSkipReason("Snake_CASES.pdf")).toMatch(/case/);
    expect(notesSkipReason("Aliah ASD Parasites case.pdf")).toMatch(/case/);
    expect(notesSkipReason("HomeopathyHive_adult_intake.pdf")).toMatch(/form/);
    expect(notesSkipReason("Case Taking Basics.docx")).toBeNull();
    expect(notesSkipReason("Old notes.doc")).toMatch(/Word/);
    expect(notesSkipReason("Arnica_MM.docx")).toBeNull();
  });

  it("marks each PDF page so passages keep page numbers", () => {
    expect(pdfPagesToText(["Arnica\nBruised", "", "Bellis"])).toBe("[Pg 1]\nArnica\nBruised\n\n[Pg 3]\nBellis");
  });
});
