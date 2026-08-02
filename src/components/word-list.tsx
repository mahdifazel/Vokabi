"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { AnimatePresence, motion } from "framer-motion";
import { FolderInput, FolderOpen, Trash2, X } from "lucide-react";
import { db } from "@/lib/db";
import type { Word } from "@/lib/types";
import { GROUP_TILES } from "@/lib/types";
import { deleteWords, moveWordsToGroup } from "@/lib/words";
import { WordRow } from "./word-row";
import { Button, Sheet, cn } from "./ui";

/**
 * Word list with long-press multi-select: hold a row to enter selection mode,
 * tap rows to toggle, then delete or move the selection from the top bar.
 * Exits via the X button, Escape, the mobile back button (a history entry is
 * pushed on enter), or deselecting the last row.
 */
export function WordList({
  words,
  fromGroupId,
}: {
  words: Word[];
  fromGroupId?: number;
}) {
  const [selected, setSelected] = useState<ReadonlySet<number>>(() => new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const selecting = selected.size > 0;
  const sheetOpen = confirmOpen || moveOpen;

  const groups = useLiveQuery(() => db.groups.orderBy("name").toArray(), []);

  // Back-button support: entering selection mode pushes a history entry so
  // the first "back" clears the selection instead of leaving the page.
  const pushedRef = useRef(false);
  const popHistoryEntry = useCallback(() => {
    if (pushedRef.current) {
      pushedRef.current = false;
      window.history.back();
    }
  }, []);

  const exit = useCallback(() => {
    setSelected(new Set());
    setConfirmOpen(false);
    setMoveOpen(false);
    popHistoryEntry();
  }, [popHistoryEntry]);

  useEffect(() => {
    if (!selecting) return;
    const onKey = (e: KeyboardEvent) => {
      // let an open sheet consume Escape first
      if (e.key === "Escape" && !sheetOpen) exit();
    };
    const onPop = () => {
      pushedRef.current = false;
      setSelected(new Set());
      setConfirmOpen(false);
      setMoveOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("popstate", onPop);
    };
  }, [selecting, sheetOpen, exit]);

  function enter(id: number) {
    setSelected(new Set([id]));
    if (!pushedRef.current) {
      window.history.pushState({ vokabiSelect: true }, "");
      pushedRef.current = true;
    }
  }

  function toggle(id: number) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    if (next.size === 0) exit();
    else setSelected(next);
  }

  async function removeSelected() {
    const ids = [...selected];
    setConfirmOpen(false);
    await deleteWords(ids);
    exit();
  }

  async function moveSelected(targetGroupId: number) {
    const ids = [...selected];
    setMoveOpen(false);
    await moveWordsToGroup(ids, targetGroupId, fromGroupId);
    exit();
  }

  const n = selected.size;

  return (
    <>
      <div className="flex flex-col gap-2.5">
        {words.map((w, i) => (
          <WordRow
            key={w.id}
            word={w}
            index={i}
            selectionMode={selecting}
            selected={w.id != null && selected.has(w.id)}
            onLongPress={() => w.id != null && enter(w.id)}
            onToggleSelect={() => w.id != null && toggle(w.id)}
          />
        ))}
      </div>

      <AnimatePresence>
        {selecting && (
          <motion.div
            initial={{ y: -72, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -72, opacity: 0 }}
            transition={{ type: "spring", damping: 30, stiffness: 400 }}
            className="fixed inset-x-0 top-0 z-40"
          >
            <div className="mx-auto w-full max-w-lg px-4 pt-[max(0.75rem,env(safe-area-inset-top))] md:max-w-2xl lg:max-w-3xl">
              <div
                role="toolbar"
                aria-label="Selection actions"
                className="flex items-center gap-1 rounded-3xl border border-border bg-surface p-2 shadow-[0_4px_20px_rgb(0_0_0/0.15)]"
              >
                <button
                  onClick={exit}
                  aria-label="Exit selection mode"
                  className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-2xl text-muted active:bg-surface-2"
                >
                  <X size={20} />
                </button>
                <p aria-live="polite" className="flex-1 text-[15px] font-extrabold">
                  {n} selected
                </p>
                <button
                  onClick={() => setMoveOpen(true)}
                  aria-label="Move selected words to a group"
                  className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-2xl text-primary active:bg-surface-2"
                >
                  <FolderInput size={20} />
                </button>
                <button
                  onClick={() => setConfirmOpen(true)}
                  aria-label="Delete selected words"
                  className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-2xl text-destructive active:bg-surface-2"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Sheet open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Delete words">
        <p className="mb-4 text-sm font-semibold text-muted">
          Delete {n} word{n === 1 ? "" : "s"} from your library? Words that are in
          other groups are deleted there too. This can&apos;t be undone.
        </p>
        <div className="flex flex-col gap-2 pb-2">
          <Button className="w-full bg-destructive text-white" size="lg" onClick={removeSelected}>
            <Trash2 size={18} /> Delete {n} word{n === 1 ? "" : "s"}
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => setConfirmOpen(false)}>
            Cancel
          </Button>
        </div>
      </Sheet>

      <Sheet open={moveOpen} onClose={() => setMoveOpen(false)} title="Move to group">
        <div className="flex flex-col gap-2 pb-2">
          {groups?.map((g) => {
            const isSource = g.id === fromGroupId;
            return (
              <button
                key={g.id}
                disabled={isSource}
                onClick={() => g.id != null && moveSelected(g.id)}
                className={cn(
                  "flex items-center gap-3 rounded-2xl border border-border bg-surface p-3 pl-4 text-left transition-colors",
                  isSource ? "opacity-50" : "cursor-pointer active:bg-surface-2"
                )}
              >
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl",
                    GROUP_TILES[(g.id ?? 0) % GROUP_TILES.length]
                  )}
                >
                  <FolderOpen size={18} />
                </div>
                <span className="min-w-0 flex-1 truncate font-extrabold">{g.name}</span>
                {isSource && (
                  <span className="text-xs font-semibold text-muted">current group</span>
                )}
              </button>
            );
          })}
        </div>
      </Sheet>
    </>
  );
}
