"use client";

import { getSupabase } from "./supabase";

/**
 * Ask the server-side AI route (Groq, configured in the back office) to pull
 * the vocabulary out of raw OCR text.
 *
 * Returns null whenever AI cannot be used — local-only mode, signed out,
 * key not configured, Groq down, timeout, or an empty result — so callers
 * can fall back to the on-device heuristic detection. Never throws.
 */
export async function extractWordsWithAi(rawText: string): Promise<string[] | null> {
  try {
    const supabase = getSupabase();
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return null;

    const res = await fetch("/api/ai/extract-words", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ text: rawText }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) return null;

    const json = (await res.json()) as { words?: unknown };
    const words = Array.isArray(json.words)
      ? json.words.filter((w): w is string => typeof w === "string" && w.trim().length > 0)
      : [];
    // an empty AI answer is treated as a miss so the heuristics get a chance
    return words.length > 0 ? words : null;
  } catch {
    return null;
  }
}
