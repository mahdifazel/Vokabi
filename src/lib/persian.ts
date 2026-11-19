"use client";

import { db } from "./db";
import { AI_PERSIAN_BATCH, generatePersianWithAi } from "./ai";
import { createBackfill, rememberInCache } from "./backfill";
import { getSettings } from "./settings";
import { getAdjectiveInfo } from "./adjectives";
import { getVerbInfo } from "./verbs";
import type { Word } from "./types";

/**
 * Background backfill of Persian translations (see backfill.ts for the shared
 * engine): every ready word or sentence without a Persian translation, or
 * whose example sentence has none yet, gets one, first from the dictionary
 * cache, then from the AI route in small batches. Only runs while the meaning
 * language is Persian, so other users never spend AI requests on it.
 */

/**
 * The example sentence the word page shows: the word's own, else the curated
 * one from the verb/adjective data (those words never get one backfilled).
 */
function shownExample(w: Word): string | undefined {
  if (w.example) return w.example;
  if (w.pos === "verb") return getVerbInfo(w.german)?.example;
  if (w.pos === "adjective") return getAdjectiveInfo(w.german)?.example;
  return undefined;
}

function missingPersian(w: Word): boolean {
  return !w.translationFa || (!!shownExample(w) && !w.exampleFa);
}

const persian = createBackfill({
  name: "vokabi.persianBackfill",
  batchSize: AI_PERSIAN_BATCH,
  enabled: () => getSettings().meaningLanguage === "fa",
  needs: missingPersian,
  // the cached example translation only applies when it is the same example
  fromCache: async (w) => {
    const cached = await db.dictCache.get(w.german.toLowerCase()).catch(() => undefined);
    if (!cached || cached.miss) return {};
    const updates: Partial<Word> = {};
    if (!w.translationFa && cached.translationFa) updates.translationFa = cached.translationFa;
    if (w.example && !w.exampleFa && cached.exampleFa && cached.example === w.example) {
      updates.exampleFa = cached.exampleFa;
    }
    if (Object.keys(updates).length > 0) await db.words.update(w.id!, updates);
    return updates;
  },
  request: (chunk) =>
    generatePersianWithAi(
      chunk.map((w) => ({
        german: w.german,
        english: w.english,
        article: w.article,
        pos: w.pos,
        example: shownExample(w),
      }))
    ),
  apply: async (w, found) => {
    if (!found) return {};
    // never overwrite a translation the user typed in themselves
    const updates: Partial<Word> = {};
    if (!w.translationFa) updates.translationFa = found.translationFa;
    if (found.exampleFa && shownExample(w) && !w.exampleFa) updates.exampleFa = found.exampleFa;
    if (Object.keys(updates).length === 0) return {};
    await db.words.update(w.id!, updates);
    if (updates.translationFa) {
      await rememberInCache(w.german, { translationFa: updates.translationFa });
    }
    const cached = await db.dictCache.get(w.german.toLowerCase()).catch(() => undefined);
    if (updates.exampleFa && cached?.example === w.example) {
      await rememberInCache(w.german, { exampleFa: updates.exampleFa });
    }
    return updates;
  },
});

/** Kick off a backfill pass shortly; safe to call often. */
export const schedulePersianBackfill = persian.schedule;

/**
 * The user deliberately switched the meaning language to Persian: forget any
 * backoff and per-word attempts from earlier failed passes and run again now.
 */
export const restartPersianBackfill = persian.restart;
