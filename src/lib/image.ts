"use client";

/**
 * Shared photo decode/downscale helpers for the scan pipeline. Both the vision
 * AI path (JPEG upload) and on-device OCR (Tesseract) consume the same
 * downscaled canvas, so the photo is decoded exactly once per scan.
 *
 * Photos are downscaled on a canvas before use. Handing a raw 12 MP File to
 * the wasm OCR worker is the main iOS Safari memory/speed hazard, and the
 * <img> decode path also applies EXIF rotation for free.
 */

export const SCAN_MAX_DIMENSION = 1600;

// keep the upload comfortably under Groq's 4 MB image limit and Vercel's
// ~4.5 MB request body limit
const MAX_DATA_URL_CHARS = 3_500_000;

function scaleToMax(
  source: CanvasImageSource,
  width: number,
  height: number,
  maxDimension: number
): HTMLCanvasElement {
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** Decode the photo (or take the captured frame) downscaled onto a canvas. */
export async function downscaleToCanvas(
  source: File | HTMLCanvasElement,
  maxDimension: number = SCAN_MAX_DIMENSION
): Promise<HTMLCanvasElement> {
  if (source instanceof HTMLCanvasElement) {
    if (Math.max(source.width, source.height) <= maxDimension) return source;
    return scaleToMax(source, source.width, source.height, maxDimension);
  }
  const url = URL.createObjectURL(source);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return scaleToMax(img, img.naturalWidth, img.naturalHeight, maxDimension);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Encode the canvas as a JPEG data URL sized for upload. */
export function canvasToJpegDataUrl(canvas: HTMLCanvasElement, quality = 0.8): string {
  const dataUrl = canvas.toDataURL("image/jpeg", quality);
  if (dataUrl.length <= MAX_DATA_URL_CHARS) return dataUrl;
  return canvas.toDataURL("image/jpeg", 0.6);
}
