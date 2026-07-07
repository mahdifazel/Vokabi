"use client";

import { useSyncExternalStore } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabase } from "./supabase";

let currentUser: User | null = null;
/** true once the persisted session has been restored (or ruled out) */
let authReady = false;
let initialized = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

export function initAuth(onUserChange?: (user: User | null) => void) {
  if (initialized) return;
  initialized = true;
  const supabase = getSupabase();
  if (!supabase) {
    authReady = true;
    notify();
    return;
  }
  supabase.auth.getSession().then(({ data }) => {
    currentUser = data.session?.user ?? null;
    authReady = true;
    notify();
    onUserChange?.(currentUser);
  });
  supabase.auth.onAuthStateChange((_event, session) => {
    const next = session?.user ?? null;
    const changed = next?.id !== currentUser?.id;
    currentUser = next;
    authReady = true;
    notify();
    if (changed) onUserChange?.(currentUser);
  });
}

export function getUser(): User | null {
  return currentUser;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useUser(): User | null {
  return useSyncExternalStore(subscribe, getUser, () => null);
}

export function useAuthReady(): boolean {
  return useSyncExternalStore(subscribe, () => authReady, () => false);
}

export async function signIn(email: string, password: string): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return "Cloud sync is not configured.";
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return error ? error.message : null;
}

/** Returns an error message, or "confirm" when email confirmation is pending, or null on success. */
export async function signUp(email: string, password: string): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return "Cloud sync is not configured.";
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return error.message;
  if (!data.session) return "confirm";
  return null;
}

export async function signOut() {
  await getSupabase()?.auth.signOut();
}
