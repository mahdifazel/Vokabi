"use client";

import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Check, ClipboardPaste, Loader2 } from "lucide-react";
import { db } from "@/lib/db";
import { addWordsFromText } from "@/lib/words";
import { splitWordList } from "@/lib/dictionary";
import type { Group } from "@/lib/types";
import { Button, Sheet, Textarea, cn } from "./ui";

const EMPTY_GROUPS: Group[] = [];

export function AddWordsSheet({
  open,
  onClose,
  defaultGroupId,
}: {
  open: boolean;
  onClose: () => void;
  defaultGroupId?: number;
}) {
  const [text, setText] = useState("");
  const [selectedGroups, setSelectedGroups] = useState<number[]>(
    defaultGroupId != null ? [defaultGroupId] : []
  );
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);
  const groupsQuery = useLiveQuery(() => db.groups.orderBy("name").toArray(), []);
  const groups = groupsQuery ?? EMPTY_GROUPS;
  const preselected = useRef(false);

  // a single group is the only possible target → select it without showing the picker;
  // with several groups the user must pick at least one themselves
  useEffect(() => {
    if (!open) {
      preselected.current = false;
      return;
    }
    if (preselected.current || defaultGroupId != null) return;
    const only = groups.length === 1 ? groups[0] : undefined;
    if (only?.id != null) {
      preselected.current = true;
      const t = setTimeout(
        () => setSelectedGroups((sel) => (sel.length === 0 ? [only.id!] : sel)),
        0
      );
      return () => clearTimeout(t);
    }
  }, [open, groups, defaultGroupId]);

  const count = splitWordList(text).length;

  async function handleAdd() {
    if (!text.trim() || busy) return;
    setBusy(true);
    const ids = await addWordsFromText(text, selectedGroups);
    setBusy(false);
    setDone(ids.length);
    setText("");
    setTimeout(() => {
      setDone(0);
      onClose();
    }, 900);
  }

  async function handlePasteFromClipboard() {
    try {
      const clip = await navigator.clipboard.readText();
      if (clip) setText((t) => (t ? t + "\n" + clip : clip));
    } catch {
      // clipboard permission denied — user can paste manually
    }
  }

  function toggleGroup(id: number) {
    setSelectedGroups((g) => (g.includes(id) ? g.filter((x) => x !== id) : [...g, id]));
  }

  return (
    <Sheet open={open} onClose={onClose} title="Add words">
      <p className="mb-3 text-sm font-semibold text-muted">
        Paste one word or a whole list — one per line. Articles like “das Haus” are detected;
        translations are added automatically.
      </p>
      <Textarea
        rows={6}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={"Haus\nBaum\nAuto\nFenster"}
        autoFocus
        lang="de"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
      />
      <div className="mt-2 flex items-center justify-between">
        <button
          onClick={handlePasteFromClipboard}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-2 py-1.5 text-sm font-bold text-primary active:opacity-70"
        >
          <ClipboardPaste size={16} /> Paste from clipboard
        </button>
        {count > 0 && (
          <span className="text-sm font-bold text-muted">
            {count} word{count === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {groups.length > 1 && (
        <div className="mt-4">
          <p className="mb-2 text-sm font-extrabold">Add to groups</p>
          <div className="flex flex-wrap gap-2">
            {groups.map((g) => (
              <button
                key={g.id}
                onClick={() => toggleGroup(g.id!)}
                aria-pressed={selectedGroups.includes(g.id!)}
                className={cn(
                  "cursor-pointer rounded-full px-4 py-2 text-sm font-bold transition-all active:scale-95",
                  selectedGroups.includes(g.id!)
                    ? "bg-primary text-on-primary"
                    : "bg-surface-2 text-muted"
                )}
              >
                {g.name}
              </button>
            ))}
          </div>
          {selectedGroups.length === 0 && (
            <p className="mt-2 text-xs font-semibold text-muted">Select at least one group</p>
          )}
        </div>
      )}

      <Button
        className="mt-5 w-full"
        size="lg"
        disabled={count === 0 || busy || (groups.length > 0 && selectedGroups.length === 0)}
        onClick={handleAdd}
      >
        {busy ? (
          <Loader2 size={18} className="animate-spin" />
        ) : done > 0 ? (
          <>
            <Check size={18} /> Added {done}!
          </>
        ) : (
          `Add ${count > 0 ? count : ""} word${count === 1 ? "" : "s"}`
        )}
      </Button>
    </Sheet>
  );
}
