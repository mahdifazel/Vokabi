"use client";

import { useSyncExternalStore } from "react";
import { db, onLocalMutation, withRemoteWrites } from "./db";
import { getSupabase } from "./supabase";
import { getUser } from "./auth";
import type { Article, PartOfSpeech, Word, WordStatus } from "./types";

export interface SyncState {
  status: "idle" | "syncing" | "error";
  lastSyncAt: number | null;
  error?: string;
}

const LAST_USER_KEY = "vokabi.lastUserId";
const LAST_SYNC_KEY = "vokabi.lastSyncAt";

let state: SyncState = {
  status: "idle",
  lastSyncAt: null,
};
const listeners = new Set<() => void>();

function setState(patch: Partial<SyncState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

const SERVER_SNAPSHOT: SyncState = { status: "idle", lastSyncAt: null };

export function useSyncState(): SyncState {
  return useSyncExternalStore(subscribe, () => state, () => SERVER_SNAPSHOT);
}

// Debounced auto-sync after local mutations
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
export function scheduleSync(delayMs = 2500) {
  if (!getUser()) return;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => void syncNow(), delayMs);
}

export function initSync() {
  onLocalMutation(() => scheduleSync());
  const stored = Number(localStorage.getItem(LAST_SYNC_KEY));
  if (stored) setState({ lastSyncAt: stored });
  window.addEventListener("online", () => scheduleSync(1000));
}

let syncing = false;
let rerun = false;

