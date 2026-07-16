"use client";

/**
 * German adjective comparison: comparative + superlative ("am …sten").
 *
 * Curated data covers the common umlaut/irregular adjectives; everything else
 * falls back to the regular rules, mirroring the verb engine's approach.
 */

export interface AdjectiveCombo {
  de: string;
  en: string;
}

export interface AdjectiveInfo {
  base: string;
  /** e.g. "schneller"; null for non-gradable adjectives (fertig, tot) */
  comparative: string | null;
  /** e.g. "am schnellsten"; null for non-gradable adjectives */
  superlative: string | null;
  irregular: boolean;
  example?: string;
  exampleEn?: string;
  /** e.g. "langsam" */
  opposite?: string;
  level?: string;
  /** common combinations with correct endings, e.g. "ein schnelles Auto" */
  combos?: AdjectiveCombo[];
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

interface AdjectiveExtras {
  example?: string;
  exampleEn?: string;
  opposite?: string;
  level?: string;
  combos?: AdjectiveCombo[];
}

/** Examples, opposites, levels and common combinations for frequent adjectives */
const EXTRAS: Record<string, AdjectiveExtras> = {
  gut: { example: "Das Essen schmeckt sehr gut.", exampleEn: "The food tastes very good.", opposite: "schlecht", level: "A1", combos: [{ de: "ein gutes Buch", en: "a good book" }, { de: "gute Freunde", en: "good friends" }] },
  schlecht: { example: "Der Film war ziemlich schlecht.", exampleEn: "The film was rather bad.", opposite: "gut", level: "A1", combos: [{ de: "schlechtes Wetter", en: "bad weather" }, { de: "eine schlechte Idee", en: "a bad idea" }] },
  groß: { example: "Mein Bruder ist sehr groß.", exampleEn: "My brother is very tall.", opposite: "klein", level: "A1", combos: [{ de: "eine große Stadt", en: "a big city" }, { de: "ein großer Hund", en: "a big dog" }] },
  klein: { example: "Wir wohnen in einer kleinen Wohnung.", exampleEn: "We live in a small apartment.", opposite: "groß", level: "A1", combos: [{ de: "ein kleines Kind", en: "a small child" }, { de: "eine kleine Pause", en: "a short break" }] },
  alt: { example: "Wie alt bist du?", exampleEn: "How old are you?", opposite: "jung", level: "A1", combos: [{ de: "ein altes Haus", en: "an old house" }, { de: "ein alter Freund", en: "an old friend" }] },
  jung: { example: "Er ist noch sehr jung.", exampleEn: "He is still very young.", opposite: "alt", level: "A1", combos: [{ de: "ein junger Mann", en: "a young man" }, { de: "junge Leute", en: "young people" }] },
  neu: { example: "Ich brauche ein neues Handy.", exampleEn: "I need a new phone.", opposite: "alt", level: "A1", combos: [{ de: "ein neues Auto", en: "a new car" }, { de: "neue Schuhe", en: "new shoes" }] },
  schnell: { example: "Der Zug ist sehr schnell.", exampleEn: "The train is very fast.", opposite: "langsam", level: "A1", combos: [{ de: "ein schnelles Auto", en: "a fast car" }, { de: "schnelles Internet", en: "fast internet" }] },
  langsam: { example: "Er isst sehr langsam.", exampleEn: "He eats very slowly.", opposite: "schnell", level: "A1", combos: [{ de: "ein langsamer Bus", en: "a slow bus" }, { de: "langsame Musik", en: "slow music" }] },
  schön: { example: "Die Stadt ist wirklich schön.", exampleEn: "The city is really beautiful.", opposite: "hässlich", level: "A1", combos: [{ de: "ein schönes Wochenende", en: "a nice weekend" }, { de: "schönes Wetter", en: "nice weather" }] },
  hässlich: { example: "Das Sofa ist alt und hässlich.", exampleEn: "The sofa is old and ugly.", opposite: "schön", level: "A2", combos: [{ de: "ein hässliches Gebäude", en: "an ugly building" }] },
  teuer: { example: "Die Mieten sind hier sehr teuer.", exampleEn: "Rents are very expensive here.", opposite: "billig", level: "A1", combos: [{ de: "ein teures Restaurant", en: "an expensive restaurant" }, { de: "teure Schuhe", en: "expensive shoes" }] },
  billig: { example: "Das T-Shirt war ziemlich billig.", exampleEn: "The T-shirt was quite cheap.", opposite: "teuer", level: "A1", combos: [{ de: "ein billiges Hotel", en: "a cheap hotel" }, { de: "billige Flüge", en: "cheap flights" }] },
  heiß: { example: "Im Sommer ist es hier sehr heiß.", exampleEn: "In summer it is very hot here.", opposite: "kalt", level: "A1", combos: [{ de: "heißer Kaffee", en: "hot coffee" }, { de: "ein heißer Tag", en: "a hot day" }] },
  kalt: { example: "Draußen ist es heute richtig kalt.", exampleEn: "It is really cold outside today.", opposite: "warm", level: "A1", combos: [{ de: "kaltes Wasser", en: "cold water" }, { de: "ein kalter Winter", en: "a cold winter" }] },
  warm: { example: "Die Suppe ist noch warm.", exampleEn: "The soup is still warm.", opposite: "kalt", level: "A1", combos: [{ de: "warmes Essen", en: "warm food" }, { de: "ein warmer Pullover", en: "a warm sweater" }] },
  lang: { example: "Der Film war mir zu lang.", exampleEn: "The film was too long for me.", opposite: "kurz", level: "A1", combos: [{ de: "lange Haare", en: "long hair" }, { de: "ein langer Tag", en: "a long day" }] },
  kurz: { example: "Ich mache eine kurze Pause.", exampleEn: "I am taking a short break.", opposite: "lang", level: "A1", combos: [{ de: "kurze Haare", en: "short hair" }, { de: "eine kurze Antwort", en: "a short answer" }] },
  leicht: { example: "Die Prüfung war ziemlich leicht.", exampleEn: "The exam was quite easy.", opposite: "schwer", level: "A1", combos: [{ de: "eine leichte Aufgabe", en: "an easy task" }, { de: "leichtes Gepäck", en: "light luggage" }] },
  schwer: { example: "Der Koffer ist zu schwer.", exampleEn: "The suitcase is too heavy.", opposite: "leicht", level: "A1", combos: [{ de: "eine schwere Tasche", en: "a heavy bag" }, { de: "eine schwere Frage", en: "a difficult question" }] },
  einfach: { example: "Die Aufgabe ist ganz einfach.", exampleEn: "The task is quite simple.", opposite: "schwierig", level: "A1", combos: [{ de: "eine einfache Frage", en: "a simple question" }, { de: "ein einfaches Rezept", en: "a simple recipe" }] },
  schwierig: { example: "Deutsch ist gar nicht so schwierig.", exampleEn: "German is not that difficult at all.", opposite: "einfach", level: "A2", combos: [{ de: "eine schwierige Entscheidung", en: "a difficult decision" }, { de: "ein schwieriges Thema", en: "a difficult topic" }] },
  früh: { example: "Ich stehe morgen früh auf.", exampleEn: "I am getting up early tomorrow.", opposite: "spät", level: "A1", combos: [{ de: "am frühen Morgen", en: "in the early morning" }] },
  spät: { example: "Es ist schon spät.", exampleEn: "It is already late.", opposite: "früh", level: "A1", combos: [{ de: "am späten Abend", en: "late in the evening" }] },
  richtig: { example: "Deine Antwort ist richtig.", exampleEn: "Your answer is correct.", opposite: "falsch", level: "A1", combos: [{ de: "die richtige Antwort", en: "the right answer" }, { de: "der richtige Weg", en: "the right way" }] },
  falsch: { example: "Diese Antwort ist leider falsch.", exampleEn: "Unfortunately this answer is wrong.", opposite: "richtig", level: "A1", combos: [{ de: "eine falsche Nummer", en: "a wrong number" }, { de: "die falsche Richtung", en: "the wrong direction" }] },
  glücklich: { example: "Sie ist sehr glücklich mit ihrem Job.", exampleEn: "She is very happy with her job.", opposite: "unglücklich", level: "A2", combos: [{ de: "eine glückliche Familie", en: "a happy family" }, { de: "ein glücklicher Zufall", en: "a lucky coincidence" }] },
  traurig: { example: "Warum bist du so traurig?", exampleEn: "Why are you so sad?", opposite: "fröhlich", level: "A1", combos: [{ de: "ein trauriger Film", en: "a sad film" }, { de: "traurige Musik", en: "sad music" }] },
  müde: { example: "Ich bin heute sehr müde.", exampleEn: "I am very tired today.", opposite: "wach", level: "A1", combos: [{ de: "müde Augen", en: "tired eyes" }] },
  gesund: { example: "Obst und Gemüse sind gesund.", exampleEn: "Fruit and vegetables are healthy.", opposite: "krank", level: "A1", combos: [{ de: "gesundes Essen", en: "healthy food" }, { de: "ein gesundes Leben", en: "a healthy life" }] },
  krank: { example: "Ich bin krank und bleibe im Bett.", exampleEn: "I am sick and staying in bed.", opposite: "gesund", level: "A1", combos: [{ de: "ein krankes Kind", en: "a sick child" }] },
  stark: { example: "Der Kaffee ist mir zu stark.", exampleEn: "The coffee is too strong for me.", opposite: "schwach", level: "A2", combos: [{ de: "starker Kaffee", en: "strong coffee" }, { de: "ein starker Wind", en: "a strong wind" }] },
  schwach: { example: "Nach der Grippe fühle ich mich noch schwach.", exampleEn: "After the flu I still feel weak.", opposite: "stark", level: "A2", combos: [{ de: "schwaches Licht", en: "weak light" }, { de: "ein schwaches Argument", en: "a weak argument" }] },
  laut: { example: "Die Musik ist zu laut.", exampleEn: "The music is too loud.", opposite: "leise", level: "A1", combos: [{ de: "laute Musik", en: "loud music" }, { de: "eine laute Straße", en: "a noisy street" }] },
  leise: { example: "Bitte sei leise, das Baby schläft.", exampleEn: "Please be quiet, the baby is sleeping.", opposite: "laut", level: "A1", combos: [{ de: "eine leise Stimme", en: "a quiet voice" }, { de: "leise Musik", en: "quiet music" }] },
  voll: { example: "Der Kühlschrank ist voll.", exampleEn: "The fridge is full.", opposite: "leer", level: "A2", combos: [{ de: "ein voller Bus", en: "a full bus" }, { de: "ein volles Glas", en: "a full glass" }] },
  leer: { example: "Die Flasche ist schon leer.", exampleEn: "The bottle is already empty.", opposite: "voll", level: "A2", combos: [{ de: "ein leeres Glas", en: "an empty glass" }, { de: "eine leere Straße", en: "an empty street" }] },
  offen: { example: "Die Tür ist offen.", exampleEn: "The door is open.", opposite: "geschlossen", level: "A2", combos: [{ de: "ein offenes Fenster", en: "an open window" }, { de: "offene Fragen", en: "open questions" }] },
  sauber: { example: "Die Küche ist jetzt sauber.", exampleEn: "The kitchen is clean now.", opposite: "schmutzig", level: "A1", combos: [{ de: "saubere Kleidung", en: "clean clothes" }, { de: "ein sauberes Zimmer", en: "a clean room" }] },
  schmutzig: { example: "Deine Hände sind schmutzig.", exampleEn: "Your hands are dirty.", opposite: "sauber", level: "A1", combos: [{ de: "schmutzige Schuhe", en: "dirty shoes" }, { de: "schmutziges Geschirr", en: "dirty dishes" }] },
  reich: { example: "Er ist durch seine Firma reich geworden.", exampleEn: "He became rich through his company.", opposite: "arm", level: "A2", combos: [{ de: "ein reiches Land", en: "a rich country" }] },
  arm: { example: "Früher war die Region sehr arm.", exampleEn: "The region used to be very poor.", opposite: "reich", level: "A2", combos: [{ de: "ein armes Land", en: "a poor country" }, { de: "arme Leute", en: "poor people" }] },
  interessant: { example: "Der Vortrag war sehr interessant.", exampleEn: "The talk was very interesting.", opposite: "langweilig", level: "A1", combos: [{ de: "ein interessantes Buch", en: "an interesting book" }, { de: "eine interessante Frage", en: "an interesting question" }] },
  langweilig: { example: "Der Unterricht war heute langweilig.", exampleEn: "The lesson was boring today.", opposite: "interessant", level: "A1", combos: [{ de: "ein langweiliger Film", en: "a boring film" }] },
  wichtig: { example: "Diese Prüfung ist sehr wichtig.", exampleEn: "This exam is very important.", opposite: "unwichtig", level: "A1", combos: [{ de: "eine wichtige Frage", en: "an important question" }, { de: "ein wichtiger Termin", en: "an important appointment" }] },
  freundlich: { example: "Die Verkäuferin war sehr freundlich.", exampleEn: "The shop assistant was very friendly.", opposite: "unfreundlich", level: "A1", combos: [{ de: "ein freundliches Lächeln", en: "a friendly smile" }, { de: "freundliche Nachbarn", en: "friendly neighbors" }] },
  nett: { example: "Deine Eltern sind wirklich nett.", exampleEn: "Your parents are really nice.", opposite: "unfreundlich", level: "A1", combos: [{ de: "nette Leute", en: "nice people" }, { de: "ein netter Abend", en: "a nice evening" }] },
  hell: { example: "Im Sommer ist es lange hell.", exampleEn: "In summer it stays light for a long time.", opposite: "dunkel", level: "A1", combos: [{ de: "ein helles Zimmer", en: "a bright room" }, { de: "helle Farben", en: "bright colors" }] },
  dunkel: { example: "Im Winter wird es früh dunkel.", exampleEn: "In winter it gets dark early.", opposite: "hell", level: "A1", combos: [{ de: "ein dunkler Raum", en: "a dark room" }, { de: "dunkle Wolken", en: "dark clouds" }] },
  trocken: { example: "Die Wäsche ist noch nicht trocken.", exampleEn: "The laundry is not dry yet.", opposite: "nass", level: "A2", combos: [{ de: "trockene Luft", en: "dry air" }, { de: "ein trockener Sommer", en: "a dry summer" }] },
  nass: { example: "Meine Schuhe sind ganz nass.", exampleEn: "My shoes are completely wet.", opposite: "trocken", level: "A2", combos: [{ de: "nasse Haare", en: "wet hair" }, { de: "eine nasse Straße", en: "a wet street" }] },
  weich: { example: "Das Bett ist schön weich.", exampleEn: "The bed is nice and soft.", opposite: "hart", level: "A2", combos: [{ de: "ein weiches Kissen", en: "a soft pillow" }, { de: "weiches Brot", en: "soft bread" }] },
  hart: { example: "Das Brot ist schon hart.", exampleEn: "The bread is already hard.", opposite: "weich", level: "A2", combos: [{ de: "harte Arbeit", en: "hard work" }, { de: "ein harter Winter", en: "a hard winter" }] },
  süß: { example: "Der Kuchen ist mir zu süß.", exampleEn: "The cake is too sweet for me.", opposite: "sauer", level: "A1", combos: [{ de: "süße Erdbeeren", en: "sweet strawberries" }, { de: "ein süßes Baby", en: "a cute baby" }] },
  sauer: { example: "Die Zitrone ist sehr sauer.", exampleEn: "The lemon is very sour.", opposite: "süß", level: "A2", combos: [{ de: "saure Äpfel", en: "sour apples" }, { de: "saure Gurken", en: "pickled gherkins" }] },
  frisch: { example: "Der Salat ist ganz frisch.", exampleEn: "The salad is completely fresh.", opposite: "alt", level: "A1", combos: [{ de: "frisches Brot", en: "fresh bread" }, { de: "frische Luft", en: "fresh air" }] },
};

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

/** Build details for a German adjective; null if it can't be analyzed. */
export function getAdjectiveInfo(german: string): AdjectiveInfo | null {
  const base = german.trim().toLowerCase();
  if (!base || base.length < 3 || base.includes(" ")) return null;

  const irregular = IRREGULAR[base];
  const gradable = !NOT_GRADABLE.has(base);
  return {
    base,
    comparative: gradable ? (irregular?.comp ?? comparativeOf(base)) : null,
    superlative: gradable ? (irregular?.sup ?? superlativeOf(base)) : null,
    irregular: !!irregular,
    ...EXTRAS[base],
  };
}
