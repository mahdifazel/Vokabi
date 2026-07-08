"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Check, RotateCcw, Volume2, X } from "lucide-react";
import { loadSourceWords, parseSource, shuffle, sourceLabel } from "@/lib/learn";
import { playWordOnce } from "@/lib/player";
import { ARTICLE_BG, type Word } from "@/lib/types";
import { Button, cn } from "@/components/ui";

function FlashcardsContent() {
  const router = useRouter();
  const params = useSearchParams();
  const src = parseSource(params.get("src"));

  const [deck, setDeck] = useState<Word[] | null>(null);
  const [label, setLabel] = useState("");
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState<Word[]>([]);
  const [unknown, setUnknown] = useState<Word[]>([]);
  const [exitDir, setExitDir] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadSourceWords(src), sourceLabel(src)]).then(([words, l]) => {
      if (cancelled) return;
      setDeck(shuffle(words));
      setLabel(l);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const word = deck?.[index];
  const finished = deck !== null && index >= deck.length;

  function advance(gotIt: boolean) {
    if (!word) return;
    setExitDir(gotIt ? 1 : -1);
    if (gotIt) setKnown((k) => [...k, word]);
    else setUnknown((u) => [...u, word]);
    setFlipped(false);
    setIndex((i) => i + 1);
  }

  function restart(words: Word[]) {
    setDeck(shuffle(words));
    setIndex(0);
    setFlipped(false);
    setKnown([]);
    setUnknown([]);
  }

  if (!deck) return null;

  return (
    <div className="flex min-h-[calc(100dvh-9rem)] flex-col px-4 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <header className="mb-3 flex items-center gap-2">
        <button
          onClick={() => router.back()}
          aria-label="Back"
          className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-2xl text-muted active:bg-surface-2"
        >
          <ArrowLeft size={22} />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-black tracking-tight">Flashcards</h1>
          <p className="text-xs font-semibold text-muted">{label}</p>
        </div>
        {!finished && (
          <p className="text-sm font-bold text-muted">
            {Math.min(index + 1, deck.length)} / {deck.length}
          </p>
        )}
      </header>

      {/* progress bar */}
      <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-surface-2">
        <motion.div
          className="h-full rounded-full bg-primary"
          animate={{ width: `${(index / Math.max(deck.length, 1)) * 100}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {finished ? (
        <div className="flex flex-1 flex-col items-center justify-center pb-16 text-center">
          <p className="text-5xl font-black text-primary">
            {known.length}/{deck.length}
          </p>
          <p className="mt-2 text-lg font-extrabold">
            {unknown.length === 0 ? "Perfect round! 🎉" : "cards you knew"}
          </p>
          {unknown.length > 0 && (
            <p className="mt-1 text-sm font-semibold text-muted">
              {unknown.length} still learning
            </p>
          )}
          <div className="mt-6 flex flex-col gap-2">
            {unknown.length > 0 && (
              <Button onClick={() => restart(unknown)}>
                <RotateCcw size={17} /> Practice the {unknown.length} you missed
              </Button>
            )}
            <Button variant="secondary" onClick={() => restart(deck.concat())}>
              Restart all
            </Button>
            <Button variant="ghost" onClick={() => router.push("/learn")}>
              Done
            </Button>
          </div>
        </div>
      ) : word ? (
        <>
          <div className="relative flex-1" style={{ perspective: 1400 }}>
            <AnimatePresence mode="popLayout" custom={exitDir}>
              <motion.div
                key={`${word.id}-${index}`}
                className="absolute inset-0 cursor-pointer"
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.8}
                onDragEnd={(_, info) => {
                  if (info.offset.x > 110 || info.velocity.x > 600) advance(true);
                  else if (info.offset.x < -110 || info.velocity.x < -600) advance(false);
                }}
                variants={{
                  enter: { opacity: 0, scale: 0.94, y: 14 },
                  center: { opacity: 1, scale: 1, y: 0 },
                  exit: (dir: number) => ({
                    x: dir >= 0 ? 340 : -340,
                    opacity: 0,
                    rotate: dir >= 0 ? 8 : -8,
                    transition: { duration: 0.25 },
                  }),
                }}
                custom={exitDir}
                initial="enter"
                animate="center"
                exit="exit"
                onClick={() => setFlipped((f) => !f)}
              >
                <motion.div
                  className="relative h-full min-h-[380px]"
                  animate={{ rotateY: flipped ? 180 : 0 }}
                  transition={{ type: "spring", stiffness: 260, damping: 26 }}
                  style={{ transformStyle: "preserve-3d" }}
                >
                  {/* front */}
                  <div
                    className="absolute inset-0 flex flex-col items-center justify-center rounded-[28px] border border-border bg-surface p-6 text-center shadow-lg"
                    style={{ backfaceVisibility: "hidden" }}
                  >
                    {word.article && (
                      <span
                        className={cn(
                          "mb-3 rounded-xl px-3 py-1 text-sm font-extrabold",
                          ARTICLE_BG[word.article]
                        )}
                      >
                        {word.article}
                      </span>
                    )}
                    <p className="text-4xl font-black tracking-tight">{word.german}</p>
                    {word.ipa && (
                      <p className="mt-2 text-sm font-semibold text-muted">{word.ipa}</p>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        void playWordOnce(word);
                      }}
                      aria-label="Play pronunciation"
                      className="mt-6 flex h-13 w-13 cursor-pointer items-center justify-center rounded-full bg-primary-soft p-3 text-primary active:scale-90"
                    >
                      <Volume2 size={24} />
                    </button>
                    <p className="mt-6 text-xs font-semibold text-muted">tap to flip</p>
                  </div>
                  {/* back */}
                  <div
                    className="absolute inset-0 flex flex-col items-center justify-center rounded-[28px] border border-primary/40 bg-primary-soft p-6 text-center shadow-lg"
                    style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
                  >
                    <p className="text-3xl font-black tracking-tight">
                      {word.english ?? "no translation"}
                    </p>
                    {word.plural && (
                      <p className="mt-3 text-sm font-bold text-muted">
                        plural: die {word.plural}
                      </p>
                    )}
                    {word.example && (
                      <p className="mt-4 text-sm font-semibold text-muted">{word.example}</p>
                    )}
                  </div>
                </motion.div>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="mt-5 mb-4 flex items-center justify-center gap-4">
            <button
              onClick={() => advance(false)}
              aria-label="Still learning"
              className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-full bg-destructive/10 text-destructive shadow-sm active:scale-90"
            >
              <X size={28} />
            </button>
            <p className="w-28 text-center text-xs font-semibold text-muted">
              swipe or tap
            </p>
            <button
              onClick={() => advance(true)}
              aria-label="Got it"
              className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-full bg-accent-soft text-accent shadow-sm active:scale-90"
            >
              <Check size={28} />
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

export default function FlashcardsPage() {
  return (
    <Suspense fallback={null}>
      <FlashcardsContent />
    </Suspense>
  );
}
