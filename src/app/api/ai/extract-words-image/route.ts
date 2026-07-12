import { NextResponse } from "next/server";
import {
  authenticateUser,
  callGroqChat,
  loadGroqSettings,
  parseWordList,
} from "../_shared";
import { MAX_SCAN_SENTENCES, MAX_SCAN_WORDS } from "@/lib/scan-rules";

/**
 * Extracts German vocabulary straight from a scanned photo using a Groq
 * vision model (model id in app_settings, managed in the back office).
 * Available to any signed-in user. The client tries this first and falls back
 * to on-device OCR + /api/ai/extract-words on any non-200, so failures here
 * only need the right status code.
 */

// the downscaled 1600px q0.8 JPEG stays far below this; the cap just keeps
// oversized payloads from reaching Groq (4 MB base64 image limit)
const MAX_IMAGE_CHARS = 5_000_000;

const VISION_PROMPT = `This photo shows German vocabulary: a vocabulary list, textbook page, worksheet or handwritten notes. Extract the German vocabulary entries a learner would save, and respond ONLY with JSON in the form {"words": ["...", "..."]}.

Rules:
- Only include words and sentences actually visible in the photo; never invent entries.
- Read handwriting carefully; if a word is partly unclear, pick the plausible German word it most likely is, but skip anything you cannot read with confidence.
- For nouns, keep the article (der/die/das) when it is written next to the noun; do not add articles that are not there.
- Include full sentences too: keep every example sentence as one single entry, exactly as written. Never split a sentence into separate words, shorten it or leave it out.
- Drop translations in other languages, page numbers, chapter headers, exercise instructions and decorations.
- No duplicates. Include up to ${MAX_SCAN_WORDS} word entries and up to ${MAX_SCAN_SENTENCES} sentence entries.
- If the photo contains no German vocabulary, respond with {"words": []}.`;

export async function POST(req: Request) {
  const auth = await authenticateUser(req);
  if ("error" in auth) return auth.error;

  const body = (await req.json().catch(() => ({}))) as { image?: string };
  const image = typeof body.image === "string" ? body.image : "";
  if (
    !/^data:image\/(jpeg|png|webp);base64,/.test(image) ||
    image.length > MAX_IMAGE_CHARS
  ) {
    return NextResponse.json({ error: "No usable image" }, { status: 400 });
  }

  const settings = await loadGroqSettings(auth.svc);
  if ("error" in settings) return settings.error;

  try {
    const result = await callGroqChat(
      settings.apiKey,
      {
        model: settings.visionModel,
        max_tokens: 2048,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: VISION_PROMPT },
              { type: "image_url", image_url: { url: image } },
            ],
          },
        ],
      },
      25_000
    );
    if ("error" in result) return result.error;
    return NextResponse.json({ words: parseWordList(result.content) });
  } catch {
    // network failure, timeout or unparseable model output
    return NextResponse.json({ error: "AI analysis failed" }, { status: 502 });
  }
}
