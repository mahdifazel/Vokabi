"use client";

import { useSyncExternalStore } from "react";
import { db, onLocalMutation, withRemoteWrites } from "./db";
import { getSupabase } from "./supabase";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getUser } from "./auth";
// circular with words.ts (it imports scheduleSync); safe, both only call at runtime
import {
  backfillMissingWordFields,
  ensureWordsGrouped,
  resumePendingEnrichment,
  seedDefaultPresetGroups,
} from "./words";
import { scheduleExampleBackfill } from "./examples";
import { scheduleDefinitionBackfill } from "./definitions";
import { diag } from "./diag";
import type { Article, Group, PartOfSpeech, Word, WordStatus } from "./types";

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

interface RemoteGroupRow {
  uid: string;
  name: string;
  created_at: number;
  updated_at: number;
}

interface RemoteWordRow {
  uid: string;
  german: string;
  article: string | null;
  english: string | null;
  plural: string | null;
  ipa: string | null;
  pos: string | null;
  example: string | null;
  example_en: string | null;
  definition_de: string | null;
  notes: string | null;
  favorite: boolean | null;
  group_uids: string[] | null;
  status: string | null;
  created_at: number;
  updated_at: number;
}

/**
 * PostgREST caps every response at the project's `max-rows` setting (1000 by
 * default on Supabase) and does so silently: the request succeeds, there is no
 * error, the result is simply short. A plain `.select("*")` therefore stops
 * being "everything this account has" as soon as the library passes that cap,
 * and the stale-row reconcile below reads the missing rows as "deleted on
 * another device" and deletes them locally, over and over, pinning the device
 * to exactly `max-rows` words.
 *
 * Page through instead, keyset style on `uid` (the primary key, so the order is
 * total and stable and a concurrent insert can't shift a window out from under
 * us) until the server returns an empty page. Reaching that empty page is the
 * only thing that proves the set is complete, which is what the reconcile pass
 * needs before it is allowed to delete anything.
 */
const PULL_PAGE_SIZE = 500;
// a stop so a misbehaving backend can never spin here; far above any real library
const PULL_MAX_PAGES = 200;

async function pullTable<T extends { uid: string }>(
  supabase: SupabaseClient,
  table: "words" | "groups"
): Promise<{ rows: T[]; complete: boolean }> {
  const rows: T[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < PULL_MAX_PAGES; page++) {
    let query = supabase
      .from(table)
      .select("*")
      .order("uid", { ascending: true })
      .limit(PULL_PAGE_SIZE);
    if (cursor) query = query.gt("uid", cursor);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    const batch = (data ?? []) as T[];
    if (batch.length === 0) return { rows, complete: true };
    rows.push(...batch);
    cursor = batch[batch.length - 1].uid;
  }
  // ran out of pages: treat as a short pull rather than proof of deletion
  return { rows, complete: false };
}

/**
 * PostgREST puts filter values in the query string, and the request starts
 * failing with a 400 somewhere above ~24 KB of URL - about 650 uids. Writes go
 * out in chunks for the same reason: one oversized request used to fail the
 * whole sync, and because its tombstones stayed in the outbox it failed again
 * on every retry, leaving sync permanently broken with nothing reaching the
 * cloud any more.
 */
const DELETE_CHUNK = 100;
const UPSERT_CHUNK = 200;

function chunked<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// ---------------------------------------------------------------------------
// Reconcile safety
// ---------------------------------------------------------------------------

/**
 * Reconcile is the one place the engine deletes data nobody asked it to
 * delete: it infers "this row was deleted on another device" from the row
 * being absent from a pull. Every way a pull can be wrong produces that exact
 * same absence - truncated at a backend row cap, cut short by a network blip,
 * served while another tab was still writing, served under a momentarily wrong
 * session - and the inference destroys local data either way. So absence is
 * never sufficient on its own; see `reconcilable()` for the conditions that
 * have to hold, and note that reconcile deletes *locally only* (it never
 * writes a tombstone), so anything it removes by mistake is still in the cloud
 * and comes back once pulls are trustworthy again.
 */
