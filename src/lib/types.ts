export type Article = "der" | "die" | "das";

export type PartOfSpeech =
  | "noun"
  | "verb"
  | "adjective"
  | "adverb"
  | "pronoun"
  | "preposition"
  | "conjunction"
  | "interjection"
  | "numeral"
  | "phrase"
  | "other";

/** Enrichment status of a word after dictionary lookup */
export type WordStatus = "pending" | "ready" | "notfound";

export interface Word {
  id?: number;
  /** globally unique id used for cloud sync */
  uid?: string;
  /** 1 = has local changes not yet pushed to the cloud */
  dirty?: 0 | 1;
  /** German word without article, e.g. "Haus" */
  german: string;
  article?: Article;
  english?: string;
  plural?: string;
  ipa?: string;
  pos?: PartOfSpeech;
  example?: string;
  exampleEn?: string;
  /** simple German definition, shown when the meaning language is Deutsch */
  definitionDe?: string;
  notes?: string;
  favorite: 0 | 1; // number so Dexie can index it
  groupIds: number[];
  status: WordStatus;
  createdAt: number;
  updatedAt: number;
}

export interface Group {
  id?: number;
  /** globally unique id used for cloud sync */
  uid?: string;
  /** 1 = has local changes not yet pushed to the cloud */
  dirty?: 0 | 1;
  name: string;
  createdAt: number;
  updatedAt?: number;
}

/** Tombstone for a row deleted locally, awaiting cloud deletion */
export interface OutboxEntry {
  id?: number;
  table: "words" | "groups";
  uid: string;
}

export interface AppSettings {
  /** speech rate multiplier */
  rate: number; // one of RATE_STEPS
  /** pause between words in seconds */
  pauseSec: number; // one of PAUSE_STEPS
  /** how many times each word is repeated */
  repeatCount: number; // 1 | 2 | 3 | 5
  readArticle: boolean;
  readTranslation: boolean;
  autoRepeat: boolean;
  shuffle: boolean;
  theme: "system" | "light" | "dark";
  /** preferred German voice URI, empty = auto-pick best */
  germanVoice: string;
  /** language of the displayed meaning: English translation or German definition */
  meaningLanguage: "en" | "de";
}

/**
 * The positions each audio slider offers. They live here rather than in the
 * settings page because `settings.ts` has to snap stored values onto them:
 * a value saved under an older build (or a step later removed) would
 * otherwise survive untouched and the UI would disagree with what playback
 * actually does - the badge reading "0s" while the slider sits at "2s".
 */
export const RATE_STEPS = [0.25, 0.5, 0.75, 1, 1.25] as const;
export const PAUSE_STEPS = [1, 2, 3, 5, 8] as const;
export const REPEAT_STEPS = [1, 2, 3, 5] as const;

export const DEFAULT_SETTINGS: AppSettings = {
  rate: 1,
  pauseSec: 2,
  repeatCount: 1,
  readArticle: true,
  readTranslation: false,
  autoRepeat: false,
  shuffle: false,
  theme: "dark",
  germanVoice: "",
  meaningLanguage: "en",
};

/** Cached result of an online dictionary lookup */
export interface DictEntry {
  /** normalized lookup key (lowercased german word) */
  key: string;
  german: string;
  article?: Article;
  english?: string;
  plural?: string;
  ipa?: string;
  pos?: PartOfSpeech;
  example?: string;
  exampleEn?: string;
  definitionDe?: string;
  /** true when the online lookup found nothing */
  miss?: boolean;
  fetchedAt: number;
}

export const ARTICLE_COLORS: Record<Article, string> = {
  der: "text-blue-600 dark:text-blue-400",
  die: "text-rose-600 dark:text-rose-400",
  das: "text-emerald-600 dark:text-emerald-400",
};

export const ARTICLE_BG: Record<Article, string> = {
  der: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  die: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  das: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
};

// stable per-group tile hues from the same family as the der/die/das colors,
// so lists of groups read as a colorful shelf instead of a uniform indigo row
export const GROUP_TILES = [
  "bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300",
  "bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300",
  "bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300",
  "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
  "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
  "bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300",
];
