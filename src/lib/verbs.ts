"use client";

/**
 * German verb engine: present-tense conjugation, Perfekt (participle + sein/
 * haben), and grammar details (verb type, preposition, case, level).
 *
 * Curated data covers the common A1–B1 verbs; everything else falls back to
 * the regular conjugation rules, so any verb gets a full table. Separable
 * prefixes and reflexive "sich …" verbs are detected from the infinitive.
 */

export interface PresentConjugation {
  ich: string;
  du: string;
  er: string; // er/sie/es
  wir: string;
  ihr: string;
  sie: string; // sie/Sie
}

export type VerbCase = "Akkusativ" | "Dativ" | "Genitiv";

export interface VerbInfo {
  infinitive: string;
  present: PresentConjugation;
  /** full Präteritum table */
  praeteritum: PresentConjugation;
  /** 3rd-person-singular Präteritum principal part, e.g. "ging", "stand auf" */
  praeteritumEr: string;
  /** e.g. "ist gegangen" */
  perfekt: string;
  aux: "haben" | "sein";
  /** Regular / Irregular / Separable / Reflexive (can combine) */
  types: string[];
  example?: string;
  exampleEn?: string;
  /** e.g. "auf + Akkusativ" */
  prep?: string;
  caseGov?: VerbCase;
  level?: string;
}

// ---------------------------------------------------------------------------
// Curated data
// ---------------------------------------------------------------------------

/** Fully irregular present tenses (sein, haben, modals, …) */
const FULL_PRESENT: Record<string, PresentConjugation> = {
  sein: { ich: "bin", du: "bist", er: "ist", wir: "sind", ihr: "seid", sie: "sind" },
  haben: { ich: "habe", du: "hast", er: "hat", wir: "haben", ihr: "habt", sie: "haben" },
  werden: { ich: "werde", du: "wirst", er: "wird", wir: "werden", ihr: "werdet", sie: "werden" },
  wissen: { ich: "weiß", du: "weißt", er: "weiß", wir: "wissen", ihr: "wisst", sie: "wissen" },
  tun: { ich: "tue", du: "tust", er: "tut", wir: "tun", ihr: "tut", sie: "tun" },
  können: { ich: "kann", du: "kannst", er: "kann", wir: "können", ihr: "könnt", sie: "können" },
  müssen: { ich: "muss", du: "musst", er: "muss", wir: "müssen", ihr: "müsst", sie: "müssen" },
  wollen: { ich: "will", du: "willst", er: "will", wir: "wollen", ihr: "wollt", sie: "wollen" },
  sollen: { ich: "soll", du: "sollst", er: "soll", wir: "sollen", ihr: "sollt", sie: "sollen" },
  dürfen: { ich: "darf", du: "darfst", er: "darf", wir: "dürfen", ihr: "dürft", sie: "dürfen" },
  mögen: { ich: "mag", du: "magst", er: "mag", wir: "mögen", ihr: "mögt", sie: "mögen" },
};

interface StrongEntry {
  /** past participle, e.g. "gegangen" */
  part: string;
  /** Präteritum ich/er form, e.g. "ging"; a "-e" ending marks a weak/mixed stem */
  praet: string;
  aux?: "sein";
  /** irregular du/er forms of the base verb, e.g. "gibst"/"gibt" */
  du?: string;
  er?: string;
}

