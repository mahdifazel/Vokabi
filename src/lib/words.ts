import { db } from "./db";
import { buildWord, lookupWord, splitWordList, type ParsedInput } from "./dictionary";
import { scheduleSync } from "./sync";
import type { Word } from "./types";

/**
 * When the caller didn't pick any groups and exactly one group exists,
 * that group is the only sensible destination — target it automatically.
 */
async function resolveTargetGroups(groupIds: number[]): Promise<number[]> {
  if (groupIds.length > 0) return groupIds;
  const groups = await db.groups.toArray();
  return groups.length === 1 && groups[0].id != null ? [groups[0].id] : [];
}

/**
 * Add words from pasted text. Inserts rows immediately (status "pending"),
 * then enriches them from the dictionary in the background so the UI stays fast.
 */
export async function addWordsFromText(text: string, groupIds: number[] = []): Promise<number[]> {
  const inputs = splitWordList(text);
  if (inputs.length === 0) return [];
  groupIds = await resolveTargetGroups(groupIds);

  const now = Date.now();
  const fresh: { input: ParsedInput; word: Word }[] = [];
  const ids: number[] = [];

  for (const input of inputs) {
    const existing = await db.words
      .where("german")
      .equalsIgnoreCase(input.german)
      .first();
    if (existing?.id != null) {
      // merge group membership instead of duplicating
      const merged = [...new Set([...existing.groupIds, ...groupIds])];
      if (merged.length !== existing.groupIds.length) {
        await db.words.update(existing.id, { groupIds: merged, updatedAt: now });
      }
      ids.push(existing.id);
      continue;
    }
    const word: Word = {
      german: input.german,
      article: input.articleHint,
      favorite: 0,
      groupIds,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    };
    const id = (await db.words.add(word)) as number;
    ids.push(id);
    fresh.push({ input, word: { ...word, id } });
  }

  // Enrich in background (bounded concurrency to be polite to the APIs)
  void enrichWords(fresh);
  return ids;
}

async function enrichWords(items: { input: ParsedInput; word: Word }[]) {
  const CONCURRENCY = 3;
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
      while (i < items.length) {
        const item = items[i++];
        await enrichOne(item.input, item.word.id!);
      }
    })
  );
}

async function enrichOne(input: ParsedInput, id: number) {
  try {
    const entry = await lookupWord(input);
    const built = buildWord(input, entry);
    await db.words.update(id, {
      german: built.german,
      article: built.article,
      english: built.english,
      plural: built.plural,
      ipa: built.ipa,
      pos: built.pos,
      status: built.status,
      updatedAt: Date.now(),
    });
  } catch {
    await db.words.update(id, { status: "notfound", updatedAt: Date.now() });
  }
}

/**
 * Every account starts with a "General" group so first-time users have an
 * obvious place for their words. Only created when no groups exist at all.
 */
export async function ensureDefaultGroup() {
  const count = await db.groups.count();
  if (count === 0) {
    await db.groups.add({ name: "General", createdAt: Date.now() });
  }
}

/** Retry enrichment for words that previously failed (e.g. added offline) */
export async function retryPendingLookups() {
  const stale = await db.words.filter((w) => w.status !== "ready").toArray();
  for (const w of stale) {
    if (w.id != null) {
      await enrichOne({ german: w.german, articleHint: w.article }, w.id);
    }
  }
}

export async function toggleFavorite(word: Word) {
  if (word.id == null) return;
  await db.words.update(word.id, {
    favorite: word.favorite ? 0 : 1,
    updatedAt: Date.now(),
  });
}

export async function setWordGroups(wordId: number, groupIds: number[]) {
  await db.words.update(wordId, { groupIds, updatedAt: Date.now() });
}

export async function deleteWord(wordId: number) {
  const word = await db.words.get(wordId);
  await db.transaction("rw", db.words, db.outbox, async () => {
    if (word?.uid) await db.outbox.add({ table: "words", uid: word.uid });
    await db.words.delete(wordId);
  });
  scheduleSync();
}

