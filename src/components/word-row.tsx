"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Check, Heart, Loader2, Volume2 } from "lucide-react";
import { motion } from "framer-motion";
import type { Word } from "@/lib/types";
import { ARTICLE_BG } from "@/lib/types";
import { playWordOnce, usePlayer } from "@/lib/player";
import { useSettings } from "@/lib/settings";
import { toggleFavorite, wordMeaning } from "@/lib/words";
import { cn } from "./ui";

const LONG_PRESS_MS = 450;
const MOVE_SLOP_PX = 10;

export function WordRow({
  word,
  highlight = false,
  index = 0,
  selectionMode = false,
  selected = false,
  onLongPress,
  onToggleSelect,
}: {
  word: Word;
  highlight?: boolean;
  index?: number;
  selectionMode?: boolean;
  selected?: boolean;
  onLongPress?: () => void;
  onToggleSelect?: () => void;
}) {
  const router = useRouter();
  const player = usePlayer();
  const { meaningLanguage } = useSettings();
  const isCurrent =
    highlight ||
    (player.active && player.words[player.index]?.id != null && player.words[player.index].id === word.id);

  const timerRef = useRef<number | null>(null);
  const startRef = useRef({ x: 0, y: 0 });
  const touchRef = useRef(false);
  const suppressClickRef = useRef(false);

  function cancelLongPress() {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  useEffect(() => cancelLongPress, []);

  function armLongPress(e: React.PointerEvent) {
    if (!onLongPress || selectionMode || e.button !== 0) return;
    touchRef.current = e.pointerType !== "mouse";
    startRef.current = { x: e.clientX, y: e.clientY };
    cancelLongPress();
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      suppressClickRef.current = true;
      navigator.vibrate?.(15);
      onLongPress();
    }, LONG_PRESS_MS);
  }

  function trackPointer(e: React.PointerEvent) {
    if (timerRef.current == null) return;
    const dx = e.clientX - startRef.current.x;
    const dy = e.clientY - startRef.current.y;
    if (Math.hypot(dx, dy) > MOVE_SLOP_PX) cancelLongPress();
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: Math.min(index * 0.03, 0.3) }}
      onPointerDown={armLongPress}
      onPointerMove={trackPointer}
      onPointerUp={cancelLongPress}
      onPointerCancel={cancelLongPress}
      onClickCapture={(e) => {
        if (suppressClickRef.current) {
          suppressClickRef.current = false;
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      onContextMenu={(e) => {
        if (touchRef.current && onLongPress) e.preventDefault();
      }}
      className={cn(
        "relative flex select-none items-center gap-3 rounded-3xl border bg-surface p-3 pl-4 shadow-[0_1px_2px_rgb(0_0_0/0.04),0_4px_14px_rgb(0_0_0/0.05)] transition-colors [-webkit-touch-callout:none]",
        selected
          ? "border-primary bg-primary-soft ring-2 ring-primary/30"
          : isCurrent
            ? "border-primary ring-2 ring-primary/30"
            : "border-border"
      )}
    >
      {selectionMode && (
        <span
          aria-hidden
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
            selected
              ? "border-primary bg-primary text-on-primary"
              : "border-border text-transparent"
          )}
        >
          <Check size={14} strokeWidth={3.5} />
        </span>
      )}
      <button
        className="min-w-0 flex-1 cursor-pointer text-left"
        onClick={() => router.push(`/word/${word.id}`)}
        tabIndex={selectionMode ? -1 : undefined}
        aria-label={`Open details for ${word.german}`}
      >
        <div className="flex items-center gap-2">
          {word.article && (
            <span
              className={cn(
                "rounded-lg px-1.5 py-0.5 text-xs font-extrabold",
                ARTICLE_BG[word.article]
              )}
            >
              {word.article}
            </span>
          )}
          <span className="truncate text-[16px] font-extrabold">{word.german}</span>
        </div>
        <p className="mt-0.5 truncate text-sm font-semibold text-muted">
          {word.status === "pending" ? (
            <span className="inline-flex items-center gap-1">
              <Loader2 size={12} className="animate-spin" /> looking up…
            </span>
          ) : (
            wordMeaning(word, meaningLanguage) || "no translation found"
          )}
        </p>
      </button>
      <button
        onClick={() => word.id != null && toggleFavorite(word)}
        tabIndex={selectionMode ? -1 : undefined}
        aria-label={word.favorite ? "Remove from favorites" : "Add to favorites"}
        aria-pressed={!!word.favorite}
        className={cn(
          "flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-2xl transition-all active:scale-90",
          word.favorite ? "text-rose-500" : "text-muted/60 active:text-rose-400"
        )}
      >
        <Heart size={20} fill={word.favorite ? "currentColor" : "none"} />
      </button>
      <button
        onClick={() => void playWordOnce(word)}
        tabIndex={selectionMode ? -1 : undefined}
        aria-label={`Play pronunciation of ${word.german}`}
        className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-2xl bg-primary-soft text-primary transition-all active:scale-90"
      >
        <Volume2 size={20} />
      </button>
      {selectionMode && (
        <button
          onClick={() => onToggleSelect?.()}
          aria-pressed={selected}
          aria-label={selected ? `Deselect ${word.german}` : `Select ${word.german}`}
          className="absolute inset-0 z-10 cursor-pointer rounded-3xl"
        />
      )}
    </motion.div>
  );
}
