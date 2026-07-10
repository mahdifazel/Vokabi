"use client";

/**
 * On-device OCR for the photo scan feature, built on Tesseract.js.
 *
 * All runtime assets (worker, wasm core, German model) are served same-origin
 * from /ocr/ (copied there by scripts/copy-ocr-assets.mjs on postinstall), so
 * nothing goes through a CDN and repeat scans work offline: the service worker
 * caches the scripts and Tesseract itself caches the un-gzipped language data
 * in IndexedDB after the first download (~5 MB once per device).
 *
 * Quirks encoded here:
 * - Photos are downscaled on a canvas before recognition. Handing a raw 12 MP
 *   File to the wasm worker is the main iOS Safari memory/speed hazard, and
 *   the <img> decode path also applies EXIF rotation for free.
 * - The logger can only be attached at createWorker time, so progress goes
 *   through a module-level callback that each recognize call swaps in.
 * - Recognize calls are serialized: the singleton worker is reusable, but
 *   concurrent calls would interleave progress output.
 */

import type { Worker } from "tesseract.js";

export type OcrProgress =
  | { phase: "preparing" }
  | { phase: "recognizing"; progress: number }
  | { phase: "analyzing" };

export interface OcrResult {
  /** Every recognized line as-is, for AI analysis. */
  rawText: string;
  /** Heuristically cleaned candidate lines, the non-AI fallback. */
  lines: string[];
}

const MAX_DIMENSION = 1600;
const MIN_LINE_CONFIDENCE = 40;
const MIN_LETTERS = 2;
const MIN_LETTER_RATIO = 0.5;

let workerPromise: Promise<Worker> | null = null;
let progressCb: ((p: OcrProgress) => void) | null = null;
let inFlight: Promise<OcrResult> = Promise.resolve({ rawText: "", lines: [] });

export function ocrSupported(): boolean {
  return (
    typeof window !== "undefined" && "Worker" in window && "WebAssembly" in window
  );
}

async function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      // dynamic import keeps tesseract.js out of the main bundle
      const { createWorker } = await import("tesseract.js");
      return createWorker("deu", 1, {
        workerPath: "/ocr/worker.min.js",
        corePath: "/ocr/core", // directory; the lib picks the right core file
        langPath: "/ocr/lang",
        logger: (m) => {
          if (!progressCb) return;
          if (m.status === "recognizing text") {
            progressCb({ phase: "recognizing", progress: m.progress });
          } else {
            progressCb({ phase: "preparing" });
          }
        },
      });
    })();
    // a failed init (e.g. offline first run) must be retryable
    workerPromise.catch(() => {
      workerPromise = null;
    });
  }
  return workerPromise;
}

function scaleToMax(source: CanvasImageSource, width: number, height: number): HTMLCanvasElement {
  const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** Decode the photo (or take the captured frame) downscaled onto a canvas. */
async function toRecognizableCanvas(source: File | HTMLCanvasElement): Promise<HTMLCanvasElement> {
  if (source instanceof HTMLCanvasElement) {
    if (Math.max(source.width, source.height) <= MAX_DIMENSION) return source;
    return scaleToMax(source, source.width, source.height);
  }
  const url = URL.createObjectURL(source);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return scaleToMax(img, img.naturalWidth, img.naturalHeight);
  } finally {
    URL.revokeObjectURL(url);
  }
}

const LETTER_RE = /[A-Za-zÄÖÜäöüß]/g;

/** Filter OCR noise and join hyphenated line breaks; keeps articles and bullets
 *  intact (parseInput strips bullets and extracts der/die/das downstream). */
function cleanupLines(lines: { text: string; confidence: number }[]): string[] {
  const kept: string[] = [];
  for (const line of lines) {
    const text = line.text.trim();
    if (!text) continue;
    if (line.confidence < MIN_LINE_CONFIDENCE) continue;
    const letters = text.match(LETTER_RE)?.length ?? 0;
    if (letters < MIN_LETTERS) continue;
    const dense = text.replace(/\s/g, "");
    if (dense.length > 0 && letters / dense.length < MIN_LETTER_RATIO) continue;

    const prev = kept[kept.length - 1];
    if (prev?.endsWith("-") && /^[a-zäöüß]/.test(text)) {
      kept[kept.length - 1] = prev.slice(0, -1) + text;
    } else {
      kept.push(text);
    }
  }
  return kept;
}

/**
 * Recognize German text in a photo (picked file or captured camera frame).
 * Returns the raw recognized text (for AI analysis) plus cleaned candidate
 * lines, one entry per printed line (a full sentence stays a single entry),
 * used when AI is unavailable. Throws when recognition itself fails
 * (asset download, decode error).
 */
export async function recognizeGerman(
  source: File | HTMLCanvasElement,
  onProgress?: (p: OcrProgress) => void
): Promise<OcrResult> {
  const run = async (): Promise<OcrResult> => {
    progressCb = onProgress ?? null;
    try {
      onProgress?.({ phase: "preparing" });
      const canvas = await toRecognizableCanvas(source);
      const worker = await getWorker();
      const { data } = await worker.recognize(canvas, {}, { blocks: true, text: false });
      const rawLines = (data.blocks ?? [])
        .flatMap((b) => b.paragraphs)
        .flatMap((p) => p.lines)
        .map((l) => ({ text: l.text, confidence: l.confidence }));
      const rawText = rawLines
        .map((l) => l.text.trim())
        .filter(Boolean)
        .join("\n");
      return { rawText, lines: cleanupLines(rawLines) };
    } finally {
      progressCb = null;
    }
  };
  // serialize scans; a previous failure must not block the next one
  const result = inFlight.catch(() => ({ rawText: "", lines: [] })).then(run);
  inFlight = result;
  return result;
}
