import { NextResponse } from "next/server";
import { authenticateUser, completeViaProviders } from "../_shared";

/**
 * Generates one simple example sentence (German + English) per requested
 * word: Gemini first, Groq as fallback (keys configured in the back office
 * and stored in app_settings). Available to any signed-in user. Used by the
 * client-side example backfill for words whose Wiktionary entry has no usable
 * usage example.
 */

const MAX_WORDS = 10;
const MAX_SENTENCE_CHARS = 200;

const SYSTEM_PROMPT = `You write example sentences for German vocabulary learners. For each word in the list, write ONE simple German sentence at A1-A2 level (at most 12 words) that uses the word naturally (conjugated or declined as needed), plus an English translation. Respond ONLY with JSON in the form {"examples": [{"word": "<the word exactly as given>", "de": "<German sentence>", "en": "<English translation>"}]}.

Rules:
- Cover every word in the list exactly once.
- Use everyday vocabulary around the target word; keep sentences natural and correct.
- No explanations, no extra fields.`;

interface RequestedWord {
  german: string;
  english?: string;
  article?: string;
  pos?: string;
}

/** One request line like: gehen (verb, "to go") */
function describeWord(w: RequestedWord): string {
  const hints = [w.pos, w.english ? `"${w.english}"` : ""].filter(Boolean).join(", ");
  const name = w.article ? `${w.article} ${w.german}` : w.german;
  return hints ? `${name} (${hints})` : name;
}

function parseExamples(
  content: string,
  requested: RequestedWord[]
): { german: string; example: string; exampleEn: string }[] {
  const cleaned = content.replace(/<think>[\s\S]*?<\/think>/g, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  const json = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
  const parsed = JSON.parse(json) as { examples?: unknown };

  const byKey = new Map(requested.map((w) => [w.german.toLowerCase(), w.german]));
  const seen = new Set<string>();
  const out: { german: string; example: string; exampleEn: string }[] = [];
  for (const entry of Array.isArray(parsed.examples) ? parsed.examples : []) {
    if (typeof entry !== "object" || entry === null) continue;
    const { word, de, en } = entry as { word?: unknown; de?: unknown; en?: unknown };
    if (typeof word !== "string" || typeof de !== "string") continue;
    // models sometimes echo the article we sent along with the noun
    const key = word.trim().toLowerCase().replace(/^(der|die|das)\s+/, "");
    const german = byKey.get(key) ?? byKey.get(word.trim().toLowerCase());
    if (!german || seen.has(german) || !de.trim()) continue;
    seen.add(german);
    out.push({
      german,
      example: de.trim().slice(0, MAX_SENTENCE_CHARS),
      exampleEn: typeof en === "string" ? en.trim().slice(0, MAX_SENTENCE_CHARS) : "",
    });
  }
  return out;
}

export async function POST(req: Request) {
  const auth = await authenticateUser(req);
  if ("error" in auth) return auth.error;

  const body = (await req.json().catch(() => ({}))) as { words?: unknown };
  const words: RequestedWord[] = (Array.isArray(body.words) ? body.words : [])
    .filter(
      (w): w is RequestedWord =>
        typeof w === "object" && w !== null &&
        typeof (w as RequestedWord).german === "string" &&
        !!(w as RequestedWord).german.trim()
    )
    .map((w) => ({
      german: w.german.trim(),
      english: typeof w.english === "string" ? w.english : undefined,
      article: typeof w.article === "string" ? w.article : undefined,
      pos: typeof w.pos === "string" ? w.pos : undefined,
    }))
    .slice(0, MAX_WORDS);
  if (words.length === 0) {
    return NextResponse.json({ error: "No words to illustrate" }, { status: 400 });
  }

  return completeViaProviders(
    auth.svc,
    {
      kind: "text",
      prompt: SYSTEM_PROMPT,
      text: words.map(describeWord).join("\n"),
      textLabel: "Words",
    },
    (content) => NextResponse.json({ examples: parseExamples(content, words) }),
    { geminiTimeoutMs: 20_000, groqTimeoutMs: 15_000 }
  );
}
