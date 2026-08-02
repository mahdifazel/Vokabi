import { NextResponse } from "next/server";
import { isSentence } from "@/lib/scan-rules";
import { authenticateUser, completeViaProviders } from "../_shared";

/**
 * Generates one short, learner-friendly German definition per requested
 * entry: a dictionary-style definition for words, a simple paraphrase for
 * sentence entries (marked "(Satz)" in the request). Gemini first, Groq as
 * fallback (keys configured in the back office and stored in app_settings).
 * Available to any signed-in user. Used by the client-side definition
 * backfill when the meaning language is set to Deutsch, so meanings can be
 * shown as German explanations instead of English translations.
 */

const MAX_WORDS = 10;
const MAX_DEFINITION_CHARS = 200;

const SYSTEM_PROMPT = `You write German meanings for German vocabulary learners. The entries are numbered. For each entry, write ONE short German meaning at A2 level:
- For a word: a definition (at most 12 words) that explains the word simply, the way a learner's dictionary would. Example: for "das Haus" write "Ein Gebäude, in dem Menschen wohnen." Do not use the word itself (or its direct compounds) inside its definition.
- For an entry marked (Satz), which is a full sentence: a simple paraphrase of the sentence's meaning, using different words than the original where possible.

Respond ONLY with JSON in the form {"definitions": [{"n": <entry number>, "de": "<German meaning>"}]}.

Rules:
- Cover every entry in the list exactly once, keyed by its number.
- Use simple everyday German; one sentence, ending with a period.
- No explanations, no extra fields.`;

interface RequestedWord {
  german: string;
  english?: string;
  article?: string;
  pos?: string;
}

/** One request line like: 1. gehen (verb, "to go") or 3. (Satz) Ich gehe ins Kino. */
function describeWord(w: RequestedWord, index: number): string {
  const name = w.article ? `${w.article} ${w.german}` : w.german;
  if (isSentence(w.german)) return `${index + 1}. (Satz) ${name}`;
  const hints = [w.pos, w.english ? `"${w.english}"` : ""].filter(Boolean).join(", ");
  return `${index + 1}. ${hints ? `${name} (${hints})` : name}`;
}

function parseDefinitions(
  content: string,
  requested: RequestedWord[]
): { german: string; definitionDe: string }[] {
  const cleaned = content.replace(/<think>[\s\S]*?<\/think>/g, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  const json = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
  const parsed = JSON.parse(json) as { definitions?: unknown };

  const seen = new Set<number>();
  const out: { german: string; definitionDe: string }[] = [];
  for (const entry of Array.isArray(parsed.definitions) ? parsed.definitions : []) {
    if (typeof entry !== "object" || entry === null) continue;
    const { n, de } = entry as { n?: unknown; de?: unknown };
    if (typeof n !== "number" || typeof de !== "string") continue;
    const index = Math.round(n) - 1;
    if (index < 0 || index >= requested.length || seen.has(index) || !de.trim()) continue;
    seen.add(index);
    out.push({
      german: requested[index].german,
      definitionDe: de.trim().slice(0, MAX_DEFINITION_CHARS),
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
    return NextResponse.json({ error: "No words to define" }, { status: 400 });
  }

  return completeViaProviders(
    auth.svc,
    {
      kind: "text",
      prompt: SYSTEM_PROMPT,
      text: words.map(describeWord).join("\n"),
      textLabel: "Entries",
    },
    (content) => NextResponse.json({ definitions: parseDefinitions(content, words) }),
    { geminiTimeoutMs: 20_000, groqTimeoutMs: 15_000 }
  );
}
