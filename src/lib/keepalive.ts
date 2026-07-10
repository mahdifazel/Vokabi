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
 * ring/silent switch is on. iOS may still pause the element on lock, so an
 * unexpected "pause" restarts playback unless we paused on purpose.
 */

let audio: HTMLAudioElement | null = null;
let objectUrl: string | null = null;
let intentionalPause = false;

/** Mark this page's audio as media playback so iOS keeps it running when locked. */
function requestPlaybackSession() {
  try {
    const session = (navigator as Navigator & { audioSession?: { type: string } })
      .audioSession;
    if (session) session.type = "playback";
  } catch {
    // older browsers without the Audio Session API
  }
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
  requestPlaybackSession();
  if (!audio) {
    audio = new Audio(silentWavUrl());
    audio.loop = true;
    audio.volume = 0.02; // inaudible, but registers as playing audio
    audio.addEventListener("pause", () => {
      // the system paused us (screen lock, interruption): restart shortly,
      // otherwise timers freeze and the playlist dies with the screen
      if (intentionalPause) return;
      setTimeout(() => {
        if (!intentionalPause) void audio?.play().catch(() => {});
      }, 250);
    });
  }
  intentionalPause = false;
  void audio.play().catch(() => {
    // autoplay blocked, playback was not user-initiated; speech still works
    // in the foreground, it just won't survive the screen turning off
  });
}

export function pauseKeepAlive() {
  intentionalPause = true;
  audio?.pause();
}

export function stopKeepAlive() {
  intentionalPause = true;
  if (audio) {
    audio.pause();
    audio.currentTime = 0;
  }
}
