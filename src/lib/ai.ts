"use client";

import { canvasToJpegDataUrl } from "./image";
import { getSupabase } from "./supabase";

/**
 * Clients for the server-side AI routes (Groq, configured in the back
 * office). Every helper returns null whenever AI cannot be used — local-only
 * mode, signed out, key not configured, Groq down, or timeout — so callers
 * can fall back to the next on-device step. An empty array is a real answer:
 * the AI looked and found no vocabulary. Never throws.
 */

async function getSessionToken(): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

/** "rate-limited" = Groq is busy; retrying in a minute will likely work. */
export type AiWordsResult = string[] | "rate-limited" | null;

async function postForWords(
  path: string,
  token: string,
  body: unknown,
  timeoutMs: number
): Promise<AiWordsResult> {
  const res = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (res.status === 429) return "rate-limited";
  if (!res.ok) return null;

  const json = (await res.json()) as { words?: unknown };
  return Array.isArray(json.words)
    ? json.words.filter((w): w is string => typeof w === "string" && w.trim().length > 0)
    : [];
}

/** Pull the vocabulary out of raw OCR text. */
export async function extractWordsWithAi(rawText: string): Promise<AiWordsResult> {
  try {
    const token = await getSessionToken();
    if (!token) return null;
    return await postForWords("/api/ai/extract-words", token, { text: rawText }, 25_000);
  } catch {
    return null;
  }
}

/** Pull the vocabulary straight out of a scanned photo via a vision model. */
export async function extractWordsFromImageWithAi(
  canvas: HTMLCanvasElement
): Promise<AiWordsResult> {
  try {
    // session check before encoding: local-only/signed-out scans skip the
    // JPEG work entirely and go straight to on-device OCR
    const token = await getSessionToken();
    if (!token) return null;
    const image = canvasToJpegDataUrl(canvas);
    return await postForWords("/api/ai/extract-words-image", token, { image }, 30_000);
  } catch {
    return null;
  }
}
