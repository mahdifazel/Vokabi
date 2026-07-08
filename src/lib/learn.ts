import { db } from "./db";
import type { Word } from "./types";

export type LearnSource =
  | { kind: "all" }
  | { kind: "fav" }
  | { kind: "group"; id: number };

export function sourceParam(src: LearnSource): string {
  if (src.kind === "group") return `group:${src.id}`;
  return src.kind;
}

export function parseSource(raw: string | null): LearnSource {
  if (raw === "fav") return { kind: "fav" };
  const m = raw?.match(/^group:(\d+)$/);
  if (m) return { kind: "group", id: Number(m[1]) };
  return { kind: "all" };
}

export async function loadSourceWords(src: LearnSource): Promise<Word[]> {
  if (src.kind === "fav") return db.words.where("favorite").equals(1).toArray();
  if (src.kind === "group") return db.words.where("groupIds").equals(src.id).toArray();
  return db.words.toArray();
}

export async function sourceLabel(src: LearnSource): Promise<string> {
  if (src.kind === "fav") return "Favorites";
  if (src.kind === "group") {
    const g = await db.groups.get(src.id);
    return g?.name ?? "Group";
  }
  return "All words";
}

export function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ---------------------------------------------------------------------------
// Quiz building
// ---------------------------------------------------------------------------

export type QuizType = "de-en" | "en-de" | "article";

export interface QuizQuestion {
  word: Word;
  type: QuizType;
  prompt: string;
  options: string[];
  correct: string;
}

function primaryEnglish(w: Word): string | undefined {
  return w.english?.split(";")[0]?.trim() || undefined;
}

/** Build a quiz of up to `count` questions from the given words. */
export function buildQuiz(words: Word[], count = 15): QuizQuestion[] {
  const usable = shuffle(words.filter((w) => primaryEnglish(w) || w.article));
  const englishPool = [
    ...new Set(words.map(primaryEnglish).filter((e): e is string => !!e)),
  ];
  const germanPool = [...new Set(words.map((w) => w.german))];

  const questions: QuizQuestion[] = [];
  for (const word of usable) {
    if (questions.length >= count) break;
    const english = primaryEnglish(word);

    const types: QuizType[] = [];
    if (english && englishPool.length >= 2) types.push("de-en");
    if (english && germanPool.length >= 2) types.push("en-de");
    if (word.article) types.push("article");
    if (types.length === 0) continue;

    const type = types[Math.floor(Math.random() * types.length)];

    if (type === "article") {
      questions.push({
        word,
        type,
        prompt: word.german,
        options: ["der", "die", "das"],
        correct: word.article!,
      });
    } else if (type === "de-en") {
      const correct = english!;
      const distractors = shuffle(englishPool.filter((e) => e !== correct)).slice(0, 3);
      questions.push({
        word,
        type,
        prompt: word.article ? `${word.article} ${word.german}` : word.german,
        options: shuffle([correct, ...distractors]),
        correct,
      });
    } else {
      const correct = word.german;
      const distractors = shuffle(germanPool.filter((g) => g !== correct)).slice(0, 3);
      questions.push({
        word,
        type,
        prompt: english!,
        options: shuffle([correct, ...distractors]),
        correct,
      });
    }
  }
  return questions;
}