/** Strong & mixed verbs (irregular participle, optional present stem change) */
const STRONG: Record<string, StrongEntry> = {
  sein: { part: "gewesen", praet: "war", aux: "sein" },
  haben: { part: "gehabt", praet: "hatte" },
  werden: { part: "geworden", praet: "wurde", aux: "sein" },
  wissen: { part: "gewusst", praet: "wusste" },
  tun: { part: "getan", praet: "tat" },
  können: { part: "gekonnt", praet: "konnte" },
  müssen: { part: "gemusst", praet: "musste" },
  wollen: { part: "gewollt", praet: "wollte" },
  sollen: { part: "gesollt", praet: "sollte" },
  dürfen: { part: "gedurft", praet: "durfte" },
  mögen: { part: "gemocht", praet: "mochte" },
  gehen: { part: "gegangen", praet: "ging", aux: "sein" },
  kommen: { part: "gekommen", praet: "kam", aux: "sein" },
  fahren: { part: "gefahren", praet: "fuhr", aux: "sein", du: "fährst", er: "fährt" },
  essen: { part: "gegessen", praet: "aß", du: "isst", er: "isst" },
  lesen: { part: "gelesen", praet: "las", du: "liest", er: "liest" },
  sehen: { part: "gesehen", praet: "sah", du: "siehst", er: "sieht" },
  sprechen: { part: "gesprochen", praet: "sprach", du: "sprichst", er: "spricht" },
  nehmen: { part: "genommen", praet: "nahm", du: "nimmst", er: "nimmt" },
  geben: { part: "gegeben", praet: "gab", du: "gibst", er: "gibt" },
  helfen: { part: "geholfen", praet: "half", du: "hilfst", er: "hilft" },
  laufen: { part: "gelaufen", praet: "lief", aux: "sein", du: "läufst", er: "läuft" },
  schlafen: { part: "geschlafen", praet: "schlief", du: "schläfst", er: "schläft" },
  tragen: { part: "getragen", praet: "trug", du: "trägst", er: "trägt" },
  waschen: { part: "gewaschen", praet: "wusch", du: "wäschst", er: "wäscht" },
  fallen: { part: "gefallen", praet: "fiel", aux: "sein", du: "fällst", er: "fällt" },
  halten: { part: "gehalten", praet: "hielt", du: "hältst", er: "hält" },
  lassen: { part: "gelassen", praet: "ließ", du: "lässt", er: "lässt" },
  fangen: { part: "gefangen", praet: "fing", du: "fängst", er: "fängt" },
  laden: { part: "geladen", praet: "lud", du: "lädst", er: "lädt" },
  treffen: { part: "getroffen", praet: "traf", du: "triffst", er: "trifft" },
  sterben: { part: "gestorben", praet: "starb", aux: "sein", du: "stirbst", er: "stirbt" },
  bleiben: { part: "geblieben", praet: "blieb", aux: "sein" },
  schreiben: { part: "geschrieben", praet: "schrieb" },
  trinken: { part: "getrunken", praet: "trank" },
  finden: { part: "gefunden", praet: "fand" },
  singen: { part: "gesungen", praet: "sang" },
  schwimmen: { part: "geschwommen", praet: "schwamm", aux: "sein" },
  fliegen: { part: "geflogen", praet: "flog", aux: "sein" },
  ziehen: { part: "gezogen", praet: "zog" },
  steigen: { part: "gestiegen", praet: "stieg", aux: "sein" },
  stehen: { part: "gestanden", praet: "stand" },
  sitzen: { part: "gesessen", praet: "saß" },
  liegen: { part: "gelegen", praet: "lag" },
  heißen: { part: "geheißen", praet: "hieß" },
  rufen: { part: "gerufen", praet: "rief" },
  schließen: { part: "geschlossen", praet: "schloss" },
  bringen: { part: "gebracht", praet: "brachte" },
  denken: { part: "gedacht", praet: "dachte" },
  kennen: { part: "gekannt", praet: "kannte" },
  nennen: { part: "genannt", praet: "nannte" },
  rennen: { part: "gerannt", praet: "rannte", aux: "sein" },
  brennen: { part: "gebrannt", praet: "brannte" },
  beginnen: { part: "begonnen", praet: "begann" },
  gewinnen: { part: "gewonnen", praet: "gewann" },
  verlieren: { part: "verloren", praet: "verlor" },
  vergessen: { part: "vergessen", praet: "vergaß", du: "vergisst", er: "vergisst" },
  verstehen: { part: "verstanden", praet: "verstand" },
  empfehlen: { part: "empfohlen", praet: "empfahl", du: "empfiehlst", er: "empfiehlt" },
  gefallen: { part: "gefallen", praet: "gefiel", du: "gefällst", er: "gefällt" },
  bekommen: { part: "bekommen", praet: "bekam" },
  bitten: { part: "gebeten", praet: "bat" },
};

/** Separable/derived verbs whose auxiliary differs from their base verb */
const AUX_OVERRIDES: Record<string, "sein" | "haben"> = {
  aufstehen: "sein",
  aufwachen: "sein",
  einschlafen: "sein",
  umziehen: "sein",
  passieren: "sein",
  reisen: "sein",
  wandern: "sein",
  joggen: "sein",
};

