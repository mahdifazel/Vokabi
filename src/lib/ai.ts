"use client";

import { canvasToJpegDataUrl } from "./image";
import { getSupabase } from "./supabase";

/**
 * Clients for the server-side AI routes (Gemini first, Groq as fallback,
 * configured in the back office). Every helper returns null whenever AI
 * cannot be used — local-only mode, signed out, no key configured, providers
 * down, or timeout — so callers can fall back to the next on-device step. An
 * empty array is a real answer: the AI looked and found no vocabulary. Never
 * throws.
 */

async function getSessionToken(): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

/** "rate-limited" = the AI providers are busy; retrying in a minute will likely work. */
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

/**
 * Result of a batched backfill request. "rate-limited" = providers busy, try
 * again in a minute; "unavailable" = AI can't be used at all right now
 * (signed out, local-only, AI not configured); null = a transient failure
 * (timeout, network, both providers failing once) worth retrying soon.
 */
export type AiBatchResult<T> = T[] | "rate-limited" | "unavailable" | null;

async function postBatch<T>(
  path: string,
  words: unknown[],
  field: string,
  valid: (item: unknown) => item is T
): Promise<AiBatchResult<T>> {
  try {
    const token = await getSessionToken();
    if (!token) return "unavailable";
    const res = await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ words }),
      signal: AbortSignal.timeout(30_000),
    });
    if (res.status === 429) return "rate-limited";
    // 401 = session rejected, 501/503 = AI not configured on this deployment
    if (res.status === 401 || res.status === 501 || res.status === 503) return "unavailable";
    if (!res.ok) return null;
    const json = (await res.json()) as Record<string, unknown>;
    const list = json[field];
    return (Array.isArray(list) ? list : []).filter(valid);
  } catch {
    return null;
  }
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const nonEmpty = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

/** How many words each /api/ai/examples request may carry (server cap). */
export const AI_EXAMPLE_BATCH = 10;

export interface AiExampleWord {
  german: string;
  english?: string;
  article?: string;
  pos?: string;
}

export interface AiExample {
  german: string;
  example: string;
  exampleEn: string;
}

/** Generate simple example sentences for words that have none. */
export function generateExamplesWithAi(words: AiExampleWord[]): Promise<AiBatchResult<AiExample>> {
  return postBatch("/api/ai/examples", words, "examples", (e): e is AiExample =>
    isObj(e) && typeof e.german === "string" && nonEmpty(e.example) &&
    typeof e.exampleEn === "string"
  );
}

/** How many words each /api/ai/definitions request may carry (server cap). */
export const AI_DEFINITION_BATCH = 10;

export interface AiDefinition {
  german: string;
  definitionDe: string;
}

/** Generate short German definitions for words that have none. */
export function generateDefinitionsWithAi(
  words: AiExampleWord[]
): Promise<AiBatchResult<AiDefinition>> {
  return postBatch("/api/ai/definitions", words, "definitions", (d): d is AiDefinition =>
    isObj(d) && typeof d.german === "string" && nonEmpty(d.definitionDe)
  );
}

/** How many words each /api/ai/persian request may carry (server cap). */
export const AI_PERSIAN_BATCH = 10;

export interface AiPersianWord extends AiExampleWord {
  example?: string;
}

export interface AiPersianTranslation {
  german: string;
  translationFa: string;
  exampleFa?: string;
}

/** Translate words (and their example sentences) into Persian. */
export function generatePersianWithAi(
  words: AiPersianWord[]
): Promise<AiBatchResult<AiPersianTranslation>> {
  return postBatch("/api/ai/persian", words, "translations", (t): t is AiPersianTranslation =>
    isObj(t) && typeof t.german === "string" && nonEmpty(t.translationFa)
  );
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
