import Dexie, { type EntityTable } from "dexie";
import type { Word, Group, DictEntry } from "./types";

const db = new Dexie("vokabi") as Dexie & {
  words: EntityTable<Word, "id">;
  groups: EntityTable<Group, "id">;
  dictCache: EntityTable<DictEntry, "key">;
};

db.version(1).stores({
  words: "++id, german, english, favorite, *groupIds, createdAt",
  groups: "++id, name, createdAt",
  dictCache: "key, fetchedAt",
});

export { db };
