import { NextResponse } from "next/server";
import { serviceClient } from "@/lib/admin/server";

/**
 * Extracts German vocabulary from raw OCR text using the Groq API (key
 * configured in the back office and stored in app_settings). Available to any
 * signed-in user. The client treats every non-200 response as "AI unavailable"
 * and falls back to the on-device heuristic word detection, so failures here
 * only need the right status code, not a recoverable payload.
 */

const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile";
const MAX_INPUT_CHARS = 4000;
const MAX_WORDS = 20;

const SYSTEM_PROMPT = `You clean up OCR output from photos of German vocabulary lists, textbook pages and notes. Extract the German vocabulary entries a learner would save, and respond ONLY with JSON in the form {"words": ["...", "..."]}.

Rules:
- Only include words and sentences that actually appear in the text; never invent entries.
- Fix obvious OCR misreadings (e.g. "Hav5" -> "Haus", "0" read as "O") but do not otherwise rewrite.
- For nouns, keep the article (der/die/das) when it appears next to the noun; do not add articles that are not in the text.
- Keep a full example sentence as one single entry.
- Drop translations in other languages, page numbers, chapter headers, exercise instructions and OCR noise.
- No duplicates. At most ${MAX_WORDS} entries.
- If the text contains no German vocabulary, respond with {"words": []}.`;

function unauthorized(message: string) {
  return NextResponse.json({ error: message }, { status: 401 });
}

export async function POST(req: Request) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "AI is not configured" }, { status: 501 });
  }

  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return unauthorized("Not signed in");
  const svc = serviceClient();
  const { data: userData, error: userError } = await svc.auth.getUser(token);
  if (userError || !userData.user) return unauthorized("Invalid session");

  const body = (await req.json().catch(() => ({}))) as { text?: string };
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) {
    return NextResponse.json({ error: "No text to analyze" }, { status: 400 });
  }

  const { data: rows, error } = await svc
    .from("app_settings")
    .select("key, value")
    .in("key", ["groq_api_key", "groq_model"]);
  if (error) {
    return NextResponse.json({ error: "Settings unavailable" }, { status: 503 });
  }
  const settings = new Map((rows ?? []).map((r: { key: string; value: string }) => [r.key, r.value]));
  const apiKey = settings.get("groq_api_key");
  if (!apiKey) {
    return NextResponse.json({ error: "AI is not configured" }, { status: 503 });
  }
  const model = settings.get("groq_model") ?? DEFAULT_GROQ_MODEL;

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 1024,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: text.slice(0, MAX_INPUT_CHARS) },
        ],
      }),
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json({ error: `Groq error (${res.status})` }, { status: 502 });
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = json.choices?.[0]?.message?.content ?? "";
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
    return NextResponse.json({ words });
  } catch {
    // network failure, timeout or unparseable model output
    return NextResponse.json({ error: "AI analysis failed" }, { status: 502 });
  }
}