interface VerbExtras {
  example?: string;
  exampleEn?: string;
  prep?: string;
  caseGov?: VerbCase;
  level?: string;
}

/** Examples, prepositions, cases and levels, keyed by infinitive (without "sich") */
const EXTRAS: Record<string, VerbExtras> = {
  sein: { example: "Ich bin heute sehr müde.", exampleEn: "I am very tired today.", level: "A1" },
  haben: { example: "Wir haben zwei Katzen.", exampleEn: "We have two cats.", caseGov: "Akkusativ", level: "A1" },
  werden: { example: "Es wird langsam dunkel.", exampleEn: "It is slowly getting dark.", level: "A1" },
  wissen: { example: "Ich weiß die Antwort nicht.", exampleEn: "I don't know the answer.", level: "A1" },
  können: { example: "Kannst du mir bitte helfen?", exampleEn: "Can you please help me?", level: "A1" },
  müssen: { example: "Ich muss morgen früh aufstehen.", exampleEn: "I have to get up early tomorrow.", level: "A1" },
  wollen: { example: "Wir wollen am Samstag ins Kino gehen.", exampleEn: "We want to go to the cinema on Saturday.", level: "A1" },
  sollen: { example: "Du sollst mehr Wasser trinken.", exampleEn: "You should drink more water.", level: "A1" },
  dürfen: { example: "Hier darf man nicht rauchen.", exampleEn: "Smoking is not allowed here.", level: "A1" },
  mögen: { example: "Ich mag deutsche Musik.", exampleEn: "I like German music.", caseGov: "Akkusativ", level: "A1" },
  tun: { example: "Was kann ich für dich tun?", exampleEn: "What can I do for you?", level: "A2" },
  gehen: { example: "Ich gehe jeden Morgen zu Fuß zur Arbeit.", exampleEn: "I walk to work every morning.", level: "A1" },
  kommen: { example: "Kommst du heute Abend zur Party?", exampleEn: "Are you coming to the party tonight?", level: "A1" },
  fahren: { example: "Wir fahren im Sommer nach Italien.", exampleEn: "We are driving to Italy in the summer.", level: "A1" },
  essen: { example: "Er isst gern Pizza.", exampleEn: "He likes eating pizza.", caseGov: "Akkusativ", level: "A1" },
  lesen: { example: "Sie liest jeden Abend ein Buch.", exampleEn: "She reads a book every evening.", caseGov: "Akkusativ", level: "A1" },
  sehen: { example: "Von hier siehst du die Berge.", exampleEn: "From here you can see the mountains.", caseGov: "Akkusativ", level: "A1" },
  sprechen: { example: "Sprichst du Deutsch?", exampleEn: "Do you speak German?", prep: "mit + Dativ", level: "A1" },
  nehmen: { example: "Ich nehme den Bus zur Arbeit.", exampleEn: "I take the bus to work.", caseGov: "Akkusativ", level: "A1" },
  geben: { example: "Gibst du mir bitte das Salz?", exampleEn: "Will you please give me the salt?", caseGov: "Dativ", level: "A1" },
  helfen: { example: "Ich helfe dir gern beim Umzug.", exampleEn: "I'm happy to help you with the move.", caseGov: "Dativ", level: "A1" },
  laufen: { example: "Die Kinder laufen im Park.", exampleEn: "The children are running in the park.", level: "A1" },
  schlafen: { example: "Am Wochenende schlafe ich lange.", exampleEn: "On weekends I sleep in.", level: "A1" },
  tragen: { example: "Sie trägt heute ein rotes Kleid.", exampleEn: "She is wearing a red dress today.", caseGov: "Akkusativ", level: "A2" },
  waschen: { example: "Er wäscht sein Auto jeden Samstag.", exampleEn: "He washes his car every Saturday.", caseGov: "Akkusativ", level: "A2" },
  fallen: { example: "Im Herbst fallen die Blätter.", exampleEn: "In autumn the leaves fall.", level: "A2" },
  halten: { example: "Der Zug hält nicht an jedem Bahnhof.", exampleEn: "The train doesn't stop at every station.", level: "A2" },
  lassen: { example: "Ich lasse mein Auto heute zu Hause.", exampleEn: "I'm leaving my car at home today.", level: "A2" },
  treffen: { example: "Wir treffen uns um acht vor dem Kino.", exampleEn: "We're meeting at eight in front of the cinema.", prep: "mit + Dativ", level: "A2" },
  sterben: { example: "Die Pflanze stirbt ohne Wasser.", exampleEn: "The plant dies without water.", level: "B1" },
  bleiben: { example: "Heute bleibe ich zu Hause.", exampleEn: "Today I'm staying at home.", level: "A1" },
  schreiben: { example: "Ich schreibe dir morgen eine E-Mail.", exampleEn: "I'll write you an email tomorrow.", prep: "an + Akkusativ", level: "A1" },
  trinken: { example: "Trinkst du Kaffee oder Tee?", exampleEn: "Do you drink coffee or tea?", caseGov: "Akkusativ", level: "A1" },
  finden: { example: "Ich finde meinen Schlüssel nicht.", exampleEn: "I can't find my key.", caseGov: "Akkusativ", level: "A1" },
  singen: { example: "Sie singt im Chor.", exampleEn: "She sings in a choir.", level: "A2" },
  schwimmen: { example: "Im Sommer schwimmen wir im See.", exampleEn: "In summer we swim in the lake.", level: "A1" },
  fliegen: { example: "Morgen fliegen wir nach Berlin.", exampleEn: "Tomorrow we're flying to Berlin.", level: "A2" },
  ziehen: { example: "Er zieht den schweren Koffer hinter sich her.", exampleEn: "He pulls the heavy suitcase behind him.", caseGov: "Akkusativ", level: "A2" },
  steigen: { example: "Die Preise steigen jedes Jahr.", exampleEn: "Prices rise every year.", level: "A2" },
  stehen: { example: "Das Fahrrad steht vor der Tür.", exampleEn: "The bicycle is standing in front of the door.", level: "A1" },
  sitzen: { example: "Wir sitzen gern im Garten.", exampleEn: "We like sitting in the garden.", level: "A2" },
  liegen: { example: "Das Buch liegt auf dem Tisch.", exampleEn: "The book is lying on the table.", level: "A2" },
  heißen: { example: "Wie heißt du?", exampleEn: "What is your name?", level: "A1" },
  rufen: { example: "Die Mutter ruft die Kinder zum Essen.", exampleEn: "The mother calls the children to dinner.", caseGov: "Akkusativ", level: "A2" },
  schließen: { example: "Bitte schließ das Fenster.", exampleEn: "Please close the window.", caseGov: "Akkusativ", level: "A2" },
  öffnen: { example: "Sie öffnet die Tür.", exampleEn: "She opens the door.", caseGov: "Akkusativ", level: "A2" },
  bringen: { example: "Ich bringe dir einen Kaffee mit.", exampleEn: "I'll bring you a coffee.", caseGov: "Dativ", level: "A1" },
  denken: { example: "Ich denke oft an meine Familie.", exampleEn: "I often think about my family.", prep: "an + Akkusativ", level: "A1" },
  kennen: { example: "Kennst du diesen Film?", exampleEn: "Do you know this film?", caseGov: "Akkusativ", level: "A1" },
  nennen: { example: "Alle nennen ihn Max.", exampleEn: "Everyone calls him Max.", caseGov: "Akkusativ", level: "B1" },
  rennen: { example: "Er rennt zum Bus.", exampleEn: "He runs to the bus.", level: "A2" },
  beginnen: { example: "Der Kurs beginnt um neun Uhr.", exampleEn: "The course starts at nine o'clock.", prep: "mit + Dativ", level: "A2" },
  gewinnen: { example: "Unsere Mannschaft hat das Spiel gewonnen.", exampleEn: "Our team won the game.", caseGov: "Akkusativ", level: "A2" },
  verlieren: { example: "Ich habe meinen Regenschirm verloren.", exampleEn: "I lost my umbrella.", caseGov: "Akkusativ", level: "A2" },
  vergessen: { example: "Vergiss deine Hausaufgaben nicht!", exampleEn: "Don't forget your homework!", caseGov: "Akkusativ", level: "A2" },
  verstehen: { example: "Ich verstehe diese Frage nicht.", exampleEn: "I don't understand this question.", caseGov: "Akkusativ", level: "A1" },
  empfehlen: { example: "Der Kellner empfiehlt den Fisch.", exampleEn: "The waiter recommends the fish.", caseGov: "Dativ", level: "B1" },
  gefallen: { example: "Der Film gefällt mir sehr.", exampleEn: "I like the film a lot.", caseGov: "Dativ", level: "A2" },
  bekommen: { example: "Sie bekommt viele Geschenke.", exampleEn: "She receives many presents.", caseGov: "Akkusativ", level: "A2" },
  bitten: { example: "Ich bitte dich um einen Gefallen.", exampleEn: "I'm asking you for a favor.", prep: "um + Akkusativ", level: "B1" },
  machen: { example: "Was machst du am Wochenende?", exampleEn: "What are you doing at the weekend?", caseGov: "Akkusativ", level: "A1" },
  sagen: { example: "Was hast du gesagt?", exampleEn: "What did you say?", level: "A1" },
  fragen: { example: "Darf ich dich etwas fragen?", exampleEn: "May I ask you something?", prep: "nach + Dativ", level: "A1" },
  antworten: { example: "Sie antwortet mir nicht.", exampleEn: "She doesn't answer me.", caseGov: "Dativ", level: "A2" },
  danken: { example: "Ich danke dir für deine Hilfe.", exampleEn: "I thank you for your help.", caseGov: "Dativ", prep: "für + Akkusativ", level: "A2" },
  gehören: { example: "Das Fahrrad gehört meinem Bruder.", exampleEn: "The bicycle belongs to my brother.", caseGov: "Dativ", level: "A2" },
  glauben: { example: "Ich glaube dir.", exampleEn: "I believe you.", prep: "an + Akkusativ", level: "A1" },
  wohnen: { example: "Ich wohne seit zwei Jahren in Berlin.", exampleEn: "I have lived in Berlin for two years.", level: "A1" },
  leben: { example: "Meine Großeltern leben auf dem Land.", exampleEn: "My grandparents live in the countryside.", level: "A1" },
  lernen: { example: "Ich lerne jeden Tag zehn neue Wörter.", exampleEn: "I learn ten new words every day.", caseGov: "Akkusativ", level: "A1" },
  arbeiten: { example: "Sie arbeitet in einem Krankenhaus.", exampleEn: "She works in a hospital.", prep: "bei + Dativ", level: "A1" },
  spielen: { example: "Die Kinder spielen im Garten Fußball.", exampleEn: "The children are playing football in the garden.", level: "A1" },
  kaufen: { example: "Ich kaufe frisches Brot beim Bäcker.", exampleEn: "I buy fresh bread at the bakery.", caseGov: "Akkusativ", level: "A1" },
  brauchen: { example: "Wir brauchen noch Milch und Eier.", exampleEn: "We still need milk and eggs.", caseGov: "Akkusativ", level: "A1" },
  suchen: { example: "Er sucht seine Brille.", exampleEn: "He is looking for his glasses.", caseGov: "Akkusativ", level: "A1" },
  lieben: { example: "Ich liebe den Sommer.", exampleEn: "I love the summer.", caseGov: "Akkusativ", level: "A1" },
  hören: { example: "Ich höre gern Musik beim Kochen.", exampleEn: "I like listening to music while cooking.", caseGov: "Akkusativ", level: "A1" },
  kochen: { example: "Heute koche ich Nudeln mit Tomatensoße.", exampleEn: "Today I'm cooking pasta with tomato sauce.", level: "A1" },
  reisen: { example: "Sie reist gern durch Europa.", exampleEn: "She likes traveling through Europe.", level: "A2" },
  warten: { example: "Ich warte seit zwanzig Minuten auf den Bus.", exampleEn: "I have been waiting for the bus for twenty minutes.", prep: "auf + Akkusativ", level: "A1" },
  besuchen: { example: "Am Sonntag besuchen wir meine Oma.", exampleEn: "On Sunday we're visiting my grandma.", caseGov: "Akkusativ", level: "A1" },
  bezahlen: { example: "Kann ich mit Karte bezahlen?", exampleEn: "Can I pay by card?", caseGov: "Akkusativ", level: "A1" },
  erklären: { example: "Die Lehrerin erklärt die Grammatik.", exampleEn: "The teacher explains the grammar.", caseGov: "Dativ", level: "A2" },
  erzählen: { example: "Opa erzählt eine Geschichte.", exampleEn: "Grandpa tells a story.", caseGov: "Dativ", level: "A2" },
  studieren: { example: "Mein Bruder studiert Medizin in München.", exampleEn: "My brother studies medicine in Munich.", level: "A2" },
  telefonieren: { example: "Sie telefoniert jeden Tag mit ihrer Mutter.", exampleEn: "She talks on the phone with her mother every day.", prep: "mit + Dativ", level: "A2" },
  passieren: { example: "Was ist gestern passiert?", exampleEn: "What happened yesterday?", level: "A2" },
  aufstehen: { example: "Ich stehe jeden Tag um sieben Uhr auf.", exampleEn: "I get up at seven o'clock every day.", level: "A1" },
  aufwachen: { example: "Das Baby wacht nachts oft auf.", exampleEn: "The baby often wakes up at night.", level: "A2" },
  einschlafen: { example: "Er schläft immer vor dem Fernseher ein.", exampleEn: "He always falls asleep in front of the TV.", level: "A2" },
  einkaufen: { example: "Samstags kaufen wir im Supermarkt ein.", exampleEn: "On Saturdays we shop at the supermarket.", level: "A1" },
  einladen: { example: "Ich lade dich zu meinem Geburtstag ein.", exampleEn: "I'm inviting you to my birthday.", caseGov: "Akkusativ", prep: "zu + Dativ", level: "A2" },
  anfangen: { example: "Der Film fängt gleich an.", exampleEn: "The film is starting soon.", prep: "mit + Dativ", level: "A2" },
  ankommen: { example: "Der Zug kommt um 18 Uhr in Hamburg an.", exampleEn: "The train arrives in Hamburg at 6 p.m.", level: "A2" },
  anrufen: { example: "Ruf mich bitte heute Abend an.", exampleEn: "Please call me tonight.", caseGov: "Akkusativ", level: "A1" },
  fernsehen: { example: "Abends sehen wir zusammen fern.", exampleEn: "In the evenings we watch TV together.", level: "A1" },
  mitkommen: { example: "Kommst du mit ins Schwimmbad?", exampleEn: "Are you coming along to the pool?", level: "A2" },
  umziehen: { example: "Wir ziehen nächsten Monat nach Köln um.", exampleEn: "We're moving to Cologne next month.", level: "A2" },
  ausgehen: { example: "Am Freitag gehen wir zusammen aus.", exampleEn: "On Friday we're going out together.", level: "A2" },
  zumachen: { example: "Mach bitte die Tür zu.", exampleEn: "Please close the door.", caseGov: "Akkusativ", level: "A2" },
  aufmachen: { example: "Kannst du das Fenster aufmachen?", exampleEn: "Can you open the window?", caseGov: "Akkusativ", level: "A2" },
  freuen: { example: "Ich freue mich auf das Wochenende.", exampleEn: "I'm looking forward to the weekend.", prep: "auf + Akkusativ", level: "A2" },
  interessieren: { example: "Er interessiert sich für Geschichte.", exampleEn: "He is interested in history.", prep: "für + Akkusativ", level: "B1" },
  erinnern: { example: "Ich erinnere mich gern an den Urlaub.", exampleEn: "I like remembering the vacation.", prep: "an + Akkusativ", level: "B1" },
  duschen: { example: "Ich dusche jeden Morgen.", exampleEn: "I take a shower every morning.", level: "A1" },
  wandern: { example: "Im Urlaub wandern wir in den Bergen.", exampleEn: "On vacation we hike in the mountains.", level: "A2" },
};