const PURGE_KEY = "vokabi.pendingPurge";
/** below this many rows a deletion is too small to be worth a second opinion */
const PURGE_MIN_ROWS = 25;
/** ...and it also has to be this large a share of the table to count as a purge */
const PURGE_FRACTION = 0.25;
/** a purge has to still be there this much later, so one bad moment can't confirm itself */
const PURGE_CONFIRM_MS = 30_000;

type PurgeRecord = Record<string, { sig: string; at: number } | undefined>;

function readPurgeRecord(): PurgeRecord {
  try {
    return (JSON.parse(localStorage.getItem(PURGE_KEY) ?? "{}") as PurgeRecord) ?? {};
  } catch {
    return {};
  }
}

function writePurgeRecord(record: PurgeRecord) {
  try {
    localStorage.setItem(PURGE_KEY, JSON.stringify(record));
  } catch {
    // storage unavailable; the guard degrades to "confirm every time"
  }
}

/** order-independent fingerprint; only has to answer "the same set again?" */
function purgeSignature(uids: string[]): string {
  let h = 0x811c9dc5;
  for (const uid of [...uids].sort()) {
    for (let i = 0; i < uid.length; i++) {
      h ^= uid.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
  }
  return `${uids.length}:${(h >>> 0).toString(36)}`;
}

/**
 * A reconcile about to remove a large share of a table is what every incident
 * so far has looked like from the inside, and the cause is never visible from
 * here. Make such a deletion prove itself: the identical set has to come back
 * from a second pull at least PURGE_CONFIRM_MS later. A real mass deletion
 * elsewhere is stable and simply lands one sync later, while a truncated,
 * stale or partial pull essentially never reproduces the same set twice over.
 */
function purgeConfirmed(table: string, uids: string[], tableSize: number): boolean {
  const record = readPurgeRecord();
  const isPurge = uids.length >= PURGE_MIN_ROWS && uids.length >= tableSize * PURGE_FRACTION;
  if (!isPurge) {
    if (record[table]) {
      delete record[table];
      writePurgeRecord(record);
    }
    return true;
  }
  const sig = purgeSignature(uids);
  const seen = record[table];
  if (seen?.sig === sig && Date.now() - seen.at >= PURGE_CONFIRM_MS) {
    delete record[table];
    writePurgeRecord(record);
    diag(`sync: confirmed removal of ${uids.length} ${table} deleted elsewhere`);
    return true;
  }
  if (seen?.sig !== sig) record[table] = { sig, at: Date.now() };
  writePurgeRecord(record);
  diag(`sync: holding back removal of ${uids.length}/${tableSize} ${table}, awaiting a second pull`);
  return false;
}

/**
 * Whether this pull may be used to delete local rows at all. Both conditions
 * are about the pull itself rather than the rows:
 *
 * - `complete`: pullTable paged to an empty page instead of stopping at a
 *   backend row cap. Without this, every row past the cap reads as deleted and
 *   the library gets truncated to exactly the cap on every single sync.
 * - non-empty, unless the table was empty here beforehand: an empty result is
 *   far more often a hiccup (auth/session, network, a momentary RLS mismatch)
 *   than a genuine "the user deleted everything".
 */
function reconcilable(
  table: string,
  pull: { rows: unknown[]; complete: boolean },
  syncedBefore: number
): boolean {
  if (!pull.complete) {
    diag(`sync: ${table} pull incomplete, skipping cleanup`);
    console.warn(`Vokabi sync: ${table} pull incomplete, skipping stale-row cleanup`);
    return false;
  }
  if (pull.rows.length === 0 && syncedBefore > 0) {
    diag(`sync: ${table} pull empty but ${syncedBefore} synced locally, skipping cleanup`);
    console.warn(`Vokabi sync: ${table} pull came back empty, skipping stale-row cleanup`);
    return false;
  }
  return true;
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

    // 1. push deletions, in chunks (see DELETE_CHUNK: one request carrying
    // every uid overflows the query string and 400s, which used to brick sync)
    const tombstones = await db.outbox.toArray();
    for (const table of ["words", "groups"] as const) {
      const uids = tombstones.filter((t) => t.table === table).map((t) => t.uid);
      for (const batch of chunked(uids, DELETE_CHUNK)) {
        const { error } = await supabase.from(table).delete().in("uid", batch);
        if (error) throw new Error(error.message);
      }
    }
    // only the tombstones that were actually pushed; clearing the whole table
    // would swallow a deletion queued while the request was in flight, and
    // the next pull would resurrect that row
    await db.outbox.bulkDelete(tombstones.map((t) => t.id!));

    // 2. push dirty groups
    const dirtyGroups = await db.groups.where("dirty").equals(1).toArray();
    for (const batch of chunked(dirtyGroups, UPSERT_CHUNK)) {
      const { error } = await supabase.from("groups").upsert(
        batch.map((g) => ({
          uid: g.uid,
          user_id: user.id,
          name: g.name,
          created_at: g.createdAt,
          updated_at: g.updatedAt ?? g.createdAt,
        }))
      );
      if (error) throw new Error(error.message);
      // clear `dirty` only on rows that still look exactly like what was
      // pushed: a rename that landed while the upsert was in flight is not in
      // the cloud, and marking it clean would both drop it from the next push
      // and let the older remote copy overwrite it in the merge below.
      // Per chunk, so a later chunk failing can't un-record what already went up
      const pushedAt = new Map(batch.map((g) => [g.id!, g.updatedAt ?? g.createdAt] as const));
      await withRemoteWrites(() =>
        db.groups
          .where("id")
          .anyOf([...pushedAt.keys()])
          .modify((g) => {
            if ((g.updatedAt ?? g.createdAt) === pushedAt.get(g.id!)) g.dirty = 0;
          })
      );
    }

    // 3. push dirty words (translate local numeric group ids → group uids)
    const groupUidById = new Map<number, string>();
    await db.groups.each((g) => {
      if (g.id != null && g.uid) groupUidById.set(g.id, g.uid);
    });
    const dirtyWords = await db.words.where("dirty").equals(1).toArray();
    for (const batch of chunked(dirtyWords, UPSERT_CHUNK)) {
      const { error } = await supabase.from("words").upsert(
        batch.map((w) => ({
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
          definition_de: w.definitionDe ?? null,
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
      // same as for groups: enrichment and the example/definition backfills
      // write to these rows while the upsert is in flight, so only the rows
      // that are unchanged since the snapshot count as pushed
      const pushedAt = new Map(batch.map((w) => [w.id!, w.updatedAt] as const));
      await withRemoteWrites(() =>
        db.words
          .where("id")
          .anyOf([...pushedAt.keys()])
          .modify((w) => {
            if (w.updatedAt === pushedAt.get(w.id!)) w.dirty = 0;
          })
      );
    }

    // Which rows this device already considered synced, captured *before* the
    // pull goes out. Only these may be judged by what the pull contains: a row
    // another tab pushed while our request was in flight is clean and does
    // exist remotely, yet is missing from the snapshot of the server we are
    // about to receive, and deleting it would be pure race.
    const syncedWordUids = new Set<string>();
    await db.words.each((w) => {
      if (!w.dirty && w.uid) syncedWordUids.add(w.uid);
    });
    const syncedGroupUids = new Set<string>();
    await db.groups.each((g) => {
      if (!g.dirty && g.uid) syncedGroupUids.add(g.uid);
    });

    // 4. pull all remote rows (paged, see pullTable: a single select is
    // silently truncated at the backend's max-rows)
    const [groupsPull, wordsPull] = await Promise.all([
      pullTable<RemoteGroupRow>(supabase, "groups"),
      pullTable<RemoteWordRow>(supabase, "words"),
    ]);

    const groupIdByUid = new Map<string, number>();
    await withRemoteWrites(async () => {
      // groups first so word group references resolve
      for (const r of groupsPull.rows) {
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

      for (const r of wordsPull.rows) {
        const local = await db.words.where("uid").equals(r.uid).first();
        const remoteGroups = (r.group_uids ?? []) as string[];
        const groupIds = remoteGroups
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
          definitionDe: r.definition_de ?? undefined,
          notes: r.notes ?? undefined,
          favorite: r.favorite ? 1 : 0,
          groupIds,
          status: (r.status ?? "ready") as WordStatus,
          updatedAt: r.updated_at,
          dirty: 0,
        };
        // The word claims groups, but none of them resolved to a local row -
        // the group is missing from this pull rather than gone. Writing the
        // empty list would strip the word of its membership and
        // ensureWordsGrouped() would then re-home it to "General", quietly
        // moving it out of its group. Keep what the device already has.
        if (remoteGroups.length > 0 && groupIds.length === 0 && local?.groupIds.length) {
          delete fields.groupIds;
        }
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

      // 5. reconcile: remove local rows that were deleted on another device.
      // See the "Reconcile safety" block above for why absence from a pull is
      // never on its own enough to delete on. A row has to clear all of:
      //   - the pull it is judged against is trustworthy (`reconcilable`)
      //   - it is not dirty, i.e. it holds nothing this device hasn't pushed
      //   - this device already had it synced *before* that pull went out,
      //     so it isn't something another tab uploaded mid-request
      //   - and, if the result is a mass deletion, a second pull agrees
      const remoteWordUids = new Set(wordsPull.rows.map((r) => r.uid));
      const remoteGroupUids = new Set(groupsPull.rows.map((r) => r.uid));

      let staleWords: Word[] = [];
      if (reconcilable("words", wordsPull, syncedWordUids.size)) {
        staleWords = await db.words
          .filter(
            (w) => !w.dirty && !!w.uid && syncedWordUids.has(w.uid) && !remoteWordUids.has(w.uid)
          )
          .toArray();
        if (!purgeConfirmed("words", staleWords.map((w) => w.uid!), syncedWordUids.size)) {
          staleWords = [];
        }
      }

      let staleGroups: Group[] = [];
      if (reconcilable("groups", groupsPull, syncedGroupUids.size)) {
        staleGroups = await db.groups
          .filter(
            (g) => !g.dirty && !!g.uid && syncedGroupUids.has(g.uid) && !remoteGroupUids.has(g.uid)
          )
          .toArray();
        if (!purgeConfirmed("groups", staleGroups.map((g) => g.uid!), syncedGroupUids.size)) {
          staleGroups = [];
        }
      }

      if (staleWords.length > 0) {
        diag(`sync: removing ${staleWords.length} words deleted elsewhere`);
        await db.words.bulkDelete(staleWords.map((w) => w.id!));
      }
      if (staleGroups.length > 0) {
        diag(`sync: removing ${staleGroups.length} groups deleted elsewhere`);
        await db.groups.bulkDelete(staleGroups.map((g) => g.id!));
      }
    });

    // brand-new account with no groups anywhere → seed the default group
    // (after the pull, so an existing "General" from another device wins),
    // and re-home any words whose groups didn't survive the merge so they
    // stay visible on the library page
    await ensureWordsGrouped();

    // admin-curated default preset groups: materialize any this account
    // hasn't seen yet (after the pull, so synced copies win by name).
    // Best effort, a failure here must not mark the sync as failed
    await seedDefaultPresetGroups().catch(() => {});

    // pick words stuck on "looking up" back up (interrupted enrichment on
    // this device, or rows that arrived pending from another device).
    // Fire-and-forget: enriching a big group can take minutes
    void resumePendingEnrichment();

    // heal "ready" words missing pos/translation from before these fields
    // were reliably enriched, so old verbs get their details too
    void backfillMissingWordFields();

    // fill in example sentences for words that still lack one (delayed +
    // batched; a no-op when everything has an example already)
    scheduleExampleBackfill();

    // same for German definitions when the meaning language is Deutsch
    scheduleDefinitionBackfill();

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
