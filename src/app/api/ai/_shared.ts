import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { serviceClient } from "@/lib/admin/server";
import { isSentence, MAX_SCAN_SENTENCES, MAX_SCAN_WORDS } from "@/lib/scan-rules";

/**
 * Shared plumbing for the /api/ai/* routes (available to any signed-in user,
 * unlike /api/admin/*). The client treats every non-200 response as "AI
 * unavailable" and falls back to on-device processing, so failures here only
 * need the right status code, not a recoverable payload.
 */

export const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile";
// llama-4-scout was deprecated by Groq (shutdown 2026-07-17); qwen3.6 is their
// recommended vision replacement
export const DEFAULT_GROQ_VISION_MODEL = "qwen/qwen3.6-27b";
// multimodal, so one model id covers both the photo scan and OCR cleanup
export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

/** The Gemini key can come from the env (set in Vercel) as well as app_settings. */
export function geminiEnvKey(): string | undefined {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || undefined;
}

/**
 * Qwen models on Groq default to thinking mode, whose reasoning tokens count
 * against max_tokens and can starve the JSON answer; turn it off. Other
 * models reject the parameter, so it is only sent where it applies.
 */
export function reasoningParams(model: string): { reasoning_effort?: "none" } {
  return model.startsWith("qwen/") ? { reasoning_effort: "none" } : {};
}

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

export interface AiSettings {
  gemini: { apiKey: string; model: string } | null;
  groq: { apiKey: string; model: string; visionModel: string } | null;
}

/**
 * Read the provider keys + models from app_settings (managed in the back
 * office). A Gemini key saved there overrides the env var; at least one
 * provider must be configured.
 */
export async function loadAiSettings(
  svc: SupabaseClient
): Promise<AiSettings | { error: NextResponse }> {
  const { data: rows, error } = await svc
    .from("app_settings")
    .select("key, value")
    .in("key", [
      "gemini_api_key",
      "gemini_model",
      "groq_api_key",
      "groq_model",
      "groq_vision_model",
    ]);
  if (error) {
    return { error: NextResponse.json({ error: "Settings unavailable" }, { status: 503 }) };
  }
  const settings = new Map(
    (rows ?? []).map((r: { key: string; value: string }) => [r.key, r.value])
  );
  const geminiKey = settings.get("gemini_api_key") ?? geminiEnvKey();
  const groqKey = settings.get("groq_api_key");
  if (!geminiKey && !groqKey) {
    return { error: NextResponse.json({ error: "AI is not configured" }, { status: 503 }) };
  }
  return {
    gemini: geminiKey
      ? { apiKey: geminiKey, model: settings.get("gemini_model") ?? DEFAULT_GEMINI_MODEL }
      : null,
    groq: groqKey
      ? {
          apiKey: groqKey,
          model: settings.get("groq_model") ?? DEFAULT_GROQ_MODEL,
          visionModel: settings.get("groq_vision_model") ?? DEFAULT_GROQ_VISION_MODEL,
        }
      : null,
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
    reasoning_effort?: "none";
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
    // pass rate limits through so the client can tell the user to retry
    const status = res.status === 429 ? 429 : 502;
    return {
      error: NextResponse.json({ error: `Groq error (${res.status})` }, { status }),
    };
  }
  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return { content: json.choices?.[0]?.message?.content ?? "" };
}

type GeminiPart = { text: string } | { inline_data: { mime_type: string; data: string } };

/**
 * Gemini 2.5 models think by default and the reasoning tokens count against
 * maxOutputTokens, so thinking is turned off (same idea as reasoningParams
 * for Qwen on Groq). Other Gemini generations reject the field.
 */
function geminiThinkingConfig(model: string): { thinkingConfig?: { thinkingBudget: 0 } } {
  return model.startsWith("gemini-2.5") ? { thinkingConfig: { thinkingBudget: 0 } } : {};
}

/**
 * Call Gemini generateContent and return the model's text, or a ready error
 * response when Gemini answers non-OK (429 passes through, everything else
 * becomes 502). Throws on network failure or timeout.
 */