// ---------------------------------------------------------------------------
// Infinitive analysis: reflexive + separable prefix detection
// ---------------------------------------------------------------------------

// longest first so "zurück" wins over "zu"
const SEPARABLE_PREFIXES = [
  "zusammen", "zurück", "weiter", "herunter", "herauf", "heraus", "herein",
  "hinaus", "hinein", "vorbei", "statt", "fern", "fest", "los", "mit", "nach",
  "weg", "an", "ab", "auf", "aus", "bei", "ein", "her", "hin", "um", "vor", "zu",
];

/** Verbs that start like a separable prefix but are not separable */
const NOT_SEPARABLE = new Set(["antworten", "umarmen", "beantworten", "einigen"]);

const INSEPARABLE_PREFIXES = ["be", "emp", "ent", "er", "ge", "miss", "ver", "zer"];

interface ParsedVerb {
  reflexive: boolean;
  prefix: string; // separable prefix, "" if none
  base: string; // infinitive without reflexive pronoun and separable prefix
}

function parseInfinitive(raw: string): ParsedVerb | null {
  let inf = raw.trim().toLowerCase();
  const reflexive = inf.startsWith("sich ");
  if (reflexive) inf = inf.slice(5).trim();
  // phrases and multi-word entries can't be conjugated reliably
  if (!inf || inf.includes(" ") || !/n$/.test(inf) || inf.length < 3) return null;

  if (STRONG[inf] || FULL_PRESENT[inf] || NOT_SEPARABLE.has(inf)) {
    return { reflexive, prefix: "", base: inf };
  }
  for (const p of SEPARABLE_PREFIXES) {
    if (!inf.startsWith(p)) continue;
    const rest = inf.slice(p.length);
    // the remainder must look like a real infinitive
    if (rest.length >= 4 && /[aeiouäöü]/.test(rest.slice(0, -1)) && /(en|ln|rn)$/.test(rest)) {
      return { reflexive, prefix: p, base: rest };
    }
  }
  return { reflexive, prefix: "", base: inf };
}

