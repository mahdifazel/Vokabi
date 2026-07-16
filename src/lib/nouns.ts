"use client";

import type { Article } from "./types";

/**
 * German noun engine: case declension (all four cases, singular + plural)
 * and reliable suffix → gender rules, mirroring the verb/adjective engines.
 *
 * Accepted limitations: where German allows both -es and -s genitives
 * (des Erfolgs/Erfolges) one form is emitted, biased to the shorter modern
 * form for polysyllables; no archaic dative -e; adjectival nouns
 * (der Deutsche) are approximated by the weak -e heuristic; rare foreign
 * plurals ending in vowels other than -e (die Visa) get a spurious dative -n.
 */

export type NounCase = "nominativ" | "akkusativ" | "dativ" | "genitiv";

/** One rendered cell, e.g. { article: "des", noun: "Hundes" } */
export interface NounForm {
  article: string;
  noun: string;
}

export interface GenderHint {
  /** matched suffix incl. leading dash, e.g. "-ung" */
  suffix: string;
  gender: "masculine" | "feminine" | "neuter";
  /** true → the rule has known exceptions, hint copy says "usually" */
  soft: boolean;
}

export interface NounInfo {
  singular: Record<NounCase, NounForm>;
  /** null when the plural is unknown/unusable; the UI omits the group */
  plural: Record<NounCase, NounForm> | null;
  /** weak masculine n-noun (den Jungen) */
  weak: boolean;
  /** non-null only when a reliable suffix rule agrees with the stored article */
  genderHint: GenderHint | null;
}

// ---------------------------------------------------------------------------
// Curated data
// ---------------------------------------------------------------------------

const ARTICLES: Record<Article | "plural", Record<NounCase, string>> = {
  der: { nominativ: "der", akkusativ: "den", dativ: "dem", genitiv: "des" },
  die: { nominativ: "die", akkusativ: "die", dativ: "der", genitiv: "der" },
  das: { nominativ: "das", akkusativ: "das", dativ: "dem", genitiv: "des" },
  plural: { nominativ: "die", akkusativ: "die", dativ: "den", genitiv: "der" },
};

/**
 * Weak (n-declension) masculines not covered by the "der + -e" heuristic.
 * obl = akkusativ/dativ/genitiv singular form; gen overrides the genitive.
 */
const WEAK_NOUNS: Record<string, { obl: string; gen?: string }> = {
  herr: { obl: "Herrn" },
  mensch: { obl: "Menschen" },
  student: { obl: "Studenten" },
  präsident: { obl: "Präsidenten" },
  patient: { obl: "Patienten" },
  assistent: { obl: "Assistenten" },
  polizist: { obl: "Polizisten" },
  tourist: { obl: "Touristen" },
  journalist: { obl: "Journalisten" },
  fotograf: { obl: "Fotografen" },
  elefant: { obl: "Elefanten" },
  diamant: { obl: "Diamanten" },
  soldat: { obl: "Soldaten" },
  automat: { obl: "Automaten" },
  kandidat: { obl: "Kandidaten" },
  pilot: { obl: "Piloten" },
  planet: { obl: "Planeten" },
  astronaut: { obl: "Astronauten" },
  architekt: { obl: "Architekten" },
  philosoph: { obl: "Philosophen" },
  nachbar: { obl: "Nachbarn" },
  bär: { obl: "Bären" },
  held: { obl: "Helden" },
  prinz: { obl: "Prinzen" },
  fürst: { obl: "Fürsten" },
  graf: { obl: "Grafen" },
  // -ns genitive group (the -e heuristic alone would produce a wrong genitive)
  name: { obl: "Namen", gen: "Namens" },
  gedanke: { obl: "Gedanken", gen: "Gedankens" },
  buchstabe: { obl: "Buchstaben", gen: "Buchstabens" },
  wille: { obl: "Willen", gen: "Willens" },
  glaube: { obl: "Glauben", gen: "Glaubens" },
  friede: { obl: "Frieden", gen: "Friedens" },
};

/** der-nouns ending in -e that are NOT weak */
const WEAK_E_EXCEPTIONS = new Set(["käse"]);

/** genitives the rules can't derive */
const GENITIVE_OVERRIDES: Record<string, string> = {
  bus: "Busses",
};

/**
 * Reliable suffix → gender rules, ordered so longer suffixes win (Dokument
 * must hit -ment before -ent). soft = has known exceptions.
 */
const GENDER_RULES: { suffix: string; article: Article; soft?: boolean }[] = [
  { suffix: "schaft", article: "die" },
  { suffix: "ismus", article: "der" },
  { suffix: "heit", article: "die" },
  { suffix: "keit", article: "die" },
  { suffix: "tion", article: "die" },
  { suffix: "sion", article: "die" },
  { suffix: "chen", article: "das" },
  { suffix: "lein", article: "das" },
  { suffix: "ment", article: "das", soft: true }, // der Moment
  { suffix: "ling", article: "der" },
  { suffix: "ung", article: "die" },
  { suffix: "tät", article: "die" },
  { suffix: "enz", article: "die" },
  { suffix: "anz", article: "die" },
  { suffix: "ant", article: "der", soft: true }, // das Restaurant
  { suffix: "ent", article: "der", soft: true }, // das Talent
  { suffix: "ist", article: "der" },
  { suffix: "ei", article: "die", soft: true }, // der Papagei
  { suffix: "ie", article: "die", soft: true }, // das Genie
  { suffix: "ur", article: "die", soft: true }, // das Abitur
  { suffix: "ik", article: "die", soft: true }, // das Mosaik
  { suffix: "um", article: "das", soft: true }, // der Irrtum
  { suffix: "or", article: "der", soft: true }, // das Labor
];

