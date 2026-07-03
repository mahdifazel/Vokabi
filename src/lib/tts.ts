"use client";

/**
 * Speech synthesis helpers. Picks the highest-quality German voice available
 * on the device (Android Chrome ships Google's natural de-DE voices).
 */

let voicesLoaded = false;
let voiceListeners: (() => void)[] = [];

export function initVoices() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const synth = window.speechSynthesis;
  const notify = () => {
    voicesLoaded = true;
    voiceListeners.forEach((l) => l());
    voiceListeners = [];
  };
  if (synth.getVoices().length > 0) notify();
  else synth.addEventListener("voiceschanged", notify, { once: true });
}

export function ttsSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

async function ensureVoices(): Promise<void> {
  if (!ttsSupported()) return;
  if (voicesLoaded || window.speechSynthesis.getVoices().length > 0) return;
  initVoices();
  await new Promise<void>((resolve) => {
    const t = setTimeout(resolve, 1500); // don't hang if event never fires
    voiceListeners.push(() => {
      clearTimeout(t);
      resolve();
    });
  });
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
  QUALITY_HINTS.forEach((hint, i) => {
    if (name.includes(hint)) score += 100 - i * 10;
  });
  if (v.lang === "de-DE") score += 20;
  if (v.localService) score += 5; // works offline
  return score;
}

function pickVoice(lang: string, preferredURI?: string): SpeechSynthesisVoice | null {
  if (!ttsSupported()) return null;
  const voices = window.speechSynthesis.getVoices();
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

/** Speak text; resolves when finished or cancelled. */
export async function speak(text: string, opts: SpeakOptions = {}): Promise<void> {
  if (!ttsSupported() || !text.trim()) return;
  await ensureVoices();
  const synth = window.speechSynthesis;
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = opts.lang ?? "de-DE";
    u.rate = opts.rate ?? 1;
    const voice = pickVoice(u.lang, opts.voiceURI);
    if (voice) u.voice = voice;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    synth.speak(u);
  });
}

export function stopSpeaking() {
  if (ttsSupported()) window.speechSynthesis.cancel();
}
