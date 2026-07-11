"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
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
import { GROUP_TILES } from "@/lib/types";
import { WordRow } from "@/components/word-row";
import { AddWordsSheet } from "@/components/add-words-sheet";
import { NewGroupSheet } from "@/components/new-group-sheet";
import { VokabiLogo } from "@/components/logo";
import { Button, Card, EmptyState, Input, cn } from "@/components/ui";

function cardReveal(index: number) {
  return {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.25, delay: Math.min(index * 0.05, 0.4) },
  };
}

export default function LibraryPage() {
  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

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

  return (
    <div className="px-4 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <header className="mb-4 flex items-center gap-3">
        <VokabiLogo size={40} />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-black tracking-tight">Vokabi</h1>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-muted">
            {words ? `${words.length} word${words.length === 1 ? "" : "s"}` : "…"}
            <span aria-hidden className="ml-0.5 inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500 dark:bg-blue-400" />
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500 dark:bg-rose-400" />
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
            </span>
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
          hint="Paste a single word or a whole vocabulary list. Vokabi finds articles and translations for you."
          action={
            <Button onClick={() => setAddOpen(true)}>
              <Plus size={18} /> Add your first words
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-2.5">
          {/* All words, redundant when there's only one group */}
          {(groups?.length ?? 0) > 1 && (
            <motion.div {...cardReveal(0)}>
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
            </motion.div>
          )}

          {/* Favorites */}
          {favCount > 0 && (
            <motion.div {...cardReveal(1)}>
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
            </motion.div>
          )}

          {/* Groups */}
          {groups?.map((g, i) => {
            const n = counts.get(g.id!) ?? 0;
            return (
              <motion.div key={g.id} {...cardReveal(i + 2)}>
                <Link href={`/groups/${g.id}`} className="cursor-pointer">
                  <Card className="flex items-center gap-3 p-4 transition-transform active:scale-[0.98]">
                    <div
                      className={cn(
                        "flex h-11 w-11 items-center justify-center rounded-2xl",
                        GROUP_TILES[(g.id ?? 0) % GROUP_TILES.length]
                      )}
                    >
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
              </motion.div>
            );
          })}
        </div>
      )}

      {/* add words FAB */}
      <button
        onClick={() => setAddOpen(true)}
        aria-label="Add words"
        className="fixed right-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-30 flex h-14 w-14 cursor-pointer items-center justify-center rounded-2xl bg-linear-to-br from-primary to-violet-600 text-on-primary shadow-lg shadow-primary/20 transition-transform active:scale-90 dark:to-violet-400"
      >
        <Plus size={26} />
      </button>

      <AddWordsSheet open={addOpen} onClose={() => setAddOpen(false)} />

      <NewGroupSheet open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
