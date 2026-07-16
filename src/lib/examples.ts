"use client";

import { db } from "./db";
import { AI_EXAMPLE_BATCH, generateExamplesWithAi } from "./ai";
import { isSentence } from "./scan-rules";
import { getAdjectiveInfo } from "./adjectives";
import { getVerbInfo } from "./verbs";
import type { Word } from "./types";

/**
 * Background backfill of example sentences: any ready word without one gets
 * an example, first from the dictionary cache (Wiktionary), then from the AI
 * route in small batches. The missing example itself is the todo marker, so
 * the pass is resumable by construction — interrupting it (reload, offline)
 * loses nothing. Never throws; failures only set a backoff and stop the pass.
 *
 * Known trade-off: a user who deliberately blanks a word's example may get it
 * refilled by a later pass.
 */

const BACKOFF_KEY = "vokabi.exampleBackfill.nextAt";
const ATTEMPTS_KEY = "vokabi.exampleBackfill.attempts";
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
export function scheduleExampleBackfill() {
  if (typeof window === "undefined" || scheduled) return;
  scheduled = true;
  setTimeout(() => {
    scheduled = false;
    void runBackfill();
  }, START_DELAY_MS);
}

function needsExample(w: Word, attempts: Record<string, number>): boolean {
  if (w.status !== "ready" || w.example || w.id == null) return false;
  // sentence entries from scans are their own example
  if (isSentence(w.german)) return false;
  // curated verb/adjective examples already render in their sections
  if (w.pos === "verb" && getVerbInfo(w.german)?.example) return false;
  if (w.pos === "adjective" && getAdjectiveInfo(w.german)?.example) return false;
  return (attempts[w.german.toLowerCase()] ?? 0) < MAX_ATTEMPTS;
}

async function runBackfill() {
  if (running) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  if (backoffActive()) return;
  running = true;
  try {
    const attempts = readAttempts();
    const candidates = (await db.words.toArray()).filter((w) => needsExample(w, attempts));
    if (candidates.length === 0) return;

    // free pass: Wiktionary examples already sitting in the dictionary cache
    const remaining: Word[] = [];
    for (const w of candidates) {
      const cached = await db.dictCache.get(w.german.toLowerCase()).catch(() => undefined);
      if (cached && !cached.miss && cached.example) {
        await db.words.update(w.id!, {
          example: cached.example,
          ...(cached.exampleEn ? { exampleEn: cached.exampleEn } : {}),
        });
      } else {
        remaining.push(w);
      }
    }

    // AI pass, in small batches so one request covers several words
    for (let i = 0; i < remaining.length; i += AI_EXAMPLE_BATCH) {
      const chunk = remaining.slice(i, i + AI_EXAMPLE_BATCH);
      const res = await generateExamplesWithAi(
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

      const byKey = new Map(res.map((e) => [e.german.toLowerCase(), e]));
      for (const w of chunk) {
        const key = w.german.toLowerCase();
        const found = byKey.get(key);
        if (!found) {
          attempts[key] = (attempts[key] ?? 0) + 1;
          continue;
        }
        await db.words.update(w.id!, {
          example: found.example,
          ...(found.exampleEn ? { exampleEn: found.exampleEn } : {}),
        });
        // remember the sentence in the dictionary cache so deleting and
        // re-adding the word doesn't cost another AI request
        const cached = await db.dictCache.get(key).catch(() => undefined);
        if (cached && !cached.miss && !cached.example) {
          await db.dictCache
            .put({ ...cached, example: found.example, exampleEn: found.exampleEn || undefined })
            .catch(() => {});
        }
      }
      try {
        localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(attempts));
      } catch {}
      if (i + AI_EXAMPLE_BATCH < remaining.length) {
        await new Promise((r) => setTimeout(r, BATCH_PAUSE_MS));
      }
    }
  } catch {
    // never let background work surface errors
  } finally {
    running = false;
  }
}
