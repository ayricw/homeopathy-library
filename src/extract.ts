// Reads the text out of Word and PDF files in the browser. The libraries load only when needed.
// Scanned PDF pages and pictures in Word files are read with text recognition (Tesseract), also in
// the browser, with the recognition program and English data served by the app itself (see vite.config.ts).
import type { Worker as OcrWorker } from "tesseract.js";
import { looksLikeText, pdfPagesToText } from "../shared/notes";

export interface Extracted {
  text: string;
  /** Pages or pictures whose text came from text recognition, so may contain misread words. */
  recognized: number;
}

type Status = (message: string) => void;

/** A page with fewer characters than this is treated as a scan and recognized instead. */
const MIN_PAGE_TEXT = 20;

export async function extractText(file: File, status: Status = () => {}): Promise<Extracted> {
  const name = file.name.toLowerCase();
  const buffer = await file.arrayBuffer();
  let ocr: OcrWorker | null = null;
  const recognize = async (image: HTMLCanvasElement | string) => {
    ocr ??= await (await import("tesseract.js")).createWorker("eng", undefined, {
      workerPath: "/ocr/worker.min.js",
      corePath: "/ocr/",
      langPath: "/ocr/",
    });
    const text = tidy((await ocr.recognize(image)).data.text);
    return looksLikeText(text) ? text : "";
  };
  try {
    if (name.endsWith(".docx")) {
      const mammoth = await import("mammoth");
      const { value } = await mammoth.extractRawText({ arrayBuffer: buffer });
      const text = tidy(value);
      if (text.length >= MIN_PAGE_TEXT) return { text, recognized: 0 };
      // No typed text: the notes are pictures pasted into the document. Read each picture.
      const images: string[] = [];
      await mammoth.convertToHtml(
        { arrayBuffer: buffer },
        {
          convertImage: mammoth.images.imgElement(async (img) => {
            images.push(`data:${img.contentType};base64,${await img.readAsBase64String()}`);
            return { src: "" };
          }),
        },
      );
      const parts: string[] = [];
      for (const [i, src] of images.entries()) {
        status(`Reading picture ${i + 1} of ${images.length} (text recognition)…`);
        parts.push(await recognize(src));
      }
      return { text: parts.filter(Boolean).join("\n\n"), recognized: parts.filter(Boolean).length };
    }
    if (name.endsWith(".pdf")) {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
      const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
      const pages: string[] = [];
      let recognized = 0;
      for (let n = 1; n <= doc.numPages; n++) {
        const page = await doc.getPage(n);
        const content = await page.getTextContent();
        let text = content.items.map((it) => ("str" in it ? it.str + (it.hasEOL ? "\n" : "") : "")).join("");
        if (text.trim().length < MIN_PAGE_TEXT) {
          status(`Reading page ${n} of ${doc.numPages} (text recognition)…`);
          const viewport = page.getViewport({ scale: 2 });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          await page.render({ canvas, canvasContext: canvas.getContext("2d")!, viewport }).promise;
          text = await recognize(canvas);
          if (text) recognized++;
        }
        pages.push(text);
      }
      await doc.destroy();
      return { text: pdfPagesToText(pages), recognized };
    }
    return { text: new TextDecoder("utf-8", { fatal: true }).decode(buffer).trim(), recognized: 0 };
  } finally {
    await (ocr as OcrWorker | null)?.terminate();
  }
}

const tidy = (t: string) => t.replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
