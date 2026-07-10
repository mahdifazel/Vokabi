"use client";

/**
 * Background-playback keep-alive.
 *
 * Android suspends pages (and their speech synthesis + timers) when the
 * screen turns off, unless the tab is audibly playing media, where "audibly"
 * is measured from the actual signal power. We loop a WAV that is quiet
 * enough for humans but loud enough for that detector while a playlist
 * runs, which keeps the page alive exactly like a music player, and gives
 * the Media Session API a real media element to attach lock-screen
 * controls to.
 *
 * iOS additionally needs the audio session marked as "playback"
 * (navigator.audioSession, Safari 16.4+); without it the system treats the
 * page's audio as expendable and pauses it on screen lock or when the
 * ring/silent switch is on.
 *
 * IMPORTANT: in the foreground the OS briefly pauses our loop whenever
 * speech starts (audio ducking); restarting it then steals the audio output
 * from the speech engine and mutes the pronunciation after a couple of
 * words. So the restart-on-pause fight happens only while the page is
 * hidden, while the playback session itself is claimed up front inside the
 * play gesture, because claiming it at lock time is too late for iOS.
 */

import { diag, hiddenFlag } from "./diag";

let audio: HTMLAudioElement | null = null;
let objectUrl: string | null = null;
let intentionalPause = false;
let listenersAttached = false;

function setSessionType(type: "auto" | "playback") {
  try {
    const session = (navigator as Navigator & { audioSession?: { type: string } })
      .audioSession;
    if (session) session.type = type;
  } catch {
    // older browsers without the Audio Session API
  }
}

function attachBackgroundListeners() {
  if (listenersAttached || typeof document === "undefined" || !audio) return;
  listenersAttached = true;
  // a system pause while hidden freezes the page and kills the playlist;
  // a system pause while visible is speech ducking and must be respected
  audio.addEventListener("playing", () => diag(`keepalive playing${hiddenFlag()}`));
  audio.addEventListener("pause", () => {
    diag(`keepalive paused${hiddenFlag()}${intentionalPause ? " (intentional)" : ""}`);
    if (intentionalPause || document.visibilityState !== "hidden") return;
    setTimeout(() => {
      if (!intentionalPause && document.visibilityState === "hidden") {
        diag("keepalive restart attempt");
        void audio?.play().catch((e) => diag(`keepalive restart rejected: ${e?.name}`));
      }
    }, 250);
  });
  document.addEventListener("visibilitychange", () => {
    diag(`visibility -> ${document.visibilityState}`);
    if (intentionalPause) return;
    if (document.visibilityState === "hidden") {
      // re-assert the session and keep the loop rolling into the lock
      setSessionType("playback");
      if (audio?.paused) {
        diag("keepalive was paused at lock, restarting");
        void audio.play().catch((e) => diag(`keepalive lock restart rejected: ${e?.name}`));
      }
    }
    // returning to visible keeps the playback session; it is released in
    // pauseKeepAlive/stopKeepAlive when the playlist actually stops
  });
}

/**
 * Build a 10s quiet 30 Hz sine as a 16-bit mono WAV.
 *
 * The signal level is load-bearing: Chrome decides whether a tab is
 * "audibly playing media" by measuring output power (silence threshold is
 * about -72 dBFS), and only audible tabs keep running timers and get a
 * media notification when the screen locks. A near-silent signal gets the
 * tab classified as silent and the playlist freezes with the screen.
 * 30 Hz at -40 dBFS content x 0.2 element volume is about -54 dBFS: well
 * above Chrome's threshold, but phone speakers cannot reproduce 30 Hz and
 * on headphones it sits below the human hearing threshold at that
 * frequency, so nobody hears it.
 */
function quietWavUrl(): string {
  if (objectUrl) return objectUrl;
  const sampleRate = 8000;
  const samples = sampleRate * 10;
  const amplitude = 0.01 * 32767; // -40 dBFS
  const buf = new ArrayBuffer(44 + samples * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
  };
  str(0, "RIFF");
  v.setUint32(4, 36 + samples * 2, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true); // fmt chunk size
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true); // byte rate
  v.setUint16(32, 2, true); // block align
  v.setUint16(34, 16, true); // bits per sample
  str(36, "data");
  v.setUint32(40, samples * 2, true);
  for (let i = 0; i < samples; i++) {
    const value = Math.round(amplitude * Math.sin((2 * Math.PI * 30 * i) / sampleRate));
    v.setInt16(44 + i * 2, value, true);
  }
  objectUrl = URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
  return objectUrl;
}

export function startKeepAlive() {
  if (typeof Audio === "undefined") return;
  // claim the media session up front, inside the user gesture: claiming it
  // only once the screen locks is too late for iOS to keep the page's audio
  // alive. Ducking pauses in the foreground are still respected (above), so
  // this no longer fights the speech engine.
  setSessionType("playback");
  if (!audio) {
    audio = new Audio(quietWavUrl());
    audio.loop = true;
    // total level ~ -54 dBFS: inaudible to people, audible to Chrome's
    // media detector (see quietWavUrl); iOS ignores volume, where the
    // content's own -40 dBFS at 30 Hz is still imperceptible
    audio.volume = 0.2;
    attachBackgroundListeners();
  }
  intentionalPause = false;
  void audio.play().catch(() => {
    // autoplay blocked, playback was not user-initiated; speech still works
    // in the foreground, it just won't survive the screen turning off
  });
}

/** One-line status for diagnostics: is the loop really rolling? */
export function keepAliveStatus(): string {
  if (!audio) return "none";
  return `${audio.paused ? "paused" : "playing"} ct=${audio.currentTime.toFixed(1)} vol=${audio.volume}${audio.muted ? " muted" : ""}`;
}

export function pauseKeepAlive() {
  intentionalPause = true;
  setSessionType("auto");
  audio?.pause();
}

export function stopKeepAlive() {
  intentionalPause = true;
  setSessionType("auto");
  if (audio) {
    audio.pause();
    audio.currentTime = 0;
  }
}
