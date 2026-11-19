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

export type AiExamplesResult = AiExample[] | "rate-limited" | null;

/** Generate simple example sentences for words that have none. */
export async function generateExamplesWithAi(words: AiExampleWord[]): Promise<AiExamplesResult> {
  try {
    const token = await getSessionToken();
    if (!token) return null;
    const res = await fetch("/api/ai/examples", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ words }),
      signal: AbortSignal.timeout(30_000),
    });
    if (res.status === 429) return "rate-limited";
    if (!res.ok) return null;

    const json = (await res.json()) as { examples?: unknown };
    return (Array.isArray(json.examples) ? json.examples : []).filter(
      (e): e is AiExample =>
        typeof e === "object" && e !== null &&
        typeof (e as AiExample).german === "string" &&
        typeof (e as AiExample).example === "string" &&
        (e as AiExample).example.trim().length > 0 &&
        typeof (e as AiExample).exampleEn === "string"
    );
  } catch {
    return null;
  }
}

/** How many words each /api/ai/definitions request may carry (server cap). */
export const AI_DEFINITION_BATCH = 10;

export interface AiDefinition {
  german: string;
  definitionDe: string;
}

export type AiDefinitionsResult = AiDefinition[] | "rate-limited" | null;

/** Generate short German definitions for words that have none. */
export async function generateDefinitionsWithAi(
  words: AiExampleWord[]
): Promise<AiDefinitionsResult> {
  try {
    const token = await getSessionToken();
    if (!token) return null;
    const res = await fetch("/api/ai/definitions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ words }),
      signal: AbortSignal.timeout(30_000),
    });
    if (res.status === 429) return "rate-limited";
    if (!res.ok) return null;

    const json = (await res.json()) as { definitions?: unknown };
    return (Array.isArray(json.definitions) ? json.definitions : []).filter(
      (d): d is AiDefinition =>
        typeof d === "object" && d !== null &&
        typeof (d as AiDefinition).german === "string" &&
        typeof (d as AiDefinition).definitionDe === "string" &&
        (d as AiDefinition).definitionDe.trim().length > 0
    );
  } catch {
    return null;
  }
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

export type AiPersianResult = AiPersianTranslation[] | "rate-limited" | null;

/** Translate words (and their example sentences) into Persian. */
export async function generatePersianWithAi(
  words: AiPersianWord[]
): Promise<AiPersianResult> {
  try {
    const token = await getSessionToken();
    if (!token) return null;
    const res = await fetch("/api/ai/persian", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ words }),
      signal: AbortSignal.timeout(30_000),
    });
    if (res.status === 429) return "rate-limited";
    if (!res.ok) return null;

    const json = (await res.json()) as { translations?: unknown };
    return (Array.isArray(json.translations) ? json.translations : []).filter(
      (t): t is AiPersianTranslation =>
        typeof t === "object" && t !== null &&
        typeof (t as AiPersianTranslation).german === "string" &&
        typeof (t as AiPersianTranslation).translationFa === "string" &&
        (t as AiPersianTranslation).translationFa.trim().length > 0
    );
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
