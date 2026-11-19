"use client";

import { db } from "./db";
import { AI_PERSIAN_BATCH, generatePersianWithAi } from "./ai";
import { getSettings } from "./settings";
import type { Word } from "./types";

/**
 * Background backfill of Persian translations, mirroring the German
 * definition backfill in definitions.ts: any ready word without a Persian
 * translation (or whose example sentence has none yet) gets one from the AI
 * route in small batches. Only runs while the meaning language is Persian,
 * so other users never spend AI requests on it. The missing field itself is
 * the todo marker, so the pass is resumable by construction. Never throws;
 * failures only set a backoff.
 */

const BACKOFF_KEY = "vokabi.persianBackfill.nextAt";
const ATTEMPTS_KEY = "vokabi.persianBackfill.attempts";
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
export function schedulePersianBackfill() {
  if (typeof window === "undefined" || scheduled) return;
  if (getSettings().meaningLanguage !== "fa") return;
  scheduled = true;
  setTimeout(() => {
    scheduled = false;
    void runBackfill();
  }, START_DELAY_MS);
}

/**
 * The user deliberately switched the meaning language to Persian: forget any
 * backoff and per-word attempts from earlier failed passes and run again now.
 */
export function restartPersianBackfill() {
  try {
    localStorage.removeItem(BACKOFF_KEY);
    localStorage.removeItem(ATTEMPTS_KEY);
  } catch {}
  schedulePersianBackfill();
}

function missingPersian(w: Pick<Word, "translationFa" | "example" | "exampleFa">): boolean {
  return !w.translationFa || (!!w.example && !w.exampleFa);
}

function needsPersian(w: Word, attempts: Record<string, number>): boolean {
  if (w.status !== "ready" || w.id == null || !missingPersian(w)) return false;
  return (attempts[w.german.toLowerCase()] ?? 0) < MAX_ATTEMPTS;
}

async function runBackfill() {
  if (running) return;
  if (getSettings().meaningLanguage !== "fa") return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  if (backoffActive()) return;
  running = true;
  try {
    const attempts = readAttempts();
    const candidates = (await db.words.toArray()).filter((w) => needsPersian(w, attempts));
    if (candidates.length === 0) return;

    // free pass: translations already sitting in the dictionary cache from a
    // previous AI pass (e.g. the word was deleted and re-added). The cached
    // example translation only applies when the example is the same one.
    const remaining: Word[] = [];
    for (const w of candidates) {
      const cached = await db.dictCache.get(w.german.toLowerCase()).catch(() => undefined);
      const updates: Partial<Word> = {};
      if (cached && !cached.miss) {
        if (!w.translationFa && cached.translationFa) updates.translationFa = cached.translationFa;
        if (w.example && !w.exampleFa && cached.exampleFa && cached.example === w.example) {
          updates.exampleFa = cached.exampleFa;
        }
      }
      if (Object.keys(updates).length > 0) await db.words.update(w.id!, updates);
      if (missingPersian({ ...w, ...updates })) remaining.push({ ...w, ...updates });
    }

    // AI pass, in small batches so one request covers several words
    for (let i = 0; i < remaining.length; i += AI_PERSIAN_BATCH) {
      if (getSettings().meaningLanguage !== "fa") return;
      const chunk = remaining.slice(i, i + AI_PERSIAN_BATCH);
      const res = await generatePersianWithAi(
        chunk.map((w) => ({
          german: w.german,
          english: w.english,
          article: w.article,
          pos: w.pos,
          example: w.example,
        }))
      );
      if (res === "rate-limited") {
        setBackoff(RATE_LIMIT_BACKOFF);
        return;
      }
      if (res === null) {
        setBackoff(UNAVAILABLE_BACKOFF);
        return;
      }

      const byKey = new Map(res.map((t) => [t.german.toLowerCase(), t]));
      for (const w of chunk) {
        const key = w.german.toLowerCase();
        const found = byKey.get(key);
        // never overwrite a translation the user typed in themselves
        const updates: Partial<Word> = {};
        if (found && !w.translationFa) updates.translationFa = found.translationFa;
        if (found?.exampleFa && w.example && !w.exampleFa) updates.exampleFa = found.exampleFa;
        if (missingPersian({ ...w, ...updates })) {
          attempts[key] = (attempts[key] ?? 0) + 1;
        }
        if (Object.keys(updates).length === 0) continue;
        await db.words.update(w.id!, updates);
        // remember the translation in the dictionary cache so deleting and
        // re-adding the word doesn't cost another AI request
        const cached = await db.dictCache.get(key).catch(() => undefined);
        if (cached && !cached.miss) {
          await db.dictCache
            .put({
              ...cached,
              translationFa: cached.translationFa || updates.translationFa || w.translationFa,
              ...(updates.exampleFa && cached.example === w.example
                ? { exampleFa: updates.exampleFa }
                : {}),
            })
            .catch(() => {});
        }
      }
      try {
        localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(attempts));
      } catch {}
      if (i + AI_PERSIAN_BATCH < remaining.length) {
        await new Promise((r) => setTimeout(r, BATCH_PAUSE_MS));
      }
    }
  } catch {
    // never let background work surface errors
  } finally {
    running = false;
  }
}
