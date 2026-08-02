import { NextResponse } from "next/server";
import { authenticateUser, completeViaProviders } from "../_shared";

/**
 * Generates one short, learner-friendly German definition per requested word:
 * Gemini first, Groq as fallback (keys configured in the back office and
 * stored in app_settings). Available to any signed-in user. Used by the
 * client-side definition backfill when the meaning language is set to
 * Deutsch, so meanings can be shown as German explanations instead of
 * English translations.
 */

const MAX_WORDS = 10;
const MAX_DEFINITION_CHARS = 160;

const SYSTEM_PROMPT = `You write German dictionary definitions for German vocabulary learners. For each word in the list, write ONE short German definition at A2 level (at most 12 words) that explains the word simply, the way a learner's dictionary would. Example: for "das Haus" write "Ein Gebäude, in dem Menschen wohnen." Respond ONLY with JSON in the form {"definitions": [{"word": "<the word exactly as given>", "de": "<German definition>"}]}.

Rules:
- Cover every word in the list exactly once.
- Do not use the word itself (or its direct compounds) inside its definition.
- Use simple everyday German; one sentence, ending with a period.
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

function parseDefinitions(
  content: string,
  requested: RequestedWord[]
): { german: string; definitionDe: string }[] {
  const cleaned = content.replace(/<think>[\s\S]*?<\/think>/g, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  const json = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
  const parsed = JSON.parse(json) as { definitions?: unknown };

  const byKey = new Map(requested.map((w) => [w.german.toLowerCase(), w.german]));
  const seen = new Set<string>();
  const out: { german: string; definitionDe: string }[] = [];
  for (const entry of Array.isArray(parsed.definitions) ? parsed.definitions : []) {
    if (typeof entry !== "object" || entry === null) continue;
    const { word, de } = entry as { word?: unknown; de?: unknown };
    if (typeof word !== "string" || typeof de !== "string") continue;
    // models sometimes echo the article we sent along with the noun
    const key = word.trim().toLowerCase().replace(/^(der|die|das)\s+/, "");
    const german = byKey.get(key) ?? byKey.get(word.trim().toLowerCase());
    if (!german || seen.has(german) || !de.trim()) continue;
    seen.add(german);
    out.push({ german, definitionDe: de.trim().slice(0, MAX_DEFINITION_CHARS) });
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
      textLabel: "Words",
    },
    (content) => NextResponse.json({ definitions: parseDefinitions(content, words) }),
    { geminiTimeoutMs: 20_000, groqTimeoutMs: 15_000 }
  );
}
