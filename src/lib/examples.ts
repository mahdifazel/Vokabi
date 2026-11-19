"use client";

import { db } from "./db";
import { AI_EXAMPLE_BATCH, generateExamplesWithAi } from "./ai";
import { createBackfill, rememberInCache } from "./backfill";
import { isSentence } from "./scan-rules";
import { getAdjectiveInfo } from "./adjectives";
import { getVerbInfo } from "./verbs";
import { schedulePersianBackfill } from "./persian";
import type { Word } from "./types";

/**
 * Background backfill of example sentences (see backfill.ts for the shared
 * engine): any ready word without one gets an example, first from the
 * dictionary cache (Wiktionary), then from the AI route in small batches.
 *
 * Known trade-off: a user who deliberately blanks a word's example may get it
 * refilled by a later pass.
 */

function needsExample(w: Word): boolean {
  if (w.example) return false;
  // sentence entries from scans are their own example
  if (isSentence(w.german)) return false;
  // curated verb/adjective examples already render in their sections
  if (w.pos === "verb" && getVerbInfo(w.german)?.example) return false;
  if (w.pos === "adjective" && getAdjectiveInfo(w.german)?.example) return false;
  return true;
}

const examples = createBackfill({
  name: "vokabi.exampleBackfill",
  batchSize: AI_EXAMPLE_BATCH,
  needs: needsExample,
  fromCache: async (w) => {
    const cached = await db.dictCache.get(w.german.toLowerCase()).catch(() => undefined);
    if (!cached || cached.miss || !cached.example) return {};
    const updates: Partial<Word> = {
      example: cached.example,
      ...(cached.exampleEn ? { exampleEn: cached.exampleEn } : {}),
    };
    await db.words.update(w.id!, updates);
    return updates;
  },
  request: (chunk) =>
    generateExamplesWithAi(
      chunk.map((w) => ({ german: w.german, english: w.english, article: w.article, pos: w.pos }))
    ),
  apply: async (w, found) => {
    if (!found) return {};
    const updates: Partial<Word> = {
      example: found.example,
      ...(found.exampleEn ? { exampleEn: found.exampleEn } : {}),
    };
    await db.words.update(w.id!, updates);
    // only fill an empty cache slot, never replace a Wiktionary example
    const cached = await db.dictCache.get(w.german.toLowerCase()).catch(() => undefined);
    if (cached && !cached.example) {
      await rememberInCache(w.german, {
        example: found.example,
        exampleEn: found.exampleEn || undefined,
      });
    }
    return updates;
  },
  // new examples need their Persian translation when that is the meaning language
  afterWrite: () => schedulePersianBackfill(),
});

/** Kick off a backfill pass shortly; safe to call often. */
export const scheduleExampleBackfill = examples.schedule;
