"use client";

/**
 * Speech synthesis helpers. Picks the highest-quality German voice available
 * on the device (Android Chrome ships Google's natural de-DE voices).
 *
 * Android Chrome quirks handled here:
 * - speak() right after cancel() is sometimes silently dropped → watchdog retries once
 * - the synth can wake up in a paused state → always resume() before speak()
 * - getVoices() is empty until "voiceschanged" → never block on it; utterance.lang
 *   alone is enough for the default Google TTS engine to speak German
 * - onend occasionally never fires → hard timeout so playlists can't hang
 * - with the screen locked some platforms refuse to start new utterances →
 *   the watchdog holds the current word and keeps retrying instead of
 *   advancing, so the playlist resumes where it paused (see keepalive.ts
 *   for what keeps the page itself alive while locked)
 */

import { diag, hiddenFlag } from "./diag";

let voicesLoaded = false;

export function initVoices() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const synth = window.speechSynthesis;
  if (synth.getVoices().length > 0) {
    voicesLoaded = true;
    return;
  }
  synth.addEventListener(
    "voiceschanged",
    () => {
      voicesLoaded = true;
    },
    { once: true }
  );
}

export function ttsSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

const QUALITY_HINTS = ["natural", "neural", "premium", "enhanced", "google", "siri"];

export function getGermanVoices(): SpeechSynthesisVoice[] {
  if (!ttsSupported()) return [];
  return window.speechSynthesis
    .getVoices()
    .filter((v) => v.lang.toLowerCase().startsWith("de"))
    .sort((a, b) => voiceScore(b) - voiceScore(a));
}

function voiceScore(v: SpeechSynthesisVoice): number {
  const name = v.name.toLowerCase();
  let score = 0;
  // Apple's "Anna" is the preferred default on iOS/macOS; the enhanced
  // variant still wins over the compact one via the hints below
  if (/\banna\b/.test(name)) score += 200;
  QUALITY_HINTS.forEach((hint, i) => {
    if (name.includes(hint)) score += 100 - i * 10;
  });
  if (v.lang === "de-DE" || v.lang === "de_DE") score += 20;
  if (v.localService) score += 5; // works offline
  return score;
}

function pickVoice(lang: string, preferredURI?: string): SpeechSynthesisVoice | null {
  if (!ttsSupported()) return null;
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null; // let utterance.lang choose the engine default
  if (lang.startsWith("de")) {
    const german = getGermanVoices();
    if (preferredURI) {
      const chosen = german.find((v) => v.voiceURI === preferredURI);
      if (chosen) return chosen;
    }
    return german[0] ?? null;
  }
  const match = voices
    .filter((v) => v.lang.toLowerCase().startsWith(lang.slice(0, 2).toLowerCase()))
    .sort((a, b) => voiceScore(b) - voiceScore(a));
  return match[0] ?? null;
}

export interface SpeakOptions {
  lang?: string;
  rate?: number;
  voiceURI?: string;
}

const HARD_TIMEOUT_MS = 20000;
const ABSOLUTE_TIMEOUT_MS = 120000;

// some platforms pause the synth when the page hides; resume it right away
let visibilityNudgeArmed = false;
function armVisibilityNudge() {
  if (visibilityNudgeArmed || typeof document === "undefined") return;
  visibilityNudgeArmed = true;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      try {
        window.speechSynthesis.resume();
      } catch {
        // ignore
      }
    }
  });
}

// bumped by stopSpeaking so background retry loops know they were cancelled
let cancelCount = 0;

function pageHidden() {
  return typeof document !== "undefined" && document.visibilityState === "hidden";
}

