"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { BookOpen, Play, Plus, Search, X } from "lucide-react";
import { db } from "@/lib/db";
import { matchesQuery } from "@/lib/words";
import { startPlaylist } from "@/lib/player";
import { WordRow } from "@/components/word-row";
import { AddWordsSheet } from "@/components/add-words-sheet";
import { Button, EmptyState, Input } from "@/components/ui";
import { VokabiLogo } from "@/components/logo";

export default function WordsPage() {
  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  const words = useLiveQuery(
    () => db.words.orderBy("createdAt").reverse().toArray(),
    []
  );

  const filtered = useMemo(
    () => (words ?? []).filter((w) => matchesQuery(w, query)),
    [words, query]
  );

  return (
    <div className="px-4 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <header className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <VokabiLogo size={40} />
          <div>
            <h1 className="text-2xl font-black tracking-tight">Vokabi</h1>
            <p className="text-sm font-semibold text-muted">
              {words ? `${words.length} word${words.length === 1 ? "" : "s"}` : "…"}
            </p>
          </div>
        </div>
        {filtered.length > 0 && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => startPlaylist(filtered, query ? "Search results" : "All words")}
          >
            <Play size={16} /> Play all
          </Button>
        )}
      </header>

      <div className="relative mb-4">
        <Search size={18} className="absolute top-1/2 left-4 -translate-y-1/2 text-muted" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search German, English or article…"
          className="pl-11 pr-10"
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

      {words && words.length === 0 ? (
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
      ) : filtered.length === 0 && query ? (
        <EmptyState
          icon={<Search size={28} />}
          title="Nothing found"
          hint={`No words match “${query}”.`}
        />
      ) : (
        <div className="flex flex-col gap-2.5">
          {filtered.map((w, i) => (
            <WordRow key={w.id} word={w} index={i} />
          ))}
        </div>
      )}

      {/* Floating add button */}
      <button
        onClick={() => setAddOpen(true)}
        aria-label="Add words"
        className="fixed right-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-30 flex h-14 w-14 cursor-pointer items-center justify-center rounded-2xl bg-primary text-on-primary shadow-xl transition-transform active:scale-90"
      >
        <Plus size={26} />
      </button>

      <AddWordsSheet open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}
