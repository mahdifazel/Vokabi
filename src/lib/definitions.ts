"use client";

import { db } from "./db";
import { AI_DEFINITION_BATCH, generateDefinitionsWithAi } from "./ai";
import { createBackfill, rememberInCache } from "./backfill";
import { getSettings } from "./settings";

/**
 * Background backfill of German definitions (see backfill.ts for the shared
 * engine): any ready word without one gets a short German definition, first
 * from the dictionary cache, then from the AI route in small batches. Only
 * runs while the meaning language is Deutsch, so other users never spend AI
 * requests on definitions.
 */
const definitions = createBackfill({
  name: "vokabi.definitionBackfill",
  batchSize: AI_DEFINITION_BATCH,
  enabled: () => getSettings().meaningLanguage === "de",
  // sentence entries get a simple German paraphrase (the route detects them)
  needs: (w) => !w.definitionDe,
  fromCache: async (w) => {
    const cached = await db.dictCache.get(w.german.toLowerCase()).catch(() => undefined);
    if (!cached || cached.miss || !cached.definitionDe) return {};
    await db.words.update(w.id!, { definitionDe: cached.definitionDe });
    return { definitionDe: cached.definitionDe };
  },
  request: (chunk) =>
    generateDefinitionsWithAi(
      chunk.map((w) => ({ german: w.german, english: w.english, article: w.article, pos: w.pos }))
    ),
  apply: async (w, found) => {
    if (!found) return {};
    await db.words.update(w.id!, { definitionDe: found.definitionDe });
    await rememberInCache(w.german, { definitionDe: found.definitionDe });
    return { definitionDe: found.definitionDe };
  },
});

/** Kick off a backfill pass shortly; safe to call often. */
export const scheduleDefinitionBackfill = definitions.schedule;

/**
 * The user deliberately switched the meaning language to Deutsch: forget any
 * backoff and per-word attempts from earlier failed passes and run again now.
 */
export const restartDefinitionBackfill = definitions.restart;