const GENDER_WORD: Record<Article, GenderHint["gender"]> = {
  der: "masculine",
  die: "feminine",
  das: "neuter",
};

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

function syllableCount(lower: string): number {
  return (lower.match(/[aeiouäöüy]+/g) ?? []).length;
}

/** Genitive singular of a non-weak der/das noun */
function genitiveOf(noun: string, lower: string): string {
  if (GENITIVE_OVERRIDES[lower]) return GENITIVE_OVERRIDES[lower];
  // das Ergebnis → des Ergebnisses (the s doubles)
  if (lower.endsWith("nis")) return `${noun}ses`;
  // Latin-style -us/-os after a consonant stays unchanged (des Kaktus, des
  // Kosmos); a diphthong like "aus" (des Hauses) is a normal sibilant instead
  if (/[^aeiouäöü][uo]s$/.test(lower)) return noun;
  if (/(s|ß|x|z|sch)$/.test(lower)) return `${noun}es`;
  // vowel or unstressed -el/-er/-en/-em ending → plain -s (des Lehrers)
  if (/[aeiouyéäöü]$/.test(lower) || /(el|er|en|em)$/.test(lower)) return `${noun}s`;
  // monosyllables prefer -es (des Hundes, des Buches)
  if (syllableCount(lower) <= 1) return `${noun}es`;
  return `${noun}s`;
}

/** Weak-declension oblique forms (akk/dat/gen singular), or null when regular */
function weakFormsOf(
  noun: string,
  lower: string,
  article: Article
): { akkusativ: string; dativ: string; genitiv: string } | null {
  // das Herz is the lone neuter n-noun: Herz / Herz / Herzen / Herzens
  if (article === "das" && lower === "herz") {
    return { akkusativ: noun, dativ: `${noun}en`, genitiv: `${noun}ens` };
  }
  if (article !== "der") return null;
  const curated = WEAK_NOUNS[lower];
  if (curated) {
    return { akkusativ: curated.obl, dativ: curated.obl, genitiv: curated.gen ?? curated.obl };
  }
  // heuristic: masculines in -e are weak (der Junge → den Jungen), except
  // -ee words (der See, der Kaffee) and listed exceptions (der Käse)
  if (lower.endsWith("e") && !lower.endsWith("ee") && !WEAK_E_EXCEPTIONS.has(lower)) {
    const obl = `${noun}n`;
    return { akkusativ: obl, dativ: obl, genitiv: obl };
  }
  return null;
}

function matchGenderRule(lower: string, article: Article): GenderHint | null {
  for (const rule of GENDER_RULES) {
    if (!lower.endsWith(rule.suffix)) continue;
    // a real suffix needs a stem in front of it (das Ei, der Mist, das Tor)
    if (lower.length - rule.suffix.length < 3) continue;
    // agree-only: never contradict the stored article
    if (rule.article !== article) return null;
    return { suffix: `-${rule.suffix}`, gender: GENDER_WORD[article], soft: !!rule.soft };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Build declension details for a German noun; null if it can't be declined. */
export function getNounInfo(
  german: string,
  article: Article | undefined,
  plural: string | undefined
): NounInfo | null {
  const noun = german.trim();
  if (!noun || noun.includes(" ") || !article) return null;
  const lower = noun.toLowerCase();

  const weak = weakFormsOf(noun, lower, article);
  const genitiv = weak ? weak.genitiv : article === "die" ? noun : genitiveOf(noun, lower);
  const singular: Record<NounCase, NounForm> = {
    nominativ: { article: ARTICLES[article].nominativ, noun },
    akkusativ: { article: ARTICLES[article].akkusativ, noun: weak ? weak.akkusativ : noun },
    dativ: { article: ARTICLES[article].dativ, noun: weak ? weak.dativ : noun },
    genitiv: { article: ARTICLES[article].genitiv, noun: genitiv },
  };

  let pluralForms: Record<NounCase, NounForm> | null = null;
  const pl = (plural ?? "").trim();
  // shorthand ("-n") or multi-word plurals can't build a table
  if (pl && !pl.startsWith("-") && !/[\s,]/.test(pl)) {
    const plNoun = pl[0].toUpperCase() + pl.slice(1);
    const dative = /[ns]$/.test(plNoun.toLowerCase()) ? plNoun : `${plNoun}n`;
    pluralForms = {
      nominativ: { article: ARTICLES.plural.nominativ, noun: plNoun },
      akkusativ: { article: ARTICLES.plural.akkusativ, noun: plNoun },
      dativ: { article: ARTICLES.plural.dativ, noun: dative },
      genitiv: { article: ARTICLES.plural.genitiv, noun: plNoun },
    };
  }

  return {
    singular,
    plural: pluralForms,
    weak: !!weak,
    genderHint: matchGenderRule(lower, article),
  };
}