// ---------------------------------------------------------------------------
// Present tense
// ---------------------------------------------------------------------------

function stemOf(inf: string): string {
  if (inf.endsWith("en")) return inf.slice(0, -2);
  if (inf.endsWith("n")) return inf.slice(0, -1);
  return inf;
}

/** stems needing an -e- before -st/-t (arbeitest, findet, öffnet, atmet) */
function needsE(stem: string): boolean {
  if (/[td]$/.test(stem)) return true;
  return /[^aeiouäöülrh][mn]$/.test(stem);
}

function conjugateBase(inf: string): PresentConjugation {
  const full = FULL_PRESENT[inf];
  if (full) return { ...full };

  const stem = stemOf(inf);
  const e = needsE(stem) ? "e" : "";
  // stems ending in a sibilant only add -t for "du" (du heißt, du sitzt)
  const duEnding = /(s|ss|ß|x|z)$/.test(stem) ? "t" : `${e}st`;
  // -eln verbs drop the stem e for "ich" (sammeln → ich sammle)
  const ichForm = /el$/.test(stem) ? `${stem.slice(0, -2)}le` : `${stem}e`;
  const strong = STRONG[inf];

  return {
    ich: ichForm,
    du: strong?.du ?? `${stem}${duEnding}`,
    er: strong?.er ?? `${stem}${e}t`,
    wir: inf,
    ihr: `${stem}${e}t`,
    sie: inf,
  };
}

