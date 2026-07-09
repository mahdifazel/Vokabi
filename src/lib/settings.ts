"use client";

import { useSyncExternalStore } from "react";
import { DEFAULT_SETTINGS, type AppSettings } from "./types";

const STORAGE_KEY = "vokabi.settings";

let cached: AppSettings | null = null;
const listeners = new Set<() => void>();

function load(): AppSettings {
  if (cached) return cached;
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    cached = raw
      ? { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<AppSettings>) }
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
