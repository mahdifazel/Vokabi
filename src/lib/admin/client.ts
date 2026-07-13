"use client";

import { getSupabase } from "@/lib/supabase";

/** Fetch an admin API route with the current session's bearer token. */
export async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Cloud sync is not configured");
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${token ?? ""}`,
    },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    const err = new Error(body.error ?? `Request failed (${res.status})`);
    (err as Error & { status?: number }).status = res.status;
    throw err;
  }
  return res.json() as Promise<T>;
}

export interface AdminUserRow {
  id: string;
  email: string;
  createdAt: string;
  lastSignInAt: string | null;
  banned: boolean;
  wordCount: number;
  groupCount: number;
}

export interface AdminFeedbackRow {
  id: string;
  email: string | null;
  message: string;
  status: "new" | "read" | "resolved";
  created_at: string;
}

export interface AdminAnnouncementRow {
  id: string;
  message: string;
  active: boolean;
  created_at: string;
}

export interface AdminPresetGroupRow {
  id: string;
  name: string;
  words: string[];
  is_default: boolean;
  created_at: string;
}

export interface AdminGroqSettings {
  configured: boolean;
  keyHint: string | null;
  model: string;
  visionModel: string;
}

export interface AdminGeminiSettings {
  configured: boolean;
  keyHint: string | null;
  /** true when a key is set via env var in the hosting platform */
  envConfigured: boolean;
  model: string;
}
