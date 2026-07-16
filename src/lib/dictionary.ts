import { db } from "./db";
import { SEED } from "./seed-dictionary";
import type { Article, DictEntry, PartOfSpeech, Word } from "./types";

const CACHE_TTL = 1000 * 60 * 60 * 24 * 90; // 90 days
const MISS_TTL = 1000 * 60 * 60 * 24 * 7; // retry misses after a week

const seedMap = new Map<string, DictEntry>();
for (const [german, article, english, plural, pos, ipa] of SEED) {
  seedMap.set(german.toLowerCase(), {
    key: german.toLowerCase(),
    german,
    article: article || undefined,
    english,
    plural: plural || undefined,
    pos,
    ipa: ipa || undefined,
    fetchedAt: 0,
  });
}

export interface ParsedInput {
  german: string;
  articleHint?: Article;
}

/** Parse a raw pasted token like "das Haus" or "Haus" */
export function parseInput(raw: string): ParsedInput | null {
  const cleaned = raw
    .replace(/[\d.)\-–—•*]+\s*/g, (m, offset) => (offset === 0 ? "" : m)) // strip list bullets/numbering at start
    .replace(/^,+|,+$/g, "") // commas no longer split entries; drop stray ones at the edges
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return null;
  const m = cleaned.match(/^(der|die|das)\s+(.+)$/i);
  if (m) {
    return {
      german: m[2].trim(),
      articleHint: m[1].toLowerCase() as Article,
    };
  }
  return { german: cleaned };
}

/**
 * Split a pasted blob into individual word inputs: newlines, semicolons,
 * slashes, or a dash with a space on both sides. Commas stay part of the
 * entry so "die Katze, -n" and sentences survive; a bare dash never splits
 * ("E-Mail", the plural shorthand "-n").
 */
export function splitWordList(text: string): ParsedInput[] {
  const parts = text.split(/[\n;/]+|\s+[-–—]+\s+/);
  const seen = new Set<string>();
  const out: ParsedInput[] = [];
  for (const part of parts) {
    const parsed = parseInput(part);
    if (!parsed) continue;
    const key = parsed.german.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(parsed);
  }
  return out;
}

