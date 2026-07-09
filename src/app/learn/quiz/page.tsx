"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, RotateCcw, Volume2 } from "lucide-react";
import {
  buildQuiz,
  loadSourceWords,
  parseSource,
  sourceLabel,
  type QuizQuestion,
} from "@/lib/learn";
import { playWordOnce } from "@/lib/player";
import { ARTICLE_COLORS, type Word } from "@/lib/types";
import { Button, cn } from "@/components/ui";

const TYPE_LABEL = {
  "de-en": "What does this mean?",
  "en-de": "What's the German word?",
  article: "Der, die or das?",
} as const;

function QuizContent() {
  const router = useRouter();
  const params = useSearchParams();

  const [pool, setPool] = useState<Word[] | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [label, setLabel] = useState("");
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [misses, setMisses] = useState<QuizQuestion[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const src = parseSource(params.get("src"));
    let cancelled = false;
    Promise.all([loadSourceWords(src), sourceLabel(src)]).then(([words, l]) => {
      if (cancelled) return;
      setPool(words);
      setQuestions(buildQuiz(words));
      setLabel(l);
    });
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [params]);

  const q = questions[index];
  const finished = pool !== null && questions.length > 0 && index >= questions.length;

  function choose(option: string) {
    if (!q || selected !== null) return;
    setSelected(option);
    const correct = option === q.correct;
    if (correct) setScore((s) => s + 1);
    else setMisses((m) => [...m, q]);
    void playWordOnce(q.word);
    timer.current = setTimeout(() => {
      setSelected(null);
      setIndex((i) => i + 1);
    }, correct ? 900 : 1600);
  }

  function restart() {
    if (!pool) return;
    setQuestions(buildQuiz(pool));
    setIndex(0);
    setSelected(null);
    setScore(0);
    setMisses([]);
  }

  if (!pool) return null;

  if (questions.length === 0) {
    return (
      <div className="px-4 pt-8 text-center">
        <p className="font-extrabold">Not enough data for a quiz</p>
        <p className="mt-1 text-sm font-semibold text-muted">
          Words need translations or articles first.
        </p>
        <Button variant="secondary" className="mt-4" onClick={() => router.push("/learn")}>
          Back
        </Button>
      </div>
    );
  }

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
          <h1 className="text-lg font-black tracking-tight">Quiz</h1>
          <p className="text-xs font-semibold text-muted">{label}</p>
        </div>
        {!finished && (
          <p className="text-sm font-bold text-muted">
            {Math.min(index + 1, questions.length)} / {questions.length}
          </p>
        )}
      </header>

      <div className="mb-6 h-1.5 overflow-hidden rounded-full bg-surface-2">
        <motion.div
          className="h-full rounded-full bg-accent"
          animate={{ width: `${(index / questions.length) * 100}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {finished ? (
        <div className="flex flex-1 flex-col items-center pb-10 text-center">
          <p className="mt-8 text-5xl font-black text-accent">
            {Math.round((score / questions.length) * 100)}%
          </p>
          <p className="mt-2 text-lg font-extrabold">
            {score} of {questions.length} correct
            {score === questions.length ? ", perfect! 🎉" : ""}
          </p>
          {misses.length > 0 && (
            <div className="mt-6 w-full max-w-sm rounded-2xl bg-surface-2 p-4 text-left">
              <p className="mb-2 text-xs font-extrabold tracking-wide text-muted uppercase">
                Review these
              </p>
              <ul className="flex flex-col gap-1.5">
                {misses.map((m, i) => (
                  <li key={i} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-extrabold">
                      {m.word.article && (
                        <span className={cn("mr-1", ARTICLE_COLORS[m.word.article])}>
                          {m.word.article}
                        </span>
                      )}
                      {m.word.german}
                    </span>
                    <span className="truncate font-semibold text-muted">
                      {m.word.english?.split(";")[0]}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-6 flex flex-col gap-2">
            <Button onClick={restart}>
              <RotateCcw size={17} /> Play again
            </Button>
            <Button variant="ghost" onClick={() => router.push("/learn")}>
              Done
            </Button>
          </div>
        </div>
      ) : q ? (
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.22 }}
            className="flex flex-1 flex-col"
          >
            <p className="text-center text-sm font-bold text-muted">{TYPE_LABEL[q.type]}</p>
            <div className="my-7 flex items-center justify-center gap-3 text-center">
              <p className="text-3xl font-black tracking-tight">
                {q.type === "article" ? (
                  <>
                    <span className="text-muted">___</span> {q.prompt}
                  </>
                ) : (
                  q.prompt
                )}
              </p>
              {q.type !== "en-de" && (
                <button
                  onClick={() => void playWordOnce(q.word)}
                  aria-label="Play pronunciation"
                  className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-primary-soft text-primary active:scale-90"
                >
                  <Volume2 size={18} />
                </button>
              )}
            </div>

            <div className="flex flex-col gap-2.5">
              {q.options.map((opt) => {
                const isCorrect = selected !== null && opt === q.correct;
                const isWrongPick = selected === opt && opt !== q.correct;
                return (
                  <button
                    key={opt}
                    onClick={() => choose(opt)}
                    disabled={selected !== null}
                    className={cn(
                      "min-h-13 cursor-pointer rounded-2xl border-2 px-4 py-3 text-left text-base font-bold transition-all active:scale-[0.98]",
                      isCorrect
                        ? "border-accent bg-accent-soft text-accent"
                        : isWrongPick
                          ? "border-destructive bg-destructive/10 text-destructive"
                          : "border-border bg-surface"
                    )}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </motion.div>
        </AnimatePresence>
      ) : null}
    </div>
  );
}

export default function QuizPage() {
  return (
    <Suspense fallback={null}>
      <QuizContent />
    </Suspense>
  );
}
