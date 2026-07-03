"use client";

/**
 * Pronunciation practice via the Web Speech API (SpeechRecognition).
 * The user speaks the word; we compare the recognized transcript against the
 * target using normalized Levenshtein distance and grade the attempt.
 */

export type PracticeRating = "excellent" | "good" | "needs-improvement";

export interface PracticeResult {
  transcript: string;
  similarity: number; // 0..1
  rating: PracticeRating;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}

function getRecognizer(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as SpeechRecognitionCtor | null;
}

export function practiceSupported(): boolean {
  return getRecognizer() !== null;
}

let activeRecognition: SpeechRecognitionLike | null = null;

export function stopPractice() {
  activeRecognition?.abort();
  activeRecognition = null;
}

/**
 * Listen for one utterance in German and score it against `target`.
 * Rejects with Error("not-supported") / Error("no-speech") / Error(code).
 */
export function listenAndScore(target: string): Promise<PracticeResult> {
  return new Promise((resolve, reject) => {
    const Ctor = getRecognizer();
    if (!Ctor) {
      reject(new Error("not-supported"));
      return;
    }
    stopPractice();
    const rec = new Ctor();
    activeRecognition = rec;
    rec.lang = "de-DE";
    rec.interimResults = false;
    rec.maxAlternatives = 5;
    rec.continuous = false;

    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      activeRecognition = null;
      fn();
    };

    rec.onresult = (e) => {
      const alternatives: string[] = [];
      const result = e.results[0];
      for (let i = 0; i < result.length; i++) {
        alternatives.push(result[i].transcript);
      }
      finish(() => resolve(scoreAttempt(target, alternatives)));
    };
    rec.onerror = (e) => finish(() => reject(new Error(e.error || "unknown")));
    rec.onend = () => finish(() => reject(new Error("no-speech")));

    try {
      rec.start();
    } catch {
      finish(() => reject(new Error("unknown")));
    }
  });
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/^(der|die|das)\s+/, "")
    .replace(/[^a-zäöüß]/g, "");
}

export function scoreAttempt(target: string, alternatives: string[]): PracticeResult {
  const t = normalize(target);
  let best = { transcript: alternatives[0] ?? "", similarity: 0 };
  for (const alt of alternatives) {
    const a = normalize(alt);
    if (!a) continue;
    const dist = levenshtein(t, a);
    const sim = 1 - dist / Math.max(t.length, a.length, 1);
    if (sim > best.similarity) best = { transcript: alt.trim(), similarity: sim };
  }
  const rating: PracticeRating =
    best.similarity >= 0.85 ? "excellent" : best.similarity >= 0.6 ? "good" : "needs-improvement";
  return { ...best, rating };
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  const curr = new Array<number>(n + 1);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    prev = [...curr];
  }
  return prev[n];
}

/** Character-level diff for highlighting mistakes: which target chars matched */
export function charMatches(target: string, attempt: string): boolean[] {
  const t = normalize(target);
  const a = normalize(attempt);
  // LCS-based match marking
  const dp: number[][] = Array.from({ length: t.length + 1 }, () =>
    new Array<number>(a.length + 1).fill(0)
  );
  for (let i = 1; i <= t.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      dp[i][j] =
        t[i - 1] === a[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  const matched = new Array<boolean>(t.length).fill(false);
  let i = t.length;
  let j = a.length;
  while (i > 0 && j > 0) {
    if (t[i - 1] === a[j - 1]) {
      matched[i - 1] = true;
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) i--;
    else j--;
  }
  return matched;
}
