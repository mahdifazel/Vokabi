import Dexie, { type EntityTable, type Transaction } from "dexie";
import type { Word, Group, DictEntry, OutboxEntry } from "./types";

const db = new Dexie("vokabi") as Dexie & {
  words: EntityTable<Word, "id">;
  groups: EntityTable<Group, "id">;
  dictCache: EntityTable<DictEntry, "key">;
  outbox: EntityTable<OutboxEntry, "id">;
};

db.version(1).stores({
  words: "++id, german, english, favorite, *groupIds, createdAt",
  groups: "++id, name, createdAt",
  dictCache: "key, fetchedAt",
});

db.version(2)
  .stores({
    words: "++id, uid, german, english, favorite, *groupIds, createdAt, dirty",
    groups: "++id, uid, name, createdAt, dirty",
    dictCache: "key, fetchedAt",
    outbox: "++id, uid",
  })
  .upgrade(async (tx) => {
    await tx.table("words").toCollection().modify((w) => {
      w.uid ??= crypto.randomUUID();
      w.dirty = 1;
    });
    await tx.table("groups").toCollection().modify((g) => {
      g.uid ??= crypto.randomUUID();
      g.dirty = 1;
      g.updatedAt ??= g.createdAt;
    });
  });

/**
 * While the sync engine applies remote rows it tags its transaction so the
 * hooks below don't re-mark those rows as dirty (which would echo them back
 * up). This is tagged on the Dexie transaction itself (via PSD, propagated
 * through the async call chain), not a plain module-level boolean: a global
 * flag would stay "true" for the whole multi-await pull/merge pass and could
 * misclassify an unrelated, concurrent user write (e.g. creating a group)
 * that merely happens to run while a sync is in flight, stripping it of its
 * dirty flag so the next reconcile pass deletes it as a stale row. Wrapping
 * the work in a real `db.transaction()` additionally makes IndexedDB itself
 * serialize genuinely concurrent writes to these tables against the sync's
 * transaction, so they can never interleave with it in the first place.
 */
type TaggedTransaction = Transaction & { applyingRemote?: boolean };

export function withRemoteWrites<T>(fn: () => Promise<T>): Promise<T> {
  return db.transaction("rw", db.words, db.groups, db.outbox, async () => {
    (Dexie.currentTransaction as TaggedTransaction).applyingRemote = true;
    return fn();
  });
}

function isApplyingRemote(): boolean {
  return !!(Dexie.currentTransaction as TaggedTransaction | undefined)?.applyingRemote;
}

/** Called after any local (user-initiated) mutation; sync.ts subscribes. */
let mutationListener: (() => void) | null = null;
export function onLocalMutation(cb: () => void) {
  mutationListener = cb;
}

function touched() {
  mutationListener?.();
}

for (const table of [db.words, db.groups] as const) {
  table.hook("creating", (_pk, obj: Word | Group) => {
    obj.uid ??= crypto.randomUUID();
    if (!isApplyingRemote()) {
      obj.dirty = 1;
      queueMicrotask(touched);
    }
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  table.hook("updating", (mods: any) => {
    if (isApplyingRemote()) return undefined;
    queueMicrotask(touched);
    return { ...mods, dirty: 1, updatedAt: Date.now() };
  });
}

export { db };
