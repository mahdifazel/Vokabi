"use client";

import { useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Camera, Check, ClipboardPaste, Loader2, X } from "lucide-react";
import { db } from "@/lib/db";
import { addWordsFromText } from "@/lib/words";
import { splitWordList } from "@/lib/dictionary";
import { ocrSupported, recognizeGermanLines, type OcrProgress } from "@/lib/ocr";
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
  const [scanState, setScanState] = useState<OcrProgress | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const groupsQuery = useLiveQuery(() => db.groups.orderBy("name").toArray(), []);
  const groups = groupsQuery ?? EMPTY_GROUPS;

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
      // clipboard permission denied, user can paste manually
    }
  }

  async function handleScanFile(file: File) {
    setScanError(null);
    setScanState({ phase: "preparing" });
    try {
      const lines = await recognizeGermanLines(file, setScanState);
      if (lines.length === 0) {
        setScanError("No words found in that photo. Try a sharper, closer picture.");
      } else if (lines.length > 20) {
        setScanError(
          "Your image contains more than 20 words or sentences. Please take a new picture with fewer items."
        );
      } else {
        setText((t) => (t ? t + "\n" + lines.join("\n") : lines.join("\n")));
      }
    } catch {
      setScanError("Could not read that photo. Please try again.");
    } finally {
      setScanState(null);
      // allow picking the same photo again
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function toggleGroup(id: number) {
    setSelectedGroups((g) => (g.includes(id) ? g.filter((x) => x !== id) : [...g, id]));
  }

  return (
    <Sheet open={open} onClose={onClose} title="Add words">
      <p className="mb-3 text-sm font-semibold text-muted">
        Paste one word or a whole list, one per line. Articles like “das Haus” are detected;
        translations are added automatically.
      </p>
      <Textarea
        rows={6}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setScanError(null);
        }}
        placeholder={"Haus\nBaum\nAuto\nFenster"}
        autoFocus
        lang="de"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
      />
      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            onClick={handlePasteFromClipboard}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-2 py-1.5 text-sm font-bold text-primary active:opacity-70"
          >
            <ClipboardPaste size={16} /> Paste
          </button>
          {ocrSupported() && (
            <button
              onClick={() => fileRef.current?.click()}
              disabled={scanState != null}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-2 py-1.5 text-sm font-bold text-primary active:opacity-70 disabled:opacity-50"
            >
              {scanState != null ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  {scanState.phase === "recognizing"
                    ? `Reading photo ${Math.round(scanState.progress * 100)}%`
                    : "Preparing scanner"}
                </>
              ) : (
                <>
                  <Camera size={16} /> Scan a photo
                </>
              )}
            </button>
          )}
        </div>
        {text.length > 0 && (
          <div className="flex items-center gap-1">
            {count > 0 && (
              <span className="text-sm font-bold text-muted">
                {count} word{count === 1 ? "" : "s"}
              </span>
            )}
            <button
              onClick={() => {
                setText("");
                setScanError(null);
              }}
              aria-label="Clear text"
              className="inline-flex cursor-pointer items-center rounded-xl p-1.5 text-muted active:opacity-70"
            >
              <X size={18} />
            </button>
          </div>
        )}
      </div>
      {/* no capture attribute: iOS and Android then offer both camera and gallery */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleScanFile(file);
        }}
      />
      {scanError && (
        <p className="mt-2 text-sm font-semibold text-destructive">{scanError}</p>
      )}

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
        // with a single group there is no picker, addWordsFromText targets it automatically
        disabled={count === 0 || busy || (groups.length > 1 && selectedGroups.length === 0)}
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
