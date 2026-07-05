import Dexie, { type EntityTable } from "dexie";
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
 * While the sync engine applies remote rows it sets this flag so the hooks
 * below don't re-mark those rows as dirty (which would echo them back up).
 */
let applyingRemote = false;
export function withRemoteWrites<T>(fn: () => Promise<T>): Promise<T> {
  applyingRemote = true;
  return fn().finally(() => {
    applyingRemote = false;
  });
}

/** Called after any local (user-initiated) mutation; sync.ts subscribes. */
let mutationListener: (() => void) | null = null;
export function onLocalMutation(cb: () => void) {
  mutationListener = cb;
}

function touched() {
  if (!applyingRemote) mutationListener?.();
}

for (const table of [db.words, db.groups] as const) {
  table.hook("creating", (_pk, obj: Word | Group) => {
    obj.uid ??= crypto.randomUUID();
    if (!applyingRemote) {
      obj.dirty = 1;
      queueMicrotask(touched);
    }
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  table.hook("updating", (mods: any) => {
    if (applyingRemote) return undefined;
    queueMicrotask(touched);
    return { ...mods, dirty: 1, updatedAt: Date.now() };
  });
}

export { db };
