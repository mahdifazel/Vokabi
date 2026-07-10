"use client";

/**
 * Background-playback keep-alive.
 *
 * Android suspends pages (and their speech synthesis + timers) when the
 * screen turns off, unless the tab is audibly playing media. We loop a
 * near-silent WAV at minimal volume while a playlist runs, which keeps the
 * page alive exactly like a music player, and gives the Media Session API
 * a real media element to attach lock-screen controls to.
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
  audio.addEventListener("pause", () => {
    if (intentionalPause || document.visibilityState !== "hidden") return;
    setTimeout(() => {
      if (!intentionalPause && document.visibilityState === "hidden") {
        void audio?.play().catch(() => {});
      }
    }, 250);
  });
  document.addEventListener("visibilitychange", () => {
    if (intentionalPause) return;
    if (document.visibilityState === "hidden") {
      // re-assert the session and keep the loop rolling into the lock
      setSessionType("playback");
      if (audio?.paused) void audio.play().catch(() => {});
    }
    // returning to visible keeps the playback session; it is released in
    // pauseKeepAlive/stopKeepAlive when the playlist actually stops
  });
}

/** Build a 10s near-silent 8-bit mono WAV (±1 LSB ticks so it counts as audible). */
function silentWavUrl(): string {
  if (objectUrl) return objectUrl;
  const sampleRate = 8000;
  const samples = sampleRate * 10;
  const buf = new ArrayBuffer(44 + samples);
  const v = new DataView(buf);
  const str = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
  };
  str(0, "RIFF");
  v.setUint32(4, 36 + samples, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true); // fmt chunk size
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate, true); // byte rate
  v.setUint16(32, 1, true); // block align
  v.setUint16(34, 8, true); // bits per sample
  str(36, "data");
  v.setUint32(40, samples, true);
  for (let i = 0; i < samples; i++) {
    v.setUint8(44 + i, 128 + (i % 50 === 0 ? 1 : 0));
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
    audio = new Audio(silentWavUrl());
    audio.loop = true;
    audio.volume = 0.02; // inaudible, but registers as playing audio
    attachBackgroundListeners();
  }
  intentionalPause = false;
  void audio.play().catch(() => {
    // autoplay blocked, playback was not user-initiated; speech still works
    // in the foreground, it just won't survive the screen turning off
  });
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
