import { NextResponse } from "next/server";
import { authenticateUser, extractWordsViaProviders } from "../_shared";
import { MAX_SCAN_SENTENCES, MAX_SCAN_WORDS } from "@/lib/scan-rules";

/**
 * Extracts German vocabulary from raw OCR text: Gemini first, Groq as
 * fallback (keys configured in the back office and stored in app_settings).
 * Available to any signed-in user. This is the text fallback behind
 * /api/ai/extract-words-image for scans, and the client falls back further to
 * on-device heuristic word detection when this route fails too.
 */

const MAX_INPUT_CHARS = 4000;

const SYSTEM_PROMPT = `You clean up OCR output from photos of German vocabulary lists, textbook pages and notes. Extract the German vocabulary entries a learner would save, and respond ONLY with JSON in the form {"words": ["...", "..."]}.

Rules:
- Only include words and sentences that actually appear in the text; never invent entries.
- Fix obvious OCR misreadings (e.g. "Hav5" -> "Haus", "0" read as "O") but do not otherwise rewrite.
- For nouns, keep the article (der/die/das) when it appears next to the noun; do not add articles that are not in the text.
- Include full sentences too: keep every example sentence as one single entry, exactly as written. Never split a sentence into separate words, shorten it or leave it out.
- Drop translations in other languages, page numbers, chapter headers, exercise instructions and OCR noise.
- No duplicates. Include up to ${MAX_SCAN_WORDS} word entries and up to ${MAX_SCAN_SENTENCES} sentence entries.
- If the text contains no German vocabulary, respond with {"words": []}.`;

export async function POST(req: Request) {
  const auth = await authenticateUser(req);
  if ("error" in auth) return auth.error;

  const body = (await req.json().catch(() => ({}))) as { text?: string };
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) {
    return NextResponse.json({ error: "No text to analyze" }, { status: 400 });
  }

  return extractWordsViaProviders(auth.svc, {
    kind: "text",
    prompt: SYSTEM_PROMPT,
    text: text.slice(0, MAX_INPUT_CHARS),
  });
}
