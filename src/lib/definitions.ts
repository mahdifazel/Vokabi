"use client";

import { db } from "./db";
import { AI_DEFINITION_BATCH, generateDefinitionsWithAi } from "./ai";
import { isSentence } from "./scan-rules";
import { getSettings } from "./settings";
import type { Word } from "./types";

/**
 * Background backfill of German definitions, mirroring the example-sentence
 * backfill in examples.ts: any ready word without one gets a short German
 * definition from the AI route in small batches. Only runs while the meaning
 * language setting is Deutsch, so users on English never spend AI requests on
 * definitions. The missing definition itself is the todo marker, so the pass
 * is resumable by construction. Never throws; failures only set a backoff.
 */

const BACKOFF_KEY = "vokabi.definitionBackfill.nextAt";
const ATTEMPTS_KEY = "vokabi.definitionBackfill.attempts";
const MAX_ATTEMPTS = 3;
const RATE_LIMIT_BACKOFF = 10 * 60_000; // 429: providers busy, retry soon
const UNAVAILABLE_BACKOFF = 6 * 60 * 60_000; // signed out / AI off: retry much later
const BATCH_PAUSE_MS = 1500;
const START_DELAY_MS = 5000;

let running = false;
let scheduled = false;

function readAttempts(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(ATTEMPTS_KEY) ?? "{}") as Record<string, number>;
  } catch {
    return {};
  }
}

function setBackoff(ms: number) {
  try {
    localStorage.setItem(BACKOFF_KEY, String(Date.now() + ms));
  } catch {}
}

function backoffActive(): boolean {
  try {
    return Date.now() < Number(localStorage.getItem(BACKOFF_KEY) ?? 0);
  } catch {
    return false;
  }
}

/** Kick off a backfill pass shortly; safe to call often (single-flight). */
export function scheduleDefinitionBackfill() {
  if (typeof window === "undefined" || scheduled) return;
  if (getSettings().meaningLanguage !== "de") return;
  scheduled = true;
  setTimeout(() => {
    scheduled = false;
    void runBackfill();
  }, START_DELAY_MS);
}

/**
 * The user deliberately switched the meaning language to Deutsch: forget any
 * backoff and per-word attempts from earlier failed passes (e.g. one that ran
 * signed-out or against a still-building deployment) and run again now.
 */
export function restartDefinitionBackfill() {
  try {
    localStorage.removeItem(BACKOFF_KEY);
    localStorage.removeItem(ATTEMPTS_KEY);
  } catch {}
  scheduleDefinitionBackfill();
}

function needsDefinition(w: Word, attempts: Record<string, number>): boolean {
  if (w.status !== "ready" || w.definitionDe || w.id == null) return false;
  // sentence entries from scans don't get dictionary-style definitions
  if (isSentence(w.german)) return false;
  return (attempts[w.german.toLowerCase()] ?? 0) < MAX_ATTEMPTS;
}

async function runBackfill() {
  if (running) return;
  if (getSettings().meaningLanguage !== "de") return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  if (backoffActive()) return;
  running = true;
  try {
    const attempts = readAttempts();
    const candidates = (await db.words.toArray()).filter((w) => needsDefinition(w, attempts));
    if (candidates.length === 0) return;

    // free pass: definitions already sitting in the dictionary cache from a
    // previous AI pass (e.g. the word was deleted and re-added)
    const remaining: Word[] = [];
    for (const w of candidates) {
      const cached = await db.dictCache.get(w.german.toLowerCase()).catch(() => undefined);
      if (cached && !cached.miss && cached.definitionDe) {
        await db.words.update(w.id!, { definitionDe: cached.definitionDe });
      } else {
        remaining.push(w);
      }
    }

    // AI pass, in small batches so one request covers several words
    for (let i = 0; i < remaining.length; i += AI_DEFINITION_BATCH) {
      if (getSettings().meaningLanguage !== "de") return;
      const chunk = remaining.slice(i, i + AI_DEFINITION_BATCH);
      const res = await generateDefinitionsWithAi(
        chunk.map((w) => ({ german: w.german, english: w.english, article: w.article, pos: w.pos }))
      );
      if (res === "rate-limited") {
        setBackoff(RATE_LIMIT_BACKOFF);
        return;
      }
      if (res === null) {
        setBackoff(UNAVAILABLE_BACKOFF);
        return;
      }

      const byKey = new Map(res.map((d) => [d.german.toLowerCase(), d]));
      for (const w of chunk) {
        const key = w.german.toLowerCase();
        const found = byKey.get(key);
        if (!found) {
          attempts[key] = (attempts[key] ?? 0) + 1;
          continue;
        }
        await db.words.update(w.id!, { definitionDe: found.definitionDe });
        // remember the definition in the dictionary cache so deleting and
        // re-adding the word doesn't cost another AI request
        const cached = await db.dictCache.get(key).catch(() => undefined);
        if (cached && !cached.miss && !cached.definitionDe) {
          await db.dictCache
            .put({ ...cached, definitionDe: found.definitionDe })
            .catch(() => {});
        }
      }
      try {
        localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(attempts));
      } catch {}
      if (i + AI_DEFINITION_BATCH < remaining.length) {
        await new Promise((r) => setTimeout(r, BATCH_PAUSE_MS));
      }
    }
  } catch {
    // never let background work surface errors
  } finally {
    running = false;
  }
}
