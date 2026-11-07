// Reads the text out of Word and PDF files in the browser. The libraries load only when needed.
import { pdfPagesToText } from "../shared/notes";

export async function extractText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  const buffer = await file.arrayBuffer();
  if (name.endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const { value } = await mammoth.extractRawText({ arrayBuffer: buffer });
    return value.replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  }
  if (name.endsWith(".pdf")) {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
    const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
    const pages: string[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const content = await (await doc.getPage(n)).getTextContent();
      pages.push(content.items.map((it) => ("str" in it ? it.str + (it.hasEOL ? "\n" : "") : "")).join(""));
    }
    await doc.destroy();
    return pdfPagesToText(pages);
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(buffer).trim();
}