const REFLEXIVE_PRONOUNS = { ich: "mich", du: "dich", er: "sich", wir: "uns", ihr: "euch", sie: "sich" } as const;

/** Append reflexive pronoun and separable prefix to each base form */
function assemble(parsed: ParsedVerb, base: PresentConjugation): PresentConjugation {
  const out = {} as PresentConjugation;
  (Object.keys(base) as (keyof PresentConjugation)[]).forEach((p) => {
    let form = base[p];
    if (parsed.reflexive) form += ` ${REFLEXIVE_PRONOUNS[p]}`;
    if (parsed.prefix) form += ` ${parsed.prefix}`;
    out[p] = form;
  });
  return out;
}

// ---------------------------------------------------------------------------
// Präteritum
// ---------------------------------------------------------------------------

/** Präteritum ich/er form for a bare infinitive (regular guess when unknown) */
function praetStemOf(inf: string): string {
  const strong = STRONG[inf];
  if (strong) return strong.praet;
  // inseparable prefix + strong base: erfahren → er + fuhr
  for (const p of INSEPARABLE_PREFIXES) {
    if (!inf.startsWith(p)) continue;
    const rest = inf.slice(p.length);
    if (rest.length >= 4 && STRONG[rest]) return p + STRONG[rest].praet;
  }
  const stem = stemOf(inf);
  return stem + (needsE(stem) ? "ete" : "te");
}

