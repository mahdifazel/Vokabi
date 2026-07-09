"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import {
  BookOpen,
  ChevronRight,
  FolderOpen,
  FolderPlus,
  Heart,
  Plus,
  Search,
  X,
} from "lucide-react";
import { db } from "@/lib/db";
import { matchesQuery } from "@/lib/words";
import { WordRow } from "@/components/word-row";
import { AddWordsSheet } from "@/components/add-words-sheet";
import { VokabiLogo } from "@/components/logo";
import { Button, Card, EmptyState, Input, Sheet } from "@/components/ui";

export default function LibraryPage() {
  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [groupName, setGroupName] = useState("");

  const words = useLiveQuery(() => db.words.orderBy("createdAt").reverse().toArray(), []);
  const groups = useLiveQuery(() => db.groups.orderBy("name").toArray(), []);

  const favCount = useMemo(() => (words ?? []).filter((w) => w.favorite).length, [words]);
  const counts = useMemo(() => {
    const map = new Map<number, number>();
    for (const w of words ?? []) {
      for (const g of w.groupIds) map.set(g, (map.get(g) ?? 0) + 1);
    }
    return map;
  }, [words]);

  const searching = query.trim().length > 0;
  const results = useMemo(
    () => (searching ? (words ?? []).filter((w) => matchesQuery(w, query)) : []),
    [words, query, searching]
  );

  async function createGroup() {
    const name = groupName.trim();
    if (!name) return;
    await db.groups.add({ name, createdAt: Date.now() });
    setGroupName("");
    setCreateOpen(false);
  }

  return (
    <div className="px-4 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <header className="mb-4 flex items-center gap-3">
        <VokabiLogo size={40} />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-black tracking-tight">Vokabi</h1>
          <p className="text-sm font-semibold text-muted">
            {words ? `${words.length} word${words.length === 1 ? "" : "s"}` : "…"}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setCreateOpen(true)}>
          <FolderPlus size={16} /> New group
        </Button>
      </header>

      {/* find any word across the whole library */}
      <div className="relative mb-4">
        <Search size={18} className="absolute top-1/2 left-4 -translate-y-1/2 text-muted" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search all words…"
          className="pr-10 pl-11"
          type="search"
          aria-label="Search words"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="absolute top-1/2 right-3 flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-muted active:bg-surface-2"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {searching ? (
        results.length === 0 ? (
          <EmptyState icon={<Search size={28} />} title="Nothing found" hint={`No words match “${query}”.`} />
        ) : (
          <div className="flex flex-col gap-2.5">
            {results.map((w, i) => (
              <WordRow key={w.id} word={w} index={i} />
            ))}
          </div>
        )
      ) : words && words.length === 0 && (groups?.length ?? 0) <= 1 ? (
        <EmptyState
          icon={<BookOpen size={28} />}
          title="No words yet"
          hint="Paste a single word or a whole vocabulary list — Vokabi finds articles and translations for you."
          action={
            <Button onClick={() => setAddOpen(true)}>
              <Plus size={18} /> Add your first words
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-2.5">
          {/* All words — redundant when there's only one group */}
          {(groups?.length ?? 0) > 1 && (
            <Link href="/all" className="cursor-pointer">
              <Card className="flex items-center gap-3 p-4 transition-transform active:scale-[0.98]">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                  <BookOpen size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-extrabold">All words</p>
                  <p className="text-sm font-semibold text-muted">
                    {words?.length ?? 0} word{(words?.length ?? 0) === 1 ? "" : "s"}
                  </p>
                </div>
                <ChevronRight size={18} className="text-muted" />
              </Card>
            </Link>
          )}

          {/* Favorites */}
          {favCount > 0 && (
            <Link href="/favorites" className="cursor-pointer">
              <Card className="flex items-center gap-3 p-4 transition-transform active:scale-[0.98]">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-100 text-rose-500 dark:bg-rose-500/15 dark:text-rose-400">
                  <Heart size={20} fill="currentColor" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-extrabold">Favorites</p>
                  <p className="text-sm font-semibold text-muted">
                    {favCount} word{favCount === 1 ? "" : "s"}
                  </p>
                </div>
                <ChevronRight size={18} className="text-muted" />
              </Card>
            </Link>
          )}

          {/* Groups */}
          {groups?.map((g) => {
            const n = counts.get(g.id!) ?? 0;
            return (
              <Link key={g.id} href={`/groups/${g.id}`} className="cursor-pointer">
                <Card className="flex items-center gap-3 p-4 transition-transform active:scale-[0.98]">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                    <FolderOpen size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-extrabold">{g.name}</p>
                    <p className="text-sm font-semibold text-muted">
                      {n} word{n === 1 ? "" : "s"}
                    </p>
                  </div>
                  <ChevronRight size={18} className="text-muted" />
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {/* add words FAB */}
      <button
        onClick={() => setAddOpen(true)}
        aria-label="Add words"
        className="fixed right-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-30 flex h-14 w-14 cursor-pointer items-center justify-center rounded-2xl bg-primary text-on-primary shadow-xl transition-transform active:scale-90"
      >
        <Plus size={26} />
      </button>

      <AddWordsSheet open={addOpen} onClose={() => setAddOpen(false)} />

      <Sheet open={createOpen} onClose={() => setCreateOpen(false)} title="New group">
        <Input
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          placeholder="e.g. Food, A1, Verbs…"
          autoFocus
          onKeyDown={(e) => e.key === "Enter" && createGroup()}
        />
        <Button className="mt-4 w-full" size="lg" disabled={!groupName.trim()} onClick={createGroup}>
          Create group
        </Button>
      </Sheet>
    </div>
  );
}