function isOnline() {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

/**
 * Look up a word: seed dictionary → local cache → Wiktionary → MyMemory fallback.
 * Never throws; returns null when nothing was found.
 */
export async function lookupWord(input: ParsedInput): Promise<DictEntry | null> {
  const key = input.german.toLowerCase();

  const seeded = seedMap.get(key);
  if (seeded) return seeded;

  const cachedEntry = await db.dictCache.get(key).catch(() => undefined);
  if (cachedEntry) {
    const ttl = cachedEntry.miss ? MISS_TTL : CACHE_TTL;
    if (Date.now() - cachedEntry.fetchedAt < ttl) {
      return cachedEntry.miss ? null : cachedEntry;
    }
  }

  if (!isOnline()) return cachedEntry && !cachedEntry.miss ? cachedEntry : null;

  let entry = await fetchFromWiktionary(input.german, !!input.articleHint);

  if (!entry) {
    const translation = await fetchTranslation(input.german);
    if (translation) {
      entry = {
        key,
        german: input.german,
        english: translation,
        article: input.articleHint,
        fetchedAt: Date.now(),
      };
    }
  }

  if (entry) {
    if (!entry.article && input.articleHint) entry.article = input.articleHint;
    await db.dictCache.put(entry).catch(() => {});
    return entry;
  }

  await db.dictCache
    .put({ key, german: input.german, miss: true, fetchedAt: Date.now() })
    .catch(() => {});
  return cachedEntry && !cachedEntry.miss ? cachedEntry : null;
}

/** Build a Word row from user input + lookup result */
export function buildWord(
  input: ParsedInput,
  entry: DictEntry | null,
  groupIds: number[] = []
): Word {
  const now = Date.now();
  const isNoun = entry?.pos === "noun" || !!entry?.article || !!input.articleHint;
  let german = entry?.german ?? input.german;
  // German nouns are capitalized
  if (isNoun && german && german[0] === german[0].toLowerCase()) {
    german = german[0].toUpperCase() + german.slice(1);
  }
  return {
    german,
    article: entry?.article ?? input.articleHint,
    english: entry?.english,
    plural: entry?.plural,
    ipa: entry?.ipa,
    pos: entry?.pos ?? (isNoun ? "noun" : undefined),
    example: entry?.example,
    exampleEn: entry?.exampleEn,
    favorite: 0,
    groupIds,
    status: entry ? "ready" : "notfound",
    createdAt: now,
    updatedAt: now,
  };
}

// ---------------------------------------------------------------------------
// Wiktionary (en.wiktionary.org): one request gives gender, plural, IPA,
// part of speech and English definitions for German entries.
// ---------------------------------------------------------------------------

const POS_HEADERS: Record<string, PartOfSpeech> = {
  Noun: "noun",
  "Proper noun": "noun",
  Verb: "verb",
  Adjective: "adjective",
  Adverb: "adverb",
  Pronoun: "pronoun",
  Preposition: "preposition",
  Conjunction: "conjunction",
  Interjection: "interjection",
  Numeral: "numeral",
  Phrase: "phrase",
};

const GENDER_TO_ARTICLE: Record<string, Article> = {
  m: "der",
  f: "die",
  n: "das",
};

async function fetchFromWiktionary(word: string, nounFirst: boolean): Promise<DictEntry | null> {
  const capitalized = word[0].toUpperCase() + word.slice(1);
  const lower = word.toLowerCase();
  // German capitalizes every verb's gerund into a real noun (das Schwimmen),
  // and mobile keyboards auto-capitalize the first letter, so trying the word
  // as typed first misclassifies capitalized verbs as nouns. Without an
  // article hint the lowercase page (verbs, adjectives, adverbs) gets
  // priority; real nouns fall through safely because their lowercase pages
  // have no German section. A typed article means the user wants the noun.
  const candidates = [
    ...new Set(nounFirst ? [capitalized, word, lower] : [lower, word, capitalized]),
  ];
  for (const title of candidates) {
    try {
      const res = await fetch(
        `https://en.wiktionary.org/w/api.php?action=parse&prop=wikitext&format=json&formatversion=2&origin=*&redirects=1&page=${encodeURIComponent(title)}`,
        { signal: AbortSignal.timeout(10000) }
      );
      if (!res.ok) continue;
      const data = await res.json();
      const wikitext: string | undefined = data?.parse?.wikitext;
      if (!wikitext) continue;
      const entry = parseGermanWikitext(data.parse.title ?? title, wikitext);
      if (entry) return entry;
    } catch {
      // network error / timeout, try next candidate
    }
  }
  return null;
}

function parseGermanWikitext(title: string, wikitext: string): DictEntry | null {
  // Isolate the ==German== language section
  const langMatch = wikitext.match(/^==\s*German\s*==\s*$/m);
  if (!langMatch || langMatch.index === undefined) return null;
  const rest = wikitext.slice(langMatch.index + langMatch[0].length);
  const nextLang = rest.match(/^==[^=].*==\s*$/m);
  const section = nextLang && nextLang.index !== undefined ? rest.slice(0, nextLang.index) : rest;

  // IPA: {{IPA|de|/haʊ̯s/}}
  const ipaMatch = section.match(/\{\{IPA\|de\|(\/[^}|]+\/)/);
  const ipa = ipaMatch?.[1];

  // First POS header found in the section
  let pos: PartOfSpeech | undefined;
  let posBody = "";
  const headerRe = /^===+\s*([^=]+?)\s*===+\s*$/gm;
  let h: RegExpExecArray | null;
  while ((h = headerRe.exec(section))) {
    const name = h[1].trim();
    if (POS_HEADERS[name]) {
      pos = POS_HEADERS[name];
      const bodyStart = h.index + h[0].length;
      const next = section.slice(bodyStart).match(/^===?=?\s*[^=]+?\s*===?=?\s*$/m);
      posBody =
        next && next.index !== undefined
          ? section.slice(bodyStart, bodyStart + next.index)
          : section.slice(bodyStart);
      break;
    }
  }
  if (!pos) return null;

  // Gender + plural from {{de-noun|...}}
  let article: Article | undefined;
  let plural: string | undefined;
  if (pos === "noun") {
    const nounTpl = posBody.match(/\{\{de-noun\|([^}]*)\}\}/);
    if (nounTpl) {
      const parsed = parseDeNounTemplate(title, nounTpl[1]);
      article = parsed.article;
      plural = parsed.plural;
    }
  }

  // First English definition: lines starting with "# "
  const english = extractDefinitions(posBody);
  if (!english && !article) return null;

  const { example, exampleEn } = extractExample(posBody);

  return {
    key: title.toLowerCase(),
    german: title,
    article,
    english: english || undefined,
    plural,
    ipa,
    pos,
    example,
    exampleEn,
    fetchedAt: Date.now(),
  };
}

function extractDefinitions(body: string): string {
  const defs: string[] = [];
  for (const line of body.split("\n")) {
    if (!line.startsWith("# ")) continue;
    let text = line.slice(2);
    text = text
      .replace(/\{\{(?:lb|lbl|label)\|[^}]*\}\}\s*/g, "")
      .replace(/\{\{(?:gloss|gl|q|qualifier|sense)\|([^}|]*)[^}]*\}\}/g, "($1)")
      .replace(/\{\{l\|en\|([^}|]+)[^}]*\}\}/g, "$1")
      .replace(/\{\{[^}]*\}\}/g, "")
      .replace(/\[\[(?:[^\]|]*\|)?([^\]]+)\]\]/g, "$1")
      .replace(/'''?/g, "")
      .replace(/\s+/g, " ")
      .replace(/^[;,:\s]+|[;,:\s]+$/g, "")
      .trim();
    if (text) defs.push(text);
    if (defs.length >= 2) break;
  }
  return defs.join("; ");
}

/** Strip wiki links (they contain pipes, so must go before any param split) */
function stripWikiLinks(text: string): string {
  return text.replace(/\[\[(?:[^\]|]*\|)?([^\]]+)\]\]/g, "$1");
}

function cleanExampleText(text: string): string {
  return text
    .replace(/\{\{[^}]*\}\}/g, "")
    .replace(/'''?/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isUsableExample(german: string): boolean {
  return german.length >= 8 && german.length <= 160 && german.includes(" ");
}

/**
 * First usable usage example: {{ux|de|German|English}} templates (the
 * translation can be the second positional param or t=/translation=),
 * preferring full sentences over fragments, then "#:" italic lines.
 */
function extractExample(body: string): { example?: string; exampleEn?: string } {
  const candidates: { example: string; exampleEn?: string }[] = [];
  const tplRe = /\{\{(?:ux|uxi|usex)\|de\|([^{}]*(?:\{\{[^{}]*\}\}[^{}]*)*)\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = tplRe.exec(body)) && candidates.length < 5) {
    const positional: string[] = [];
    let english = "";
    for (const part of stripWikiLinks(m[1]).split("|")) {
      const eq = part.indexOf("=");
      if (eq === -1) {
        positional.push(cleanExampleText(part));
        continue;
      }
      const key = part.slice(0, eq).trim();
      if (key === "t" || key === "translation") english = cleanExampleText(part.slice(eq + 1));
    }
    const german = positional[0] ?? "";
    if (!english) english = positional[1] ?? "";
    if (isUsableExample(german)) {
      candidates.push({ example: german, exampleEn: english ? english.slice(0, 200) : undefined });
    }
  }
  const sentence = candidates.find((c) => /[.!?]$/.test(c.example));
  if (sentence) return sentence;
  if (candidates[0]) return candidates[0];

  // plain italic example lines: "#: ''Der Hund bellt.''" (German only)
  const line = body.match(/^#+:\s*''(.+?)''/m);
  if (line) {
    const german = cleanExampleText(stripWikiLinks(line[1]));
    if (isUsableExample(german)) return { example: german };
  }
  return {};
}

/** Best-effort parse of {{de-noun|...}} template params for gender and plural */
function parseDeNounTemplate(
  word: string,
  params: string
): { article?: Article; plural?: string } {
  const parts = params.split("|").map((p) => p.trim());
  let article: Article | undefined;
  let plural: string | undefined;

  // Named params (old style): g=, plural=/pl=
  for (const p of parts) {
    const [k, v] = p.split("=").map((s) => s?.trim());
    if (!v) continue;
    if (k === "g" || k === "g1") article ??= GENDER_TO_ARTICLE[v[0]];
    if (k === "plural" || k === "pl" || k === "pl1") plural ??= v;
  }

  // New style: first positional param "gender,genitive,plural"
  const positional = parts.filter((p) => !p.includes("="));
  if (positional[0]) {
    const specs = positional[0].split(",").map((s) => s.trim());
    if (!article) {
      const g = specs[0]?.split(":")[0]?.split(".")[0];
      if (g) article = GENDER_TO_ARTICLE[g];
    }
    if (!plural && specs.length >= 3) {
      plural = resolvePluralSpec(word, specs[2]);
    } else if (!plural && specs.length === 2 && specs[0]?.startsWith("f")) {
      // feminine default shortcut {{de-noun|f,-en}} → second spec is often the plural
      plural = resolvePluralSpec(word, specs[1]);
    } else if (!plural && specs.length === 1 && article === "die") {
      // de-noun default for feminine nouns: -n after -e, otherwise -en
      plural = word.endsWith("e") ? word + "n" : word + "en";
    }
  }
  return { article, plural };
}

function resolvePluralSpec(word: string, spec: string): string | undefined {
  if (!spec || spec === "-" || spec.startsWith("!")) return undefined;
  if (/^[A-ZÄÖÜ]/.test(spec)) return spec; // full word given
  if (spec.startsWith("^")) {
    // umlaut plural: ^er → Häuser
    const suffix = spec.slice(1);
    const um = umlautStem(word);
    return um ? um + suffix : undefined;
  }
  if (/^[a-zäöüß]+$/.test(spec)) return word + spec; // simple suffix
  return undefined;
}

function umlautStem(word: string): string | undefined {
  const map: Record<string, string> = { au: "äu", a: "ä", o: "ö", u: "ü" };
  const m = word.match(/^(.*)(au|a|o|u)([^aou]*)$/i);
  if (!m) return undefined;
  const vowel = m[2].toLowerCase();
  return m[1] + (map[vowel] ?? m[2]) + m[3];
}

// ---------------------------------------------------------------------------
// MyMemory: free translation fallback when Wiktionary has no entry
// ---------------------------------------------------------------------------

async function fetchTranslation(word: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=de|en`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const text: string | undefined = data?.responseData?.translatedText;
    if (!text || /^[A-Z ]+$/.test(text) || text.toLowerCase() === word.toLowerCase()) {
      return null;
    }
    return text;
  } catch {
    return null;
  }
}
