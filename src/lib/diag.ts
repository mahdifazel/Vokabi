"use client";

/**
 * Tiny diagnostics ring buffer for debugging playback on real phones, where
 * no devtools are available. Audio/TTS code logs events here; the Settings
 * page shows and copies the log. Persisted to localStorage so it survives
 * the page being killed while backgrounded, which is itself a data point
 * (a gap in timestamps means the page was frozen).
 */

const KEY = "vokabi.diag";
const MAX_EVENTS = 300;

let events: string[] | null = null;

function load(): string[] {
  if (events) return events;
  try {
    const raw = localStorage.getItem(KEY);
    events = raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    events = [];
  }
  return events;
}

export function diag(msg: string) {
  if (typeof window === "undefined") return;
  const list = load();
  const t = new Date();
  const stamp =
    t.toTimeString().slice(0, 8) + "." + String(t.getMilliseconds()).padStart(3, "0");
  list.push(`${stamp} ${msg}`);
  if (list.length > MAX_EVENTS) list.splice(0, list.length - MAX_EVENTS);
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // storage full or unavailable; keep the in-memory buffer
  }
}

export function getDiagLog(): string[] {
  if (typeof window === "undefined") return [];
  return [...load()];
}

export function clearDiagLog() {
  events = [];
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

/** True while the page is hidden; logged with most events for context. */
export function hiddenFlag(): string {
  return typeof document !== "undefined" && document.visibilityState === "hidden"
    ? " [hidden]"
    : "";
}
