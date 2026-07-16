"use client";

/**
 * German adjective comparison: comparative + superlative ("am …sten").
 *
 * Curated data covers the common umlaut/irregular adjectives; everything else
 * falls back to the regular rules, mirroring the verb engine's approach.
 */

export interface AdjectiveInfo {
  base: string;
  /** e.g. "schneller" */
  comparative: string;
  /** e.g. "am schnellsten" */
  superlative: string;
  irregular: boolean;
}

/** Umlaut and suppletive comparisons */
const IRREGULAR: Record<string, { comp: string; sup: string }> = {
  gut: { comp: "besser", sup: "am besten" },
  viel: { comp: "mehr", sup: "am meisten" },
  gern: { comp: "lieber", sup: "am liebsten" },
  hoch: { comp: "höher", sup: "am höchsten" },
  nah: { comp: "näher", sup: "am nächsten" },
  groß: { comp: "größer", sup: "am größten" },
  alt: { comp: "älter", sup: "am ältesten" },
  jung: { comp: "jünger", sup: "am jüngsten" },
  lang: { comp: "länger", sup: "am längsten" },
  kurz: { comp: "kürzer", sup: "am kürzesten" },
  warm: { comp: "wärmer", sup: "am wärmsten" },
  kalt: { comp: "kälter", sup: "am kältesten" },
  klug: { comp: "klüger", sup: "am klügsten" },
  stark: { comp: "stärker", sup: "am stärksten" },
  schwach: { comp: "schwächer", sup: "am schwächsten" },
  arm: { comp: "ärmer", sup: "am ärmsten" },
  hart: { comp: "härter", sup: "am härtesten" },
  scharf: { comp: "schärfer", sup: "am schärfsten" },
  krank: { comp: "kränker", sup: "am kränksten" },
  gesund: { comp: "gesünder", sup: "am gesündesten" },
  grob: { comp: "gröber", sup: "am gröbsten" },
  dumm: { comp: "dümmer", sup: "am dümmsten" },
  oft: { comp: "öfter", sup: "am häufigsten" },
};

/** Adjectives that don't take comparison */
const NOT_GRADABLE = new Set(["tot", "schwanger", "einzig", "ganz", "leer", "fertig"]);

function comparativeOf(base: string): string {
  // dunkel → dunkler
  if (base.endsWith("el")) return `${base.slice(0, -2)}ler`;
  // teuer → teurer, sauer → saurer (only after a diphthong; lecker → leckerer)
  if (base.endsWith("er") && /(au|eu)er$/.test(base)) return `${base.slice(0, -2)}rer`;
  // leise → leiser
  if (base.endsWith("e")) return `${base}r`;
  return `${base}er`;
}

function superlativeOf(base: string): string {
  // leise → am leisesten
  if (base.endsWith("e")) return `am ${base}sten`;
  // the superlative never uses the elided stem: am dunkelsten, am teuersten;
  // e-insertion after t/d/sibilants (am lautesten, am hübschesten — but am praktischsten)
  const e =
    /[tdsßxz]$/.test(base) || (base.endsWith("sch") && !base.endsWith("isch")) ? "e" : "";
  return `am ${base}${e}sten`;
}

/** Build comparison forms for a German adjective; null if it can't be graded. */
export function getAdjectiveInfo(german: string): AdjectiveInfo | null {
  const base = german.trim().toLowerCase();
  if (!base || base.length < 3 || base.includes(" ") || NOT_GRADABLE.has(base)) return null;

  const irregular = IRREGULAR[base];
  if (irregular) {
    return { base, comparative: irregular.comp, superlative: irregular.sup, irregular: true };
  }
  return {
    base,
    comparative: comparativeOf(base),
    superlative: superlativeOf(base),
    irregular: false,
  };
}
