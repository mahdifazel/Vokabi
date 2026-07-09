"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ArrowLeft,
  FolderOpen,
  MoreVertical,
  Pencil,
  Play,
  Plus,
  Shuffle,
  Trash2,
} from "lucide-react";
import { db } from "@/lib/db";
import { deleteGroupAndDetachWords } from "@/lib/words";
import { startPlaylist } from "@/lib/player";
import { updateSettings, useSettings } from "@/lib/settings";
import { WordRow } from "@/components/word-row";
import { AddWordsSheet } from "@/components/add-words-sheet";
import { Button, EmptyState, Input, Sheet } from "@/components/ui";

export default function GroupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const groupId = Number(id);
  const router = useRouter();
  const settings = useSettings();

  const [addOpen, setAddOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [newName, setNewName] = useState("");

  const group = useLiveQuery(() => db.groups.get(groupId), [groupId]);
  const words = useLiveQuery(
    () => db.words.where("groupIds").equals(groupId).sortBy("createdAt"),
    [groupId]
  );

  async function rename() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    await db.groups.update(groupId, { name: trimmed });
    setRenameOpen(false);
    setMenuOpen(false);
  }

  async function removeGroup() {
    await deleteGroupAndDetachWords(groupId);
    router.replace("/groups");
  }

  return (
    <div className="px-4 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <header className="mb-4 flex items-center gap-2">
        <button
          onClick={() => router.back()}
          aria-label="Back"
          className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-2xl text-muted active:bg-surface-2"
        >
          <ArrowLeft size={22} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-black tracking-tight">
            {group?.name ?? "…"}
          </h1>
          <p className="text-sm font-semibold text-muted">
            {words ? `${words.length} word${words.length === 1 ? "" : "s"}` : "…"}
          </p>
        </div>
        <button
          onClick={() => {
            setNewName(group?.name ?? "");
            setMenuOpen(true);
          }}
          aria-label="Group options"
          className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-2xl text-muted active:bg-surface-2"
        >
          <MoreVertical size={20} />
        </button>
      </header>

      {words && words.length > 0 && (
        <div className="mb-4 flex gap-2">
          <Button
            className="flex-1"
            onClick={() => startPlaylist(words, group?.name ?? "Group")}
          >
            <Play size={18} /> Play group
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
        </div>
      )}

      {words && words.length === 0 ? (
        <EmptyState
          icon={<FolderOpen size={28} />}
          title="This group is empty"
          hint="Add words and they'll show up here, ready to play in order."
          action={
            <Button onClick={() => setAddOpen(true)}>
              <Plus size={18} /> Add words
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-2.5">
          {words?.map((w, i) => (
            <WordRow key={w.id} word={w} index={i} />
          ))}
        </div>
      )}

      {words && words.length > 0 && (
        <button
          onClick={() => setAddOpen(true)}
          aria-label="Add words to group"
          className="fixed right-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-30 flex h-14 w-14 cursor-pointer items-center justify-center rounded-2xl bg-primary text-on-primary shadow-xl transition-transform active:scale-90"
        >
          <Plus size={26} />
        </button>
      )}

      <AddWordsSheet open={addOpen} onClose={() => setAddOpen(false)} defaultGroupId={groupId} />

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title={group?.name ?? "Group"}>
        <div className="flex flex-col gap-2 pb-2">
          <Button
            variant="secondary"
            className="w-full justify-start"
            onClick={() => {
              setMenuOpen(false);
              setRenameOpen(true);
            }}
          >
            <Pencil size={18} /> Rename group
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
              <p className="mb-3 text-sm font-bold text-destructive">
                Delete “{group?.name}”? Words stay in your library. Only the group is removed.
              </p>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setConfirmDelete(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="bg-destructive text-white"
                  onClick={removeGroup}
                >
                  Delete
                </Button>
              </div>
            </div>
          )}
        </div>
      </Sheet>

      <Sheet open={renameOpen} onClose={() => setRenameOpen(false)} title="Rename group">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          autoFocus
          onKeyDown={(e) => e.key === "Enter" && rename()}
        />
        <Button className="mt-4 w-full" size="lg" disabled={!newName.trim()} onClick={rename}>
          Save
        </Button>
      </Sheet>
    </div>
  );
}