function conjugatePraetBase(inf: string): PresentConjugation {
  const stem = praetStemOf(inf);
  if (stem.endsWith("e")) {
    // weak & mixed stems: machte → machtest/machten, dachte → dachtest
    return { ich: stem, du: `${stem}st`, er: stem, wir: `${stem}n`, ihr: `${stem}t`, sie: `${stem}n` };
  }
  // strong stems: ging → gingst/gingen; du inserts an e after t/d/sibilants
  // (fandest, aßest) but ihr only after t/d (ihr fandet, yet ihr aßt)
  const eDu = /[tdsßz]$/.test(stem) ? "e" : "";
  const eIhr = /[td]$/.test(stem) ? "e" : "";
  return {
    ich: stem,
    du: `${stem}${eDu}st`,
    er: stem,
    wir: `${stem}en`,
    ihr: `${stem}${eIhr}t`,
    sie: `${stem}en`,
  };
}

// ---------------------------------------------------------------------------
// Perfekt
// ---------------------------------------------------------------------------

/** verbs whose participle doesn't follow the rules (e.g. inseparable "um-") */
const PARTICIPLE_OVERRIDES: Record<string, string> = {
  umarmen: "umarmt",
};

function baseParticiple(inf: string): string {
  if (PARTICIPLE_OVERRIDES[inf]) return PARTICIPLE_OVERRIDES[inf];
  const strong = STRONG[inf];
  if (strong) return strong.part;
  // inseparable prefix + strong base: verstehen → ver + (ge)standen
  for (const p of INSEPARABLE_PREFIXES) {
    if (!inf.startsWith(p)) continue;
    const rest = inf.slice(p.length);
    const restStrong = STRONG[rest];
    if (rest.length >= 4 && restStrong) return p + restStrong.part.replace(/^ge/, "");
  }
  const stem = stemOf(inf);
  const t = needsE(stem) ? "et" : "t";
  const noGe = inf.endsWith("ieren") || INSEPARABLE_PREFIXES.some((p) => inf.startsWith(p) && inf.length - p.length >= 4);
  return noGe ? `${stem}${t}` : `ge${stem}${t}`;
}

