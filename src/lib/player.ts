"use client";

import { useSyncExternalStore } from "react";
import type { Word } from "./types";
import { getSettings } from "./settings";
import { speak, stopSpeaking } from "./tts";
import { pauseKeepAlive, startKeepAlive, stopKeepAlive } from "./keepalive";

export interface PlayerState {
  words: Word[];
  index: number;
  playing: boolean;
  /** label of what's playing, e.g. group name */
  title: string;
  active: boolean;
}

const IDLE: PlayerState = { words: [], index: 0, playing: false, title: "", active: false };

let state: PlayerState = IDLE;
const listeners = new Set<() => void>();
let generation = 0; // bumped to cancel an in-flight playback loop

function setState(patch: Partial<PlayerState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
  updateMediaSession();
}

// ---------------------------------------------------------------------------
// Media Session: lock-screen / notification controls while playing
// ---------------------------------------------------------------------------

function mediaSessionSupported() {
  return typeof navigator !== "undefined" && "mediaSession" in navigator;
}

function registerMediaHandlers() {
  if (!mediaSessionSupported()) return;
  const ms = navigator.mediaSession;
  try {
    ms.setActionHandler("play", () => resumePlayer());
    ms.setActionHandler("pause", () => pausePlayer());
    ms.setActionHandler("nexttrack", () => nextWord());
    ms.setActionHandler("previoustrack", () => prevWord());
    ms.setActionHandler("stop", () => stopPlayer());
  } catch {
    // some handlers unsupported on this platform — fine
  }
}

function updateMediaSession() {
  if (!mediaSessionSupported()) return;
  const ms = navigator.mediaSession;
  if (!state.active) {
    ms.metadata = null;
    ms.playbackState = "none";
    return;
  }
  const word = state.words[Math.min(state.index, state.words.length - 1)];
  if (word) {
    ms.metadata = new MediaMetadata({
      title: word.article ? `${word.article} ${word.german}` : word.german,
      artist: word.english ?? "",
      album: `Vokabi · ${state.title}`,
      artwork: [{ src: "/icon.svg", sizes: "512x512", type: "image/svg+xml" }],
    });
  }
  ms.playbackState = state.playing ? "playing" : "paused";
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function usePlayer(): PlayerState {
  return useSyncExternalStore(subscribe, () => state, () => IDLE);
}

function shuffled<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function sleep(ms: number, gen: number): Promise<void> {
  return new Promise((resolve) => {
    const start = Date.now();
    const tick = () => {
      if (gen !== generation || Date.now() - start >= ms) resolve();
      else setTimeout(tick, 100);
    };
    tick();
  });
}

export function wordSpokenText(word: Word, readArticle: boolean): string {
  return readArticle && word.article ? `${word.article} ${word.german}` : word.german;
}

/** Speak a single word once, respecting rate + article setting. */
export async function playWordOnce(word: Word) {
  const s = getSettings();
  generation++;
  stopSpeaking();
  setState({ ...IDLE, words: [word], title: word.german });
  await speak(wordSpokenText(word, s.readArticle), {
    lang: "de-DE",
    rate: s.rate,
    voiceURI: s.germanVoice || undefined,
  });
}

export function startPlaylist(words: Word[], title: string, startIndex = 0) {
  if (words.length === 0) return;
  const s = getSettings();
  const list = s.shuffle ? shuffled(words) : words;
  generation++;
  stopSpeaking();
  startKeepAlive(); // keeps playback alive when the screen turns off
  registerMediaHandlers();
  setState({ words: list, index: startIndex, playing: true, title, active: true });
  void runLoop(generation);
}

async function runLoop(gen: number) {
  const alive = () => gen === generation;
  do {
    while (alive() && state.index < state.words.length) {
      if (!state.playing) {
        await sleep(150, gen);
        continue;
      }
      const s = getSettings();
      const word = state.words[state.index];
      const text = wordSpokenText(word, s.readArticle);
      for (let r = 0; r < s.repeatCount; r++) {
        if (!alive() || !state.playing) break;
        await speak(text, { lang: "de-DE", rate: s.rate, voiceURI: s.germanVoice || undefined });
        if (alive() && state.playing && r < s.repeatCount - 1) {
          await sleep(400, gen);
        }
      }
      if (alive() && state.playing && s.readTranslation && word.english) {
        await sleep(300, gen);
        if (alive() && state.playing) {
          await speak(word.english.split(";")[0], { lang: "en-US", rate: s.rate });
        }
      }
      if (!alive() || !state.playing) continue;
      if (state.index < state.words.length - 1 || getSettings().autoRepeat) {
        await sleep(s.pauseSec * 1000, gen);
      }
      if (alive() && state.playing) {
        setState({ index: state.index + 1 });
      }
    }
    if (alive() && getSettings().autoRepeat && state.playing) {
      const s = getSettings();
      setState({ index: 0, words: s.shuffle ? shuffled(state.words) : state.words });
    } else {
      break;
    }
  } while (alive());
  if (alive()) setState({ playing: false, active: state.index < state.words.length });
  if (alive() && state.index >= state.words.length) setState({ ...IDLE });
}

export function pausePlayer() {
  stopSpeaking();
  pauseKeepAlive();
  setState({ playing: false });
}

export function resumePlayer() {
  if (!state.active) return;
  if (state.index >= state.words.length) setState({ index: 0 });
  startKeepAlive();
  setState({ playing: true });
}

export function stopPlayer() {
  generation++;
  stopSpeaking();
  stopKeepAlive();
  setState({ ...IDLE });
}

export function skipTo(index: number) {
  if (!state.active) return;
  stopSpeaking();
  setState({ index: Math.max(0, Math.min(index, state.words.length - 1)) });
}

export function nextWord() {
  skipTo(state.index + 1);
}

export function prevWord() {
  skipTo(state.index - 1);
}
