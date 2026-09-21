"use client";

import { useSyncExternalStore } from "react";
import {
  DEFAULT_SETTINGS,
  PAUSE_STEPS,
  RATE_STEPS,
  REPEAT_STEPS,
  type AppSettings,
} from "./types";

const STORAGE_KEY = "vokabi.settings";

let cached: AppSettings | null = null;
const listeners = new Set<() => void>();

/** Closest allowed step to a stored number. */
function snap(steps: readonly number[], value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return steps.reduce((best, step) =>
    Math.abs(step - value) < Math.abs(best - value) ? step : best
  );
}

/**
 * A stored value can name a step that no longer exists: settings persist
 * forever in localStorage, while the sliders' steps change with the app (0s
 * and 0.5s pauses were dropped once the scale started at 1s). Snapping on
 * load keeps the stored value, the slider position and what playback does
 * from drifting apart.
 */
function normalize(s: AppSettings): AppSettings {
  return {
    ...s,
    rate: snap(RATE_STEPS, s.rate, DEFAULT_SETTINGS.rate),
    pauseSec: snap(PAUSE_STEPS, s.pauseSec, DEFAULT_SETTINGS.pauseSec),
    repeatCount: snap(REPEAT_STEPS, s.repeatCount, DEFAULT_SETTINGS.repeatCount),
  };
}

function load(): AppSettings {
  if (cached) return cached;
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    cached = raw
      ? normalize({ ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<AppSettings>) })
      : DEFAULT_SETTINGS;
  } catch {
    cached = DEFAULT_SETTINGS;
  }
  return cached;
}

export function getSettings(): AppSettings {
  return load();
}

export function updateSettings(patch: Partial<AppSettings>) {
  cached = { ...load(), ...patch };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
  } catch {
    // storage full or unavailable, keep in-memory value
  }
  applyTheme(cached.theme);
  listeners.forEach((l) => l());
}

export function applyTheme(theme: AppSettings["theme"]) {
  if (typeof document === "undefined") return;
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = theme === "dark" || (theme === "system" && prefersDark);
  document.documentElement.classList.toggle("dark", dark);
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useSettings(): AppSettings {
  return useSyncExternalStore(subscribe, load, () => DEFAULT_SETTINGS);
}
