"use client";

import { getSupabase } from "./supabase";

export interface PresetGroup {
  id: string;
  name: string;
  words: string[];
  /** default groups are seeded into every user's library automatically */
  isDefault: boolean;
}

/**
 * Ready-made groups curated in the back office. Returns null when Supabase
 * is not configured or the request fails, so callers can hide the feature.
 */
export async function fetchPresetGroups(): Promise<PresetGroup[] | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("preset_groups")
    .select("id, name, words, is_default")
    .order("name");
  if (error || !data) return null;
  return data.map((row) => ({
    id: row.id as string,
    name: row.name as string,
    words: Array.isArray(row.words) ? (row.words as string[]) : [],
    isDefault: row.is_default === true,
  }));
}

/** Presets are only offered when a Supabase backend exists. */
export function presetsAvailable(): boolean {
  return getSupabase() !== null;
}
