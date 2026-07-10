"use client";

import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Camera, Check, ClipboardPaste, Loader2, X } from "lucide-react";
import { db } from "@/lib/db";
import { addWordsFromText } from "@/lib/words";
import { splitWordList } from "@/lib/dictionary";
import { ocrSupported, recognizeGerman, type OcrProgress } from "@/lib/ocr";
import { extractWordsWithAi } from "@/lib/ai";
import type { Group } from "@/lib/types";
import { Button, Sheet, Textarea, cn } from "./ui";
import { CameraCapture } from "./camera-capture";

const EMPTY_GROUPS: Group[] = [];
// draft survives page reloads (iOS can kill the PWA while a picker is open)
const DRAFT_KEY = "vokabi.addWordsDraft";

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
  const [cameraOpen, setCameraOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // restore a draft after a reload; deferred so it is not a sync set in the effect
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const draft = sessionStorage.getItem(DRAFT_KEY);
        if (draft) setText((cur) => cur || draft);
      } catch {
        // storage unavailable, nothing to restore
      }
    }, 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    try {
      if (text) sessionStorage.setItem(DRAFT_KEY, text);
      else sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      // storage full or unavailable, draft just won't survive a reload
    }
  }, [text]);
  const groupsQuery = useLiveQuery(() => db.groups.orderBy("name").toArray(), []);
  const groups = groupsQuery ?? EMPTY_GROUPS;

  // opened without a target group (library page): preselect the first group so
  // adding works without an extra tap; runs once so a deliberate deselect sticks
  const autoSelected = useRef(false);
  useEffect(() => {
    if (autoSelected.current || defaultGroupId != null) return;
    const first = groupsQuery?.[0];
    if (first?.id == null) return;
    autoSelected.current = true;
    const t = setTimeout(() => {
      setSelectedGroups((cur) => (cur.length > 0 ? cur : [first.id!]));
    }, 0);
    return () => clearTimeout(t);
  }, [groupsQuery, defaultGroupId]);

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

  async function handleScan(source: File | HTMLCanvasElement) {
    setScanError(null);
    setScanState({ phase: "preparing" });
    try {
      const { rawText, lines } = await recognizeGerman(source, setScanState);
      let words: string[] | null = null;
      if (rawText) {
        // AI cleanup via Groq (configured in the back office); null means
        // unavailable or failed, then the heuristic lines are the fallback
        setScanState({ phase: "analyzing" });
        words = await extractWordsWithAi(rawText);
      }
      if (!words) words = lines;

      if (words.length === 0) {
        setScanError("No words found in that photo. Try a sharper, closer picture.");
      } else if (words.length > 20) {
        setScanError(
          "Your image contains more than 20 words or sentences. Please take a new picture with fewer items."
        );
      } else {
        setText((t) => (t ? t + "\n" + words.join("\n") : words.join("\n")));
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
      {text.length > 0 && (
        <div className="mt-1.5 flex items-center justify-end gap-1">
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
      <div className={cn("mt-2 grid gap-2", ocrSupported() ? "grid-cols-2" : "grid-cols-1")}>
        <Button variant="secondary" onClick={handlePasteFromClipboard}>
          <ClipboardPaste size={17} className="text-primary" /> Paste text
        </Button>
        {ocrSupported() && (
          <Button
            variant="secondary"
            onClick={() => {
              // in-app camera; the system camera app can get the PWA killed
              if (typeof navigator.mediaDevices?.getUserMedia === "function") {
                setCameraOpen(true);
              } else {
                fileRef.current?.click();
              }
            }}
            disabled={scanState != null}
          >
            {scanState != null ? (
              <>
                <Loader2 size={17} className="animate-spin" />
                {scanState.phase === "recognizing"
                  ? `Reading photo ${Math.round(scanState.progress * 100)}%`
                  : scanState.phase === "analyzing"
                    ? "Identifying words"
                    : "Preparing scanner"}
              </>
            ) : (
              <>
                <Camera size={17} className="text-primary" /> Scan photo
              </>
            )}
          </Button>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleScan(file);
        }}
      />
      {cameraOpen && (
        <CameraCapture
          onClose={() => setCameraOpen(false)}
          onCapture={(frame) => {
            setCameraOpen(false);
            void handleScan(frame);
          }}
          onPickGallery={() => {
            setCameraOpen(false);
            fileRef.current?.click();
          }}
        />
      )}
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
