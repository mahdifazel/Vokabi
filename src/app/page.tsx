"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useLiveQuery } from "dexie-react-hooks";
import {
  BookOpen,
  ChevronRight,
  FolderInput,
  FolderOpen,
  FolderPlus,
  Heart,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { db } from "@/lib/db";
import { deleteGroupAndDetachWords, deleteGroupAndWords, matchesQuery } from "@/lib/words";
import { GROUP_TILES, type Group } from "@/lib/types";
import { WordList } from "@/components/word-list";
import { AddWordsSheet } from "@/components/add-words-sheet";
import { NewGroupSheet } from "@/components/new-group-sheet";
import { MergeGroupSheet } from "@/components/merge-group-sheet";
import { useLongPress } from "@/components/use-long-press";
import { VokabiLogo } from "@/components/logo";
import { Button, Card, EmptyState, Input, Sheet, cn } from "@/components/ui";

function cardReveal(index: number) {
  return {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.25, delay: Math.min(index * 0.05, 0.4) },
  };
}

function GroupCard({
  group,
  count,
  index,
  onLongPress,
}: {
  group: Group;
  count: number;
  index: number;
  onLongPress: () => void;
}) {
  const longPress = useLongPress(onLongPress);
  return (
    <motion.div
      {...cardReveal(index)}
      {...longPress}
      className="select-none [-webkit-touch-callout:none]"
    >
      <Link href={`/groups/${group.id}`} className="cursor-pointer">
        <Card className="flex items-center gap-3 p-4 transition-transform active:scale-[0.98]">
          <div
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-2xl",
              GROUP_TILES[(group.id ?? 0) % GROUP_TILES.length]
            )}
          >
            <FolderOpen size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-extrabold">{group.name}</p>
            <p className="text-sm font-semibold text-muted">
              {count} word{count === 1 ? "" : "s"}
            </p>
          </div>
          <ChevronRight size={18} className="text-muted" />
        </Card>
      </Link>
    </motion.div>
  );
}

export default function LibraryPage() {
  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [actionGroup, setActionGroup] = useState<Group | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);

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

  const actionCount = actionGroup?.id != null ? (counts.get(actionGroup.id) ?? 0) : 0;

  async function removeActionGroup(withWords: boolean) {
    if (actionGroup?.id == null) return;
    if (withWords) await deleteGroupAndWords(actionGroup.id);
    else await deleteGroupAndDetachWords(actionGroup.id);
    setActionGroup(null);
    setConfirmDelete(false);
  }

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
          <WordList words={results} />
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

          {/* Groups, long press for delete/merge */}
          {groups?.map((g, i) => (
            <GroupCard
              key={g.id}
              group={g}
              count={counts.get(g.id!) ?? 0}
              index={i + 2}
              onLongPress={() => {
                setConfirmDelete(false);
                setActionGroup(g);
              }}
            />
          ))}
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

      {/* long-press group actions */}
      <Sheet
        open={actionGroup !== null && !mergeOpen}
        onClose={() => {
          setActionGroup(null);
          setConfirmDelete(false);
        }}
        title={actionGroup?.name ?? "Group"}
      >
        <div className="flex flex-col gap-2 pb-2">
          <Button
            variant="secondary"
            className="w-full justify-start"
            onClick={() => setMergeOpen(true)}
          >
            <FolderInput size={18} /> Merge into another group
          </Button>
          {!confirmDelete ? (
            <Button
              variant="destructive"
              className="w-full justify-start"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 size={18} /> Delete group
            </Button>
          ) : (
            <div className="rounded-2xl bg-destructive/10 p-4">
              <p className="mb-1 text-sm font-bold text-destructive">
                Delete “{actionGroup?.name}”?
              </p>
              {actionCount > 0 ? (
                <>
                  <p className="mb-3 text-xs font-semibold text-destructive/80">
                    You can keep its {actionCount} word{actionCount === 1 ? "" : "s"} in your
                    library, or delete them too. Words that are also in other groups are never
                    deleted.
                  </p>
                  <div className="flex flex-col gap-2">
                    <Button variant="secondary" className="w-full" onClick={() => removeActionGroup(false)}>
                      Delete group, keep words
                    </Button>
                    <Button className="w-full bg-destructive text-white" onClick={() => removeActionGroup(true)}>
                      Delete group and words
                    </Button>
                    <Button variant="ghost" className="w-full" onClick={() => setConfirmDelete(false)}>
                      Cancel
                    </Button>
                  </div>
                </>
              ) : (
                <div className="mt-2 flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setConfirmDelete(false)}>
                    Cancel
                  </Button>
                  <Button size="sm" className="bg-destructive text-white" onClick={() => removeActionGroup(false)}>
                    Delete
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </Sheet>

      <MergeGroupSheet
        group={actionGroup}
        open={mergeOpen}
        onClose={() => {
          setMergeOpen(false);
          setActionGroup(null);
        }}
      />
    </div>
  );
}
