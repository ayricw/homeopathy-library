import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { defineConfig, type Plugin } from "vite";

// LIBRARY_PERSIST lets the smoke test use throwaway local D1/R2 state.
const persist = process.env.LIBRARY_PERSIST;

// Text recognition (Tesseract) files, served from the app itself under /ocr/ so nothing loads from
// another site: the worker script, the recognition engine (with and without SIMD) and English data.
const require = createRequire(import.meta.url);
const OCR_FILES: Record<string, string> = {
  "worker.min.js": "tesseract.js/dist/worker.min.js",
  "tesseract-core-lstm.wasm.js": "tesseract.js-core/tesseract-core-lstm.wasm.js",
  "tesseract-core-simd-lstm.wasm.js": "tesseract.js-core/tesseract-core-simd-lstm.wasm.js",
  "eng.traineddata.gz": "@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz",
};
const ocrFiles = (): Plugin => ({
  name: "ocr-files",
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const file = req.url?.startsWith("/ocr/") && OCR_FILES[req.url.slice(5)];
      if (!file) return next();
      res.setHeader("content-type", file.endsWith(".js") ? "text/javascript" : "application/octet-stream");
      res.end(readFileSync(require.resolve(file)));
    });
  },
  generateBundle() {
    if (this.environment.name !== "client") return;
    for (const [name, file] of Object.entries(OCR_FILES)) {
      this.emitFile({ type: "asset", fileName: `ocr/${name}`, source: readFileSync(require.resolve(file)) });
    }
  },
});

export default defineConfig({
  plugins: [react(), ocrFiles(), cloudflare(persist ? { persistState: { path: persist } } : {})],
});