function auxOf(parsed: ParsedVerb): "haben" | "sein" {
  if (parsed.reflexive) return "haben";
  const full = parsed.prefix + parsed.base;
  if (AUX_OVERRIDES[full]) return AUX_OVERRIDES[full];
  return STRONG[parsed.base]?.aux ?? "haben";
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Build verb details for a German infinitive; null if it can't be analyzed. */
export function getVerbInfo(german: string): VerbInfo | null {
  const parsed = parseInfinitive(german);
  if (!parsed) return null;

  const full = parsed.prefix + parsed.base;
  const irregular = !!STRONG[parsed.base] || !!FULL_PRESENT[parsed.base] || !!STRONG[full];
  const aux = auxOf(parsed);
  const participle = parsed.prefix
    ? parsed.prefix + baseParticiple(parsed.base)
    : baseParticiple(parsed.base);

  const types: string[] = [];
  if (parsed.reflexive) types.push("Reflexive");
  if (parsed.prefix) types.push("Separable");
  types.push(irregular ? "Irregular" : "Regular");

  const extras = EXTRAS[full] ?? EXTRAS[parsed.base];
  const praeteritum = assemble(parsed, conjugatePraetBase(parsed.base));

  return {
    infinitive: german.trim(),
    present: assemble(parsed, conjugateBase(parsed.base)),
    praeteritum,
    praeteritumEr: praeteritum.er,
    perfekt: `${aux === "sein" ? "ist" : "hat"}${parsed.reflexive ? " sich" : ""} ${participle}`,
    aux,
    types,
    example: extras?.example,
    exampleEn: extras?.exampleEn,
    prep: extras?.prep,
    caseGov: extras?.caseGov,
    level: extras?.level,
  };
}
