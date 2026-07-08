"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  BookOpen,
  FolderPlus,
  Heart,
  MoreVertical,
  Pencil,
  Play,
  Plus,
  Search,
  Shuffle,
  Trash2,
  X,
} from "lucide-react";
import { db } from "@/lib/db";
import { deleteGroupAndDetachWords, matchesQuery } from "@/lib/words";
import { startPlaylist } from "@/lib/player";
import { updateSettings, useSettings } from "@/lib/settings";
import type { LearnSource } from "@/lib/learn";
import { WordRow } from "@/components/word-row";
import { AddWordsSheet } from "@/components/add-words-sheet";
import { VokabiLogo } from "@/components/logo";
import { Button, EmptyState, Input, Sheet, cn } from "@/components/ui";

export default function LibraryPage() {
  const settings = useSettings();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<LearnSource>({ kind: "all" });
  const [addOpen, setAddOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const words = useLiveQuery(() => db.words.orderBy("createdAt").reverse().toArray(), []);
  const groups = useLiveQuery(() => db.groups.orderBy("name").toArray(), []) ?? [];

  const favCount = useMemo(() => (words ?? []).filter((w) => w.favorite).length, [words]);
  const groupCounts = useMemo(() => {
    const map = new Map<number, number>();
    for (const w of words ?? []) {
      for (const g of w.groupIds) map.set(g, (map.get(g) ?? 0) + 1);
    }
    return map;
  }, [words]);

  const selectedGroup =
    filter.kind === "group" ? groups.find((g) => g.id === filter.id) : undefined;

  const filtered = useMemo(() => {
    let list = words ?? [];
    if (filter.kind === "fav") list = list.filter((w) => w.favorite);
    if (filter.kind === "group") {
      list = list.filter((w) => filter.id != null && w.groupIds.includes(filter.id));
    }
    return list.filter((w) => matchesQuery(w, query));
  }, [words, filter, query]);

  const playTitle =
    filter.kind === "all" ? "All words" : filter.kind === "fav" ? "Favorites" : (selectedGroup?.name ?? "Group");

  async function createGroup() {
    const name = groupName.trim();
    if (!name) return;
    const id = (await db.groups.add({ name, createdAt: Date.now() })) as number;
    setGroupName("");
    setCreateOpen(false);
    setFilter({ kind: "group", id });
  }

  async function renameGroup() {
    const name = groupName.trim();
    if (!name || filter.kind !== "group") return;
    await db.groups.update(filter.id, { name });
    setManageOpen(false);
  }

  async function removeGroup() {
    if (filter.kind !== "group") return;
    await deleteGroupAndDetachWords(filter.id);
    setManageOpen(false);
    setConfirmDelete(false);
    setFilter({ kind: "all" });
  }

  const isSelected = (f: LearnSource) =>
    f.kind === filter.kind && (f.kind !== "group" || (filter.kind === "group" && f.id === filter.id));

  return (
    <div className="px-4 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <header className="mb-4 flex items-center gap-3">
        <VokabiLogo size={40} />
        <div className="flex-1">
          <h1 className="text-2xl font-black tracking-tight">Vokabi</h1>
          <p className="text-sm font-semibold text-muted">
            {words ? `${words.length} word${words.length === 1 ? "" : "s"}` : "…"}
          </p>
        </div>
      </header>

      {/* search */}
      <div className="relative mb-3">
        <Search size={18} className="absolute top-1/2 left-4 -translate-y-1/2 text-muted" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search German, English or article…"
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

      {/* group chips */}
      <div className="scrollbar-none -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
        <Chip
          label={`All · ${words?.length ?? 0}`}
          selected={isSelected({ kind: "all" })}
          onClick={() => setFilter({ kind: "all" })}
        />
        {favCount > 0 && (
          <Chip
            label={`♥ ${favCount}`}
            selected={isSelected({ kind: "fav" })}
            onClick={() => setFilter({ kind: "fav" })}
          />
        )}
        {groups.map((g) => (
          <Chip
            key={g.id}
            label={`${g.name} · ${groupCounts.get(g.id!) ?? 0}`}
            selected={isSelected({ kind: "group", id: g.id! })}
            onClick={() => setFilter({ kind: "group", id: g.id! })}
          />
        ))}
        <button
          onClick={() => {
            setGroupName("");
            setCreateOpen(true);
          }}
          aria-label="New group"
          className="flex h-9 shrink-0 cursor-pointer items-center gap-1 rounded-full bg-surface-2 px-3.5 text-sm font-bold whitespace-nowrap text-muted active:scale-95"
        >
          <FolderPlus size={15} /> New
        </button>
      </div>

      {/* play row */}
      {filtered.length > 0 && (
        <div className="mb-4 flex gap-2">
          <Button className="flex-1" onClick={() => startPlaylist(filtered, playTitle)}>
            <Play size={18} /> Play {playTitle.toLowerCase()}
          </Button>
          <Button
            variant={settings.shuffle ? "accent" : "secondary"}
            size="icon"
            aria-label={settings.shuffle ? "Shuffle on" : "Shuffle off"}
            aria-pressed={settings.shuffle}
            onClick={() => updateSettings({ shuffle: !settings.shuffle })}
          >
            <Shuffle size={18} />
          </Button>
          {selectedGroup && (
            <Button
              variant="secondary"
              size="icon"
              aria-label="Group options"
              onClick={() => {
                setGroupName(selectedGroup.name);
                setConfirmDelete(false);
                setManageOpen(true);
              }}
            >
              <MoreVertical size={18} />
            </Button>
          )}
        </div>
      )}

      {/* word list */}
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
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={filter.kind === "fav" ? <Heart size={28} /> : <Search size={28} />}
          title={query ? "Nothing found" : filter.kind === "fav" ? "No favorites yet" : "This group is empty"}
          hint={
            query
              ? `No words match “${query}”.`
              : filter.kind === "fav"
                ? "Tap the heart on any word to collect it here."
                : "Add words to this group with the + button."
          }
        />
      ) : (
        <div className="flex flex-col gap-2.5">
          {filtered.map((w, i) => (
            <WordRow key={w.id} word={w} index={i} />
          ))}
        </div>
      )}

      {/* add words FAB — adds into the selected group */}
      <button
        onClick={() => setAddOpen(true)}
        aria-label="Add words"
        className="fixed right-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-30 flex h-14 w-14 cursor-pointer items-center justify-center rounded-2xl bg-primary text-on-primary shadow-xl transition-transform active:scale-90"
      >
        <Plus size={26} />
      </button>

      <AddWordsSheet
        key={filter.kind === "group" ? filter.id : "none"}
        open={addOpen}
        onClose={() => setAddOpen(false)}
        defaultGroupId={filter.kind === "group" ? filter.id : undefined}
      />

      {/* new group */}
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

      {/* manage selected group */}
      <Sheet
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        title={selectedGroup?.name ?? "Group"}
      >
        <div className="flex flex-col gap-3 pb-2">
          <label className="text-sm font-extrabold">
            Rename
            <div className="mt-1 flex gap-2">
              <Input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && renameGroup()}
              />
              <Button disabled={!groupName.trim()} onClick={renameGroup}>
                <Pencil size={16} /> Save
              </Button>
            </div>
          </label>
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
              <p className="mb-3 text-sm font-bold text-destructive">
                Delete “{selectedGroup?.name}”? Words stay in your library — only the group is
                removed.
              </p>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setConfirmDelete(false)}>
                  Cancel
                </Button>
                <Button size="sm" className="bg-destructive text-white" onClick={removeGroup}>
                  Delete
                </Button>
              </div>
            </div>
          )}
        </div>
      </Sheet>
    </div>
  );
}

function Chip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "h-9 shrink-0 cursor-pointer rounded-full px-3.5 text-sm font-bold whitespace-nowrap transition-all active:scale-95",
        selected ? "bg-primary text-on-primary" : "bg-surface-2 text-muted"
      )}
    >
      {label}
    </button>
  );
}
