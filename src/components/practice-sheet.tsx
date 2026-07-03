"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Mic, Square, Volume2 } from "lucide-react";
import type { Word } from "@/lib/types";
import {
  charMatches,
  listenAndScore,
  practiceSupported,
  stopPractice,
  type PracticeResult,
} from "@/lib/speech";
import { playWordOnce, wordSpokenText } from "@/lib/player";
import { getSettings } from "@/lib/settings";
import { Button, Sheet, cn } from "./ui";

const RATING_META = {
  excellent: { label: "Excellent!", color: "text-accent", bg: "bg-accent-soft" },
  good: { label: "Good — almost there", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-500/15" },
  "needs-improvement": {
    label: "Needs improvement",
    color: "text-destructive",
    bg: "bg-destructive/10",
  },
} as const;

export function PracticeSheet({
  word,
  open,
  onClose,
}: {
  word: Word;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title="Practice pronunciation">
      {open && <PracticeBody word={word} />}
    </Sheet>
  );
}

function PracticeBody({ word }: { word: Word }) {
  const [listening, setListening] = useState(false);
  const [result, setResult] = useState<PracticeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const supported = practiceSupported();
  const target = wordSpokenText(word, getSettings().readArticle);

  // stop any in-flight recognition when the sheet closes/unmounts
  useEffect(() => () => stopPractice(), []);

  async function handleListen() {
    if (listening) {
      stopPractice();
      setListening(false);
      return;
    }
    setResult(null);
    setError(null);
    setListening(true);
    try {
      const r = await listenAndScore(target);
      setResult(r);
    } catch (e) {
      const code = e instanceof Error ? e.message : "unknown";
      setError(
        code === "no-speech"
          ? "I didn't hear anything — try again and speak clearly."
          : code === "not-allowed" || code === "service-not-allowed"
            ? "Microphone access was denied. Allow it in your browser settings."
            : code === "not-supported"
              ? "Speech recognition isn't supported in this browser."
              : "Something went wrong — please try again."
      );
    } finally {
      setListening(false);
    }
  }

  const matches = result ? charMatches(target, result.transcript) : [];
  const normalizedTarget = target.replace(/^(der|die|das)\s+/i, "");
  const meta = result ? RATING_META[result.rating] : null;

  return (
    <div className="flex flex-col items-center pb-4 text-center">
        <p className="text-3xl font-black tracking-tight">
          {word.article && <span className="text-muted">{word.article} </span>}
          {result ? (
            <span>
              {normalizedTarget.split("").map((ch, i) => (
                <span
                  key={i}
                  className={cn(
                    matches[i] === false && /[a-zäöüß]/i.test(ch)
                      ? "text-destructive underline decoration-2 underline-offset-4"
                      : undefined
                  )}
                >
                  {ch}
                </span>
              ))}
            </span>
          ) : (
            normalizedTarget
          )}
        </p>
        {word.ipa && <p className="mt-1 text-sm font-semibold text-muted">{word.ipa}</p>}

        <button
          onClick={() => void playWordOnce(word)}
          className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary-soft px-4 py-2 text-sm font-bold text-primary active:scale-95"
        >
          <Volume2 size={16} /> Hear it first
        </button>

        {!supported && (
          <p className="mt-6 rounded-2xl bg-surface-2 p-4 text-sm font-semibold text-muted">
            Speech recognition isn&apos;t available in this browser. Try Chrome on Android for
            pronunciation feedback.
          </p>
        )}

        {supported && (
          <motion.button
            onClick={handleListen}
            whileTap={{ scale: 0.92 }}
            aria-label={listening ? "Stop listening" : "Start speaking"}
            className={cn(
              "mt-8 flex h-24 w-24 cursor-pointer items-center justify-center rounded-full shadow-lg transition-colors",
              listening ? "bg-destructive text-white" : "bg-primary text-on-primary"
            )}
          >
            {listening ? (
              <>
                <motion.span
                  className="absolute h-24 w-24 rounded-full bg-destructive/40"
                  animate={{ scale: [1, 1.5], opacity: [0.6, 0] }}
                  transition={{ repeat: Infinity, duration: 1.2 }}
                />
                <Square size={30} fill="currentColor" />
              </>
            ) : (
              <Mic size={34} />
            )}
          </motion.button>
        )}
        <p className="mt-3 text-sm font-semibold text-muted">
          {listening ? "Listening… say the word now" : "Tap the mic and say the word"}
        </p>

        {error && (
          <p className="mt-4 w-full rounded-2xl bg-destructive/10 p-3 text-sm font-bold text-destructive">
            {error}
          </p>
        )}

        {result && meta && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn("mt-5 w-full rounded-2xl p-4", meta.bg)}
          >
            <p className={cn("text-lg font-black", meta.color)}>{meta.label}</p>
            <p className="mt-1 text-sm font-semibold text-muted">
              Heard: “{result.transcript}” · {Math.round(result.similarity * 100)}% match
            </p>
            {result.rating !== "excellent" && (
              <Button variant="secondary" size="sm" className="mt-3" onClick={handleListen}>
                Try again
              </Button>
            )}
          </motion.div>
        )}
    </div>
  );
}