export async function callGemini(
  apiKey: string,
  model: string,
  parts: GeminiPart[],
  timeoutMs: number
): Promise<{ content: string } | { error: NextResponse }> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 4096,
          responseMimeType: "application/json",
          ...geminiThinkingConfig(model),
        },
      }),
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    }
  );
  if (!res.ok) {
    const status = res.status === 429 ? 429 : 502;
    return {
      error: NextResponse.json({ error: `Gemini error (${res.status})` }, { status }),
    };
  }
  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const content = (json.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p.text ?? "")
    .join("");
  return { content };
}

export type ExtractionInput =
  | { kind: "image"; prompt: string; image: string } // image = data URL
  | { kind: "text"; prompt: string; text: string };

function geminiParts(input: ExtractionInput): GeminiPart[] {
  if (input.kind === "text") {
    return [{ text: `${input.prompt}\n\nOCR text:\n${input.text}` }];
  }
  const match = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(input.image);
  if (!match) throw new Error("unreachable: image validated by the route");
  return [{ text: input.prompt }, { inline_data: { mime_type: match[1], data: match[2] } }];
}

/**
 * Run the provider chain: Gemini first, Groq as fallback. Any Gemini failure
 * (not configured, HTTP error, timeout, unparseable output) moves on to Groq;
 * when both fail the client gets a 429 if either provider was rate limited
 * (retrying may help) and a 502 otherwise, and falls back to on-device OCR.
 * Timeouts are budgeted so a slow Gemini still leaves Groq room inside the
 * client's overall request timeout.
 */
export async function extractWordsViaProviders(
  svc: SupabaseClient,
  input: ExtractionInput
): Promise<NextResponse> {
  const settings = await loadAiSettings(svc);
  if ("error" in settings) return settings.error;

  let rateLimited = false;

  if (settings.gemini) {
    try {
      const result = await callGemini(
        settings.gemini.apiKey,
        settings.gemini.model,
        geminiParts(input),
        input.kind === "image" ? 15_000 : 12_000
      );
      if ("error" in result) {
        if (result.error.status === 429) rateLimited = true;
      } else {
        // provider is diagnostic only; the client ignores it
        return NextResponse.json({ words: parseWordList(result.content), provider: "gemini" });
      }
    } catch {
      // network failure, timeout or unparseable model output: try Groq
    }
  }

  if (settings.groq) {
    const model = input.kind === "image" ? settings.groq.visionModel : settings.groq.model;
    try {
      const result = await callGroqChat(
        settings.groq.apiKey,
        {
          model,
          max_tokens: 2048,
          ...reasoningParams(model),
          messages:
            input.kind === "image"
              ? [
                  {
                    role: "user",
                    content: [
                      { type: "text", text: input.prompt },
                      { type: "image_url", image_url: { url: input.image } },
                    ],
                  },
                ]
              : [
                  { role: "system", content: input.prompt },
                  { role: "user", content: input.text },
                ],
        },
        input.kind === "image" ? 12_000 : 10_000
      );
      if ("error" in result) {
        if (result.error.status === 429) rateLimited = true;
      } else {
        return NextResponse.json({ words: parseWordList(result.content), provider: "groq" });
      }
    } catch {
      // network failure, timeout or unparseable model output
    }
  }

  return NextResponse.json(
    { error: rateLimited ? "AI is rate limited" : "AI analysis failed" },
    { status: rateLimited ? 429 : 502 }
  );
}

/**
 * Parse the model's {"words": [...]} JSON into a deduped word list, capped
 * separately per kind: MAX_SCAN_WORDS vocabulary items, MAX_SCAN_SENTENCES
 * example sentences.
 */
export function parseWordList(content: string): string[] {
  // tolerate models that wrap the JSON in think tags or markdown fences
  const cleaned = content.replace(/<think>[\s\S]*?<\/think>/g, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  const json = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
  const parsed = JSON.parse(json) as { words?: unknown };
  const seen = new Set<string>();
  const words: string[] = [];
  let wordCount = 0;
  let sentenceCount = 0;
  for (const entry of Array.isArray(parsed.words) ? parsed.words : []) {
    if (typeof entry !== "string") continue;
    const word = entry.trim();
    if (!word || seen.has(word.toLowerCase())) continue;
    if (isSentence(word)) {
      if (sentenceCount >= MAX_SCAN_SENTENCES) continue;
      sentenceCount++;
    } else {
      if (wordCount >= MAX_SCAN_WORDS) continue;
      wordCount++;
    }
    seen.add(word.toLowerCase());
    words.push(word);
  }
  return words;
}