function delay(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

/**
 * Speak text; resolves when finished, cancelled, or given up on. Never
 * rejects. While the page is hidden, "interrupted"/"synthesis-failed"
 * outcomes (Android kills the engine at screen lock) hold the current word
 * and retry after clearing the engine, instead of advancing: either the
 * engine unwedges and playback continues, or the word plays on unlock.
 */
export async function speak(text: string, opts: SpeakOptions = {}): Promise<void> {
  if (!ttsSupported() || !text.trim()) return;
  if (!voicesLoaded) initVoices();
  armVisibilityNudge();
  const gen = cancelCount;
  for (;;) {
    const outcome = await speakAttempt(text, opts);
    if (gen !== cancelCount) return; // cancelled by the player, not a failure
    if (pageHidden() && (outcome === "synthesis-failed" || outcome === "interrupted")) {
      diag(`hold word, retry after ${outcome} [hidden]`);
      try {
        window.speechSynthesis.cancel(); // clear a possibly wedged engine
      } catch {
        // ignore
      }
      await delay(1500);
      if (gen !== cancelCount) return;
      continue;
    }
    return;
  }
}

/** One utterance attempt; resolves "ok" or the utterance error code. */
function speakAttempt(text: string, opts: SpeakOptions): Promise<string> {
  const synth = window.speechSynthesis;
  diag(`speak "${text.slice(0, 24)}"${hiddenFlag()}`);
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = opts.lang ?? "de-DE";
    u.rate = opts.rate ?? 1;
    const voice = pickVoice(u.lang, opts.voiceURI);
    if (voice) u.voice = voice;

    let done = false;
    let started = false;
    let retried = false;
    let idleMs = 0;
    let activeMs = 0;
    let totalMs = 0;

    const finish = (outcome: string) => {
      if (done) return;
      done = true;
      clearInterval(watchdog);
      resolve(outcome);
    };

    u.onstart = () => {
      started = true;
      diag(`utterance started${hiddenFlag()}`);
    };
    u.onend = () => {
      diag(`utterance ended${hiddenFlag()}`);
      finish("ok");
    };
    u.onerror = (e) => {
      diag(`utterance error: ${e.error}${hiddenFlag()}`);
      finish(e.error || "error");
    };

    // Watchdog: if the utterance never starts (Android drops utterances queued
    // right after cancel()), re-queue it once, then give up gracefully.
    // With the screen locked the rules change: some platforms refuse to start
    // speech in the background, so instead of giving up (which would silently
    // burn through the playlist) we hold this word and keep nudging until the
    // utterance starts or the screen comes back. The hard timeout only counts
    // time where speech had a real chance to run.
    const watchdog = setInterval(() => {
      if (done) return;
      totalMs += 250;
      if (totalMs >= ABSOLUTE_TIMEOUT_MS) {
        finish("ok");
        return;
      }
      const lockedBeforeStart =
        !started && typeof document !== "undefined" && document.visibilityState === "hidden";
      // the hard timeout only counts time where speech was expected but not
      // audibly running: not while locked pre-start, not while speaking
      if (!lockedBeforeStart && !(started && synth.speaking)) {
        activeMs += 250;
        if (activeMs >= HARD_TIMEOUT_MS) {
          diag(`watchdog hard timeout (started=${started})${hiddenFlag()}`);
          finish("ok");
          return;
        }
      }
      if (started || synth.speaking || synth.pending) {
        idleMs = 0;
        return;
      }
      idleMs += 250;
      if (idleMs >= 1000) {
        idleMs = 0;
        if (!retried || lockedBeforeStart) {
          retried = true;
          diag(`watchdog re-queue${hiddenFlag()}`);
          try {
            synth.resume();
            synth.speak(u);
          } catch {
            diag(`watchdog re-queue threw${hiddenFlag()}`);
            if (!lockedBeforeStart) finish("ok");
          }
        } else {
          diag(`watchdog gave up${hiddenFlag()}`);
          finish("ok");
        }
      }
    }, 250);

    try {
      synth.resume(); // Android Chrome sometimes wakes up paused
      synth.speak(u);
    } catch {
      finish("ok");
    }
  });
}

export function stopSpeaking() {
  cancelCount++;
  if (ttsSupported()) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
  }
}
