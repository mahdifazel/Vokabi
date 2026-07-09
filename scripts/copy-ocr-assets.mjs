/**
 * Copies the Tesseract.js runtime assets from node_modules into public/ocr/
 * so OCR runs fully same-origin (no CDN, service-worker cacheable, offline
 * after first use). Runs on postinstall; public/ocr/ is gitignored.
 */
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const nm = join(root, "node_modules");
const out = join(root, "public", "ocr");

// [source in node_modules, destination in public/ocr]
const assets = [
  ["tesseract.js/dist/worker.min.js", "worker.min.js"],
  // LSTM-only cores; tesseract.js picks the best one for the device at runtime
  ["tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js", "core/tesseract-core-relaxedsimd-lstm.wasm.js"],
  ["tesseract.js-core/tesseract-core-simd-lstm.wasm.js", "core/tesseract-core-simd-lstm.wasm.js"],
  ["tesseract.js-core/tesseract-core-lstm.wasm.js", "core/tesseract-core-lstm.wasm.js"],
  // integerized tessdata_best German model
  ["@tesseract.js-data/deu/4.0.0_best_int/deu.traineddata.gz", "lang/deu.traineddata.gz"],
];

for (const [src, dest] of assets) {
  const to = join(out, dest);
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(join(nm, src), to);
}
console.log(`Copied ${assets.length} OCR assets to public/ocr/`);
