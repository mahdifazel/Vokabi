"use client";

import { db } from "./db";
import type { AiBatchResult } from "./ai";
import type { DictEntry, Word } from "./types";

/**
 * Shared engine for the background AI backfills (example sentences, German
 * definitions, Persian translations). Each one walks every ready word that
 * still lacks its field and fills it in small batches. The missing field
 * itself is the todo marker, so a pass is resumable by construction.
 *
 * The pass keeps going until the whole library is done:
 * - a transient failure (timeout, both providers failing once, a network
 *   blip) is retried on the spot, and if it persists the pass pauses briefly
 *   and resumes by itself. It used to stop for six hours on the first
 *   failure, which left libraries only partly translated.
 * - a 429 pauses for a minute, then resumes by itself.
 * - only "AI can't be used at all" (signed out, AI not configured) waits
 *   longer; signing in schedules a new pass through the sync pull anyway.
 * - a request to run while a pass is in flight (new words added, a sync
 *   pull) is remembered and runs right after, instead of being dropped.
 *
 * Never throws.
 */

const MAX_ATTEMPTS = 3; // per word: the AI answered but skipped this entry
const TRANSIENT_RETRIES = 2;
const RETRY_PAUSE_MS = 5000;
const RATE_LIMIT_BACKOFF = 60_000;
const TRANSIENT_BACKOFF = 2 * 60_000;
const UNAVAILABLE_BACKOFF = 30 * 60_000;
const BATCH_PAUSE_MS = 1500;
const START_DELAY_MS = 5000;

export interface BackfillSpec<R extends { german: string }> {
  /** localStorage key prefix, e.g. "vokabi.definitionBackfill" */
  name: string;
  batchSize: number;
  /** false = the pass doesn't apply right now (e.g. another meaning language) */
  enabled?: () => boolean;
  /** whether a word still lacks this backfill's field(s) */
  needs: (w: Word) => boolean;
  /** free pass from the dictionary cache; returns the updates it applied */
  fromCache?: (w: Word) => Promise<Partial<Word>>;
  request: (chunk: Word[]) => Promise<AiBatchResult<R>>;
  /** write the AI's answer for one word (found is undefined when it was skipped) */
  apply: (w: Word, found: R | undefined) => Promise<Partial<Word>>;
  /** called after a pass that wrote anything */
  afterWrite?: () => void;
}

export interface Backfill {
  /** Run a pass shortly; safe to call often. */
  schedule: () => void;
  /** Forget earlier failures (backoff, per-word attempts) and run now. */
  restart: () => void;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function createBackfill<R extends { german: string }>(spec: BackfillSpec<R>): Backfill {
  const backoffKey = `${spec.name}.nextAt`;
  const attemptsKey = `${spec.name}.attempts`;
  let running = false;
  let rerun = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const enabled = () => spec.enabled?.() ?? true;

  function readAttempts(): Record<string, number> {
    try {
      return JSON.parse(localStorage.getItem(attemptsKey) ?? "{}") as Record<string, number>;
    } catch {
      return {};
    }
  }

  function saveAttempts(attempts: Record<string, number>) {
    try {
      localStorage.setItem(attemptsKey, JSON.stringify(attempts));
    } catch {}
  }

  function setBackoff(ms: number) {
    try {
      localStorage.setItem(backoffKey, String(Date.now() + ms));
    } catch {}
  }

  function backoffLeft(): number {
    try {
      const left = Number(localStorage.getItem(backoffKey) ?? 0) - Date.now();
      // older builds stored backoffs of up to six hours; never wait longer
      // than the longest backoff this engine sets itself
      return Math.min(Math.max(0, left), UNAVAILABLE_BACKOFF);
    } catch {
      return 0;
    }
  }

  function scheduleIn(ms: number) {
    if (typeof window === "undefined" || !enabled()) return;
    if (running) {
      rerun = true;
      return;
    }
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      void run();
    }, ms);
  }

  async function run() {
    if (running) {
      rerun = true;
      return;
    }
    if (!enabled()) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;
    const wait = backoffLeft();
    if (wait > 0) {
      // come back by ourselves once the backoff is over
      scheduleIn(wait + 1000);
      return;
    }
    running = true;
    rerun = false;
    let resumeIn = 0;
    let wrote = false;
    try {
      const attempts = readAttempts();
      const due = (w: Word) =>
        w.status === "ready" &&
        w.id != null &&
        spec.needs(w) &&
        (attempts[w.german.toLowerCase()] ?? 0) < MAX_ATTEMPTS;
      const candidates = (await db.words.toArray()).filter(due);
      if (candidates.length === 0) return;

      const remaining: Word[] = [];
      for (const w of candidates) {
        const updates = spec.fromCache ? await spec.fromCache(w).catch(() => ({})) : {};
        if (Object.keys(updates).length > 0) wrote = true;
        const merged = { ...w, ...updates };
        if (spec.needs(merged)) remaining.push(merged);
      }

      for (let i = 0; i < remaining.length; i += spec.batchSize) {
        if (!enabled()) return;
        const chunk = remaining.slice(i, i + spec.batchSize);
        let res = await spec.request(chunk);
        for (let t = 0; res === null && t < TRANSIENT_RETRIES; t++) {
          await sleep(RETRY_PAUSE_MS);
          res = await spec.request(chunk);
        }
        if (res === "unavailable") {
          setBackoff(UNAVAILABLE_BACKOFF);
          return;
        }
        if (res === "rate-limited" || res === null) {
          resumeIn = res === null ? TRANSIENT_BACKOFF : RATE_LIMIT_BACKOFF;
          setBackoff(resumeIn);
          return;
        }

        const byKey = new Map(res.map((r) => [r.german.toLowerCase(), r]));
        for (const w of chunk) {
          const key = w.german.toLowerCase();
          const updates = await spec.apply(w, byKey.get(key));
          if (Object.keys(updates).length > 0) wrote = true;
          if (spec.needs({ ...w, ...updates })) attempts[key] = (attempts[key] ?? 0) + 1;
        }
        saveAttempts(attempts);
        if (i + spec.batchSize < remaining.length) await sleep(BATCH_PAUSE_MS);
      }
    } catch {
      // never let background work surface errors; try again a bit later
      resumeIn = TRANSIENT_BACKOFF;
      setBackoff(resumeIn);
    } finally {
      running = false;
      if (wrote) spec.afterWrite?.();
      if (resumeIn) scheduleIn(resumeIn + 1000);
      else if (rerun) scheduleIn(START_DELAY_MS);
    }
  }

  return {
    schedule: () => scheduleIn(START_DELAY_MS),
    restart: () => {
      try {
        localStorage.removeItem(backoffKey);
        localStorage.removeItem(attemptsKey);
      } catch {}
      scheduleIn(START_DELAY_MS);
    },
  };
}

/** Store a field in the dictionary cache so re-adding a word costs no AI request. */
export async function rememberInCache(german: string, patch: Partial<DictEntry>) {
  const cached = await db.dictCache.get(german.toLowerCase()).catch(() => undefined);
  if (cached && !cached.miss) await db.dictCache.put({ ...cached, ...patch }).catch(() => {});
}
