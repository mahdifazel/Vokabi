import { NextResponse } from "next/server";
import { isSentence } from "@/lib/scan-rules";
import { authenticateUser, completeViaProviders } from "../_shared";

/**
 * Translates German entries (words or full sentences) and their example
 * sentences into Persian (Farsi). Gemini first, Groq as fallback (keys
 * configured in the back office and stored in app_settings). Available to
 * any signed-in user. Used by the client-side Persian backfill while the
 * meaning language is set to Persian, so meanings show in Persian the same
 * way they show in English.
 */

const MAX_WORDS = 10;
const MAX_CHARS = 300;

const SYSTEM_PROMPT = `You translate German vocabulary into Persian (Farsi) for Persian-speaking learners of German. The entries are numbered. For each entry:
- "fa": the Persian translation of the entry. For a single word, give the most common meaning in one to four Persian words (for a noun, just the noun, no article). For an entry marked (Satz), which is a full sentence, translate the whole sentence naturally.
- "exampleFa": only when the entry has an example sentence (given after "Beispiel:"), the natural Persian translation of that example sentence. Otherwise omit it.

Respond ONLY with JSON in the form {"translations": [{"n": <entry number>, "fa": "<Persian>", "exampleFa": "<Persian>"}]}.

Rules:
- Cover every entry in the list exactly once, keyed by its number.
- Use standard modern Persian script (Iranian Persian), everyday wording.
- The English hint, when given, tells you which sense of the word is meant.
- No transliteration, no explanations, no extra fields.`;

interface RequestedWord {
  german: string;
  english?: string;
  article?: string;
  pos?: string;
  example?: string;
}

/** One request line like: 1. das Haus (noun, "house") | Beispiel: Das Haus ist groß. */
function describeWord(w: RequestedWord, index: number): string {
  const name = w.article ? `${w.article} ${w.german}` : w.german;
  let line: string;
  if (isSentence(w.german)) {
    line = `${index + 1}. (Satz) ${name}`;
  } else {
    const hints = [w.pos, w.english ? `"${w.english}"` : ""].filter(Boolean).join(", ");
    line = `${index + 1}. ${hints ? `${name} (${hints})` : name}`;
  }
  return w.example ? `${line} | Beispiel: ${w.example}` : line;
}

function clean(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, MAX_CHARS) : undefined;
}

function parseTranslations(
  content: string,
  requested: RequestedWord[]
): { german: string; translationFa: string; exampleFa?: string }[] {
  const cleaned = content.replace(/<think>[\s\S]*?<\/think>/g, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  const json = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
  const parsed = JSON.parse(json) as { translations?: unknown };

  const seen = new Set<number>();
  const out: { german: string; translationFa: string; exampleFa?: string }[] = [];
  for (const entry of Array.isArray(parsed.translations) ? parsed.translations : []) {
    if (typeof entry !== "object" || entry === null) continue;
    const { n, fa, exampleFa } = entry as { n?: unknown; fa?: unknown; exampleFa?: unknown };
    if (typeof n !== "number") continue;
    const index = Math.round(n) - 1;
    const translationFa = clean(fa);
    if (index < 0 || index >= requested.length || seen.has(index) || !translationFa) continue;
    seen.add(index);
    out.push({
      german: requested[index].german,
      translationFa,
      // an example translation only makes sense when an example was sent
      exampleFa: requested[index].example ? clean(exampleFa) : undefined,
    });
  }
  return out;
}

export async function POST(req: Request) {
  const auth = await authenticateUser(req);
  if ("error" in auth) return auth.error;

  const body = (await req.json().catch(() => ({}))) as { words?: unknown };
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
  const words: RequestedWord[] = (Array.isArray(body.words) ? body.words : [])
    .filter(
      (w): w is RequestedWord =>
        typeof w === "object" && w !== null &&
        typeof (w as RequestedWord).german === "string" &&
        !!(w as RequestedWord).german.trim()
    )
    .map((w) => ({
      german: w.german.trim(),
      english: str(w.english),
      article: str(w.article),
      pos: str(w.pos),
      example: str(w.example),
    }))
    .slice(0, MAX_WORDS);
  if (words.length === 0) {
    return NextResponse.json({ error: "No words to translate" }, { status: 400 });
  }

  return completeViaProviders(
    auth.svc,
    {
      kind: "text",
      prompt: SYSTEM_PROMPT,
      text: words.map(describeWord).join("\n"),
      textLabel: "Entries",
    },
    (content) => NextResponse.json({ translations: parseTranslations(content, words) }),
    { geminiTimeoutMs: 20_000, groqTimeoutMs: 15_000 }
  );
}