/** Full sync: push deletions + dirty rows, pull everything, reconcile. */
export async function syncNow(): Promise<void> {
  const supabase = getSupabase();
  const user = getUser();
  if (!supabase || !user) return;
  if (syncing) {
    rerun = true;
    return;
  }
  syncing = true;
  setState({ status: "syncing", error: undefined });
  try {
    await handleAccountSwitch(user.id);

    // 1. push deletions
    const tombstones = await db.outbox.toArray();
    for (const table of ["words", "groups"] as const) {
      const uids = tombstones.filter((t) => t.table === table).map((t) => t.uid);
      if (uids.length > 0) {
        const { error } = await supabase.from(table).delete().in("uid", uids);
        if (error) throw new Error(error.message);
      }
    }
    await db.outbox.clear();

    // 2. push dirty groups
    const dirtyGroups = await db.groups.where("dirty").equals(1).toArray();
    if (dirtyGroups.length > 0) {
      const { error } = await supabase.from("groups").upsert(
        dirtyGroups.map((g) => ({
          uid: g.uid,
          user_id: user.id,
          name: g.name,
          created_at: g.createdAt,
          updated_at: g.updatedAt ?? g.createdAt,
        }))
      );
      if (error) throw new Error(error.message);
      await withRemoteWrites(() =>
        db.groups.where("id").anyOf(dirtyGroups.map((g) => g.id!)).modify({ dirty: 0 })
      );
    }

    // 3. push dirty words (translate local numeric group ids → group uids)
    const groupUidById = new Map<number, string>();
    await db.groups.each((g) => {
      if (g.id != null && g.uid) groupUidById.set(g.id, g.uid);
    });
    const dirtyWords = await db.words.where("dirty").equals(1).toArray();
    if (dirtyWords.length > 0) {
      const { error } = await supabase.from("words").upsert(
        dirtyWords.map((w) => ({
          uid: w.uid,
          user_id: user.id,
          german: w.german,
          article: w.article ?? null,
          english: w.english ?? null,
          plural: w.plural ?? null,
          ipa: w.ipa ?? null,
          pos: w.pos ?? null,
          example: w.example ?? null,
          example_en: w.exampleEn ?? null,
          notes: w.notes ?? null,
          favorite: !!w.favorite,
          group_uids: w.groupIds
            .map((id) => groupUidById.get(id))
            .filter((u): u is string => !!u),
          status: w.status,
          created_at: w.createdAt,
          updated_at: w.updatedAt,
        }))
      );
      if (error) throw new Error(error.message);
      await withRemoteWrites(() =>
        db.words.where("id").anyOf(dirtyWords.map((w) => w.id!)).modify({ dirty: 0 })
      );
    }

    // 4. pull all remote rows
    const [groupsRes, wordsRes] = await Promise.all([
      supabase.from("groups").select("*"),
      supabase.from("words").select("*"),
    ]);
    if (groupsRes.error) throw new Error(groupsRes.error.message);
    if (wordsRes.error) throw new Error(wordsRes.error.message);

    const groupIdByUid = new Map<string, number>();
    await withRemoteWrites(async () => {
      // groups first so word group references resolve
      for (const r of groupsRes.data) {
        const local = await db.groups.where("uid").equals(r.uid).first();
        if (!local) {
          const id = (await db.groups.add({
            uid: r.uid,
            name: r.name,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
            dirty: 0,
          })) as number;
          groupIdByUid.set(r.uid, id);
        } else {
          groupIdByUid.set(r.uid, local.id!);
          const localWins = local.dirty && (local.updatedAt ?? 0) > r.updated_at;
          if (!localWins) {
            await db.groups.update(local.id!, {
              name: r.name,
              updatedAt: r.updated_at,
              dirty: 0,
            });
          }
        }
      }

      for (const r of wordsRes.data) {
        const groupIds = ((r.group_uids ?? []) as string[])
          .map((u) => groupIdByUid.get(u))
          .filter((id): id is number => id != null);
        const fields: Partial<Word> = {
          german: r.german,
          article: (r.article ?? undefined) as Article | undefined,
          english: r.english ?? undefined,
          plural: r.plural ?? undefined,
          ipa: r.ipa ?? undefined,
          pos: (r.pos ?? undefined) as PartOfSpeech | undefined,
          example: r.example ?? undefined,
          exampleEn: r.example_en ?? undefined,
          notes: r.notes ?? undefined,
          favorite: r.favorite ? 1 : 0,
          groupIds,
          status: (r.status ?? "ready") as WordStatus,
          updatedAt: r.updated_at,
          dirty: 0,
        };
        const local = await db.words.where("uid").equals(r.uid).first();
        if (!local) {
          await db.words.add({
            uid: r.uid,
            createdAt: r.created_at,
            ...fields,
          } as Word);
        } else {
          const localWins = local.dirty && local.updatedAt > r.updated_at;
          if (!localWins) await db.words.update(local.id!, fields);
        }
      }

      // 5. reconcile: remove local synced rows deleted on another device
      const remoteWordUids = new Set(wordsRes.data.map((r) => r.uid));
      const remoteGroupUids = new Set(groupsRes.data.map((r) => r.uid));
      const staleWords = await db.words
        .filter((w) => !w.dirty && !!w.uid && !remoteWordUids.has(w.uid))
        .toArray();
      const staleGroups = await db.groups
        .filter((g) => !g.dirty && !!g.uid && !remoteGroupUids.has(g.uid))
        .toArray();
      if (staleWords.length > 0) await db.words.bulkDelete(staleWords.map((w) => w.id!));
      if (staleGroups.length > 0) await db.groups.bulkDelete(staleGroups.map((g) => g.id!));
    });

    // brand-new account with no groups anywhere → seed the default group
    // (after the pull, so an existing "General" from another device wins)
    if ((await db.groups.count()) === 0) {
      await db.groups.add({ name: "General", createdAt: Date.now() });
    }

    const now = Date.now();
    localStorage.setItem(LAST_SYNC_KEY, String(now));
    localStorage.setItem(LAST_USER_KEY, user.id);
    setState({ status: "idle", lastSyncAt: now });
  } catch (e) {
    setState({
      status: "error",
      error: e instanceof Error ? e.message : "Sync failed",
    });
  } finally {
    syncing = false;
    if (rerun) {
      rerun = false;
      void syncNow();
    }
  }
}

/**
 * When a different account logs in on this device, clear the previous
 * account's local data (it lives safely in their cloud). Data added while
 * logged out is dirty and therefore kept + uploaded to the new account.
 */
async function handleAccountSwitch(userId: string) {
  const last = localStorage.getItem(LAST_USER_KEY);
  if (!last || last === userId) return;
  await withRemoteWrites(async () => {
    const syncedWords = await db.words.filter((w) => !w.dirty).toArray();
    const syncedGroups = await db.groups.filter((g) => !g.dirty).toArray();
    await db.words.bulkDelete(syncedWords.map((w) => w.id!));
    await db.groups.bulkDelete(syncedGroups.map((g) => g.id!));
    await db.outbox.clear();
  });
  localStorage.removeItem(LAST_SYNC_KEY);
  localStorage.setItem(LAST_USER_KEY, userId);
}
