import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { serviceClient } from "@/lib/admin/server";

/**
 * Shared plumbing for the /api/ai/* routes (available to any signed-in user,
 * unlike /api/admin/*). The client treats every non-200 response as "AI
 * unavailable" and falls back to on-device processing, so failures here only
 * need the right status code, not a recoverable payload.
 */

export const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile";
export const DEFAULT_GROQ_VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";
export const MAX_WORDS = 20;

/** Verify the caller's Supabase session; any signed-in user passes. */
export async function authenticateUser(
  req: Request
): Promise<{ svc: SupabaseClient } | { error: NextResponse }> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { error: NextResponse.json({ error: "AI is not configured" }, { status: 501 }) };
  }
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) {
    return { error: NextResponse.json({ error: "Not signed in" }, { status: 401 }) };
  }
  const svc = serviceClient();
  const { data, error } = await svc.auth.getUser(token);
  if (error || !data.user) {
    return { error: NextResponse.json({ error: "Invalid session" }, { status: 401 }) };
  }
  return { svc };
}

export interface GroqSettings {
  apiKey: string;
  model: string;
  visionModel: string;
}

/** Read the Groq key + models from app_settings (managed in the back office). */
export async function loadGroqSettings(
  svc: SupabaseClient
): Promise<GroqSettings | { error: NextResponse }> {
  const { data: rows, error } = await svc
    .from("app_settings")
    .select("key, value")
    .in("key", ["groq_api_key", "groq_model", "groq_vision_model"]);
  if (error) {
    return { error: NextResponse.json({ error: "Settings unavailable" }, { status: 503 }) };
  }
  const settings = new Map(
    (rows ?? []).map((r: { key: string; value: string }) => [r.key, r.value])
  );
  const apiKey = settings.get("groq_api_key");
  if (!apiKey) {
    return { error: NextResponse.json({ error: "AI is not configured" }, { status: 503 }) };
  }
  return {
    apiKey,
    model: settings.get("groq_model") ?? DEFAULT_GROQ_MODEL,
    visionModel: settings.get("groq_vision_model") ?? DEFAULT_GROQ_VISION_MODEL,
  };
}

type GroqMessageContent =
  | string
  | ({ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } })[];

/**
 * Call Groq chat completions and return the model's message content, or a
 * ready 502 response when Groq answers non-OK. Throws on network failure or
 * timeout (callers map that to their own 502).
 */
export async function callGroqChat(
  apiKey: string,
  body: {
    model: string;
    messages: { role: "system" | "user"; content: GroqMessageContent }[];
    max_tokens: number;
  },
  timeoutMs: number
): Promise<{ content: string } | { error: NextResponse }> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...body,
      temperature: 0,
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
  if (!res.ok) {
    return {
      error: NextResponse.json({ error: `Groq error (${res.status})` }, { status: 502 }),
    };
  }
  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return { content: json.choices?.[0]?.message?.content ?? "" };
}

/** Parse the model's {"words": [...]} JSON into a deduped, capped word list. */
export function parseWordList(content: string): string[] {
  const parsed = JSON.parse(content) as { words?: unknown };
  const seen = new Set<string>();
  const words: string[] = [];
  for (const entry of Array.isArray(parsed.words) ? parsed.words : []) {
    if (typeof entry !== "string") continue;
    const word = entry.trim();
    if (!word || seen.has(word.toLowerCase())) continue;
    seen.add(word.toLowerCase());
    words.push(word);
    if (words.length >= MAX_WORDS) break;
  }
  return words;
}