export async function deleteGroupAndDetachWords(groupId: number) {
  const members = await db.words.where("groupIds").equals(groupId).toArray();
  const group = await db.groups.get(groupId);
  await db.transaction("rw", db.words, db.groups, db.outbox, async () => {
    for (const w of members) {
      await db.words.update(w.id!, {
        groupIds: w.groupIds.filter((g) => g !== groupId),
      });
    }
    if (group?.uid) await db.outbox.add({ table: "groups", uid: group.uid });
    await db.groups.delete(groupId);
  });
  scheduleSync();
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export function matchesQuery(word: Word, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    word.german.toLowerCase().includes(q) ||
    (word.english?.toLowerCase().includes(q) ?? false) ||
    (word.article?.toLowerCase() === q) ||
    (word.plural?.toLowerCase().includes(q) ?? false)
  );
}

// ---------------------------------------------------------------------------
// Import / export
// ---------------------------------------------------------------------------

export function wordsToCSV(words: Word[]): string {
  const esc = (s: string | undefined) =>
    s == null ? "" : /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  const header = "german,article,english,plural,pos,ipa,example,notes,favorite";
  const rows = words.map((w) =>
    [w.german, w.article, w.english, w.plural, w.pos, w.ipa, w.example, w.notes, w.favorite ? "yes" : ""]
      .map(esc)
      .join(",")
  );
  return [header, ...rows].join("\n");
}

export function wordsToJSON(words: Word[]): string {
  return JSON.stringify(
    words.map((w) => {
      const copy: Partial<Word> = { ...w };
      delete copy.id;
      return copy;
    }),
    null,
    2
  );
}

/** Parse CSV text (handles quoted fields). Returns rows of cells. */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else inQuotes = false;
      } else cell += c;
    } else if (c === '"') inQuotes = true;
    else if (c === "," || c === ";" || c === "\t") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}

/**
 * Import words from a CSV/TXT file body. Recognizes an optional header row
 * and "german,english" style two-column files; single-column files are
 * treated like pasted lists.
 */
export async function importFromDelimited(text: string, groupIds: number[] = []): Promise<number> {
  const rows = parseCSV(text);
  if (rows.length === 0) return 0;
  groupIds = await resolveTargetGroups(groupIds);

  let start = 0;
  const first = rows[0].map((c) => c.trim().toLowerCase());
  const isHeader = first.includes("german") || first.includes("deutsch") || first.includes("word");
  const germanCol = isHeader
    ? Math.max(first.indexOf("german"), first.indexOf("deutsch"), first.indexOf("word"), 0)
    : 0;
  const englishCol = isHeader
    ? Math.max(first.indexOf("english"), first.indexOf("translation"))
    : rows[0].length > 1
      ? 1
      : -1;
  if (isHeader) start = 1;

  let count = 0;
  const now = Date.now();
  const pending: { input: ParsedInput; word: Word }[] = [];
  for (let i = start; i < rows.length; i++) {
    const german = rows[i][germanCol]?.trim();
    if (!german) continue;
    const english = englishCol >= 0 ? rows[i][englishCol]?.trim() : undefined;
    const m = german.match(/^(der|die|das)\s+(.+)$/i);
    const input: ParsedInput = m
      ? { german: m[2].trim(), articleHint: m[1].toLowerCase() as never }
      : { german };

    const existing = await db.words.where("german").equalsIgnoreCase(input.german).first();
    if (existing?.id != null) {
      const merged = [...new Set([...existing.groupIds, ...groupIds])];
      await db.words.update(existing.id, { groupIds: merged, updatedAt: now });
      continue;
    }
    const word: Word = {
      german: input.german,
      article: input.articleHint,
      english: english || undefined,
      favorite: 0,
      groupIds,
      status: english ? "ready" : "pending",
      createdAt: now,
      updatedAt: now,
    };
    const id = (await db.words.add(word)) as number;
    count++;
    if (!english) pending.push({ input, word: { ...word, id } });
  }
  void enrichWords(pending);
  return count;
}

export function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
