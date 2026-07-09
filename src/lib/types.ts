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
  rate: number; // 0.5 | 0.75 | 1 | 1.25 | 1.5
  /** pause between words in seconds */
  pauseSec: number; // 0 | 0.5 | 1 | 2 | 3 | 5
  /** how many times each word is repeated */
  repeatCount: number; // 1 | 2 | 3 | 5
  readArticle: boolean;
  readTranslation: boolean;
  autoRepeat: boolean;
  shuffle: boolean;
  theme: "system" | "light" | "dark";
  /** preferred German voice URI, empty = auto-pick best */
  germanVoice: string;
}

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
