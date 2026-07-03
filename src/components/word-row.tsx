"use client";

import { useRouter } from "next/navigation";
import { Heart, Loader2, Volume2 } from "lucide-react";
import { motion } from "framer-motion";
import type { Word } from "@/lib/types";
import { ARTICLE_BG } from "@/lib/types";
import { playWordOnce, usePlayer } from "@/lib/player";
import { toggleFavorite } from "@/lib/words";
import { cn } from "./ui";

export function WordRow({
  word,
  highlight = false,
  index = 0,
}: {
  word: Word;
  highlight?: boolean;
  index?: number;
}) {
  const router = useRouter();
  const player = usePlayer();
  const isCurrent =
    highlight ||
    (player.active && player.words[player.index]?.id != null && player.words[player.index].id === word.id);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: Math.min(index * 0.03, 0.3) }}
      className={cn(
        "flex items-center gap-3 rounded-3xl border bg-surface p-3 pl-4 shadow-[0_1px_3px_rgb(0_0_0/0.04)] transition-colors",
        isCurrent ? "border-primary ring-2 ring-primary/30" : "border-border"
      )}
    >
      <button
        className="min-w-0 flex-1 cursor-pointer text-left"
        onClick={() => router.push(`/word/${word.id}`)}
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
            word.english || "no translation found"
          )}
        </p>
      </button>
      <button
        onClick={() => word.id != null && toggleFavorite(word)}
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
        aria-label={`Play pronunciation of ${word.german}`}
        className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-2xl bg-primary-soft text-primary transition-all active:scale-90"
      >
        <Volume2 size={20} />
      </button>
    </motion.div>
  );
}
