"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Pause, Play, SkipBack, SkipForward, X } from "lucide-react";
import {
  nextWord,
  pausePlayer,
  prevWord,
  resumePlayer,
  stopPlayer,
  usePlayer,
} from "@/lib/player";
import { ARTICLE_COLORS } from "@/lib/types";
import { cn } from "./ui";

export function MiniPlayer() {
  const player = usePlayer();
  const word = player.words[Math.min(player.index, player.words.length - 1)];

  return (
    <AnimatePresence>
      {player.active && word && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", damping: 28, stiffness: 320 }}
          className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 mx-auto max-w-lg"
        >
          <div className="relative rounded-3xl border border-border bg-surface px-5 py-6 shadow-xl">
            <button
              onClick={stopPlayer}
              aria-label="Stop playback"
              className="absolute right-3 top-3 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-muted active:scale-95 active:text-foreground"
            >
              <X size={18} />
            </button>
            <div className="px-8 text-center">
              <p className="break-words text-3xl font-extrabold leading-snug">
                {word.article && (
                  <span className={cn("mr-1.5", ARTICLE_COLORS[word.article])}>{word.article}</span>
                )}
                {word.german}
              </p>
              {word.english && (
                <p className="mt-1 break-words text-sm font-semibold text-muted">{word.english}</p>
              )}
              <p className="mt-1.5 text-xs font-semibold text-muted">
                {player.title} · {player.index + 1}/{player.words.length}
              </p>
            </div>
            <div className="mt-4 flex items-center justify-center gap-3">
              <button
                onClick={prevWord}
                aria-label="Previous word"
                className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-muted active:scale-95 active:text-foreground"
              >
                <SkipBack size={18} />
              </button>
              <button
                onClick={player.playing ? pausePlayer : resumePlayer}
                aria-label={player.playing ? "Pause" : "Play"}
                className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-full bg-primary text-on-primary shadow-md active:scale-95"
              >
                {player.playing ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
              </button>
              <button
                onClick={nextWord}
                aria-label="Next word"
                className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-muted active:scale-95 active:text-foreground"
              >
                <SkipForward size={18} />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
