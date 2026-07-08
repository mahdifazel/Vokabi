"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { GraduationCap, Layers, ListChecks } from "lucide-react";
import { db } from "@/lib/db";
import { sourceParam, type LearnSource } from "@/lib/learn";
import { Card, EmptyState, cn } from "@/components/ui";

export default function LearnPage() {
  const router = useRouter();
  const [src, setSrc] = useState<LearnSource>({ kind: "all" });

  const words = useLiveQuery(() => db.words.toArray(), []);
  const groups = useLiveQuery(() => db.groups.orderBy("name").toArray(), []) ?? [];

  const counts = useMemo(() => {
    const perGroup = new Map<number, number>();
    let fav = 0;
    for (const w of words ?? []) {
      if (w.favorite) fav++;
      for (const g of w.groupIds) perGroup.set(g, (perGroup.get(g) ?? 0) + 1);
    }
    return { all: words?.length ?? 0, fav, perGroup };
  }, [words]);

  const selectedCount =
    src.kind === "all"
      ? counts.all
      : src.kind === "fav"
        ? counts.fav
        : (counts.perGroup.get(src.id) ?? 0);

  const chips: { src: LearnSource; label: string; count: number }[] = [
    { src: { kind: "all" }, label: "All words", count: counts.all },
    ...(counts.fav > 0
      ? [{ src: { kind: "fav" } as LearnSource, label: "♥ Favorites", count: counts.fav }]
      : []),
    ...groups.map((g) => ({
      src: { kind: "group", id: g.id! } as LearnSource,
      label: g.name,
      count: counts.perGroup.get(g.id!) ?? 0,
    })),
  ];

  const isSelected = (s: LearnSource) =>
    s.kind === src.kind && (s.kind !== "group" || (src.kind === "group" && s.id === src.id));

  if (words && words.length === 0) {
    return (
      <div className="px-4 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <header className="mb-4">
          <h1 className="text-2xl font-black tracking-tight">Learn</h1>
        </header>
        <EmptyState
          icon={<GraduationCap size={28} />}
          title="Nothing to practice yet"
          hint="Add some words first — then train them here with flashcards and quizzes."
        />
      </div>
    );
  }

  return (
    <div className="px-4 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <header className="mb-4">
        <h1 className="text-2xl font-black tracking-tight">Learn</h1>
        <p className="text-sm font-semibold text-muted">Train your vocabulary</p>
      </header>

      <p className="mb-2 text-sm font-extrabold">What do you want to practice?</p>
      <div className="mb-5 flex flex-wrap gap-2">
        {chips.map((c) => (
          <button
            key={c.label}
            onClick={() => setSrc(c.src)}
            disabled={c.count === 0}
            aria-pressed={isSelected(c.src)}
            className={cn(
              "cursor-pointer rounded-full px-4 py-2 text-sm font-bold transition-all active:scale-95 disabled:opacity-40",
              isSelected(c.src) ? "bg-primary text-on-primary" : "bg-surface-2 text-muted"
            )}
          >
            {c.label} · {c.count}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <button
          disabled={selectedCount < 1}
          onClick={() => router.push(`/learn/flashcards?src=${sourceParam(src)}`)}
          className="cursor-pointer text-left disabled:opacity-40"
        >
          <Card className="flex items-center gap-4 p-5 transition-transform active:scale-[0.98]">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
              <Layers size={26} />
            </div>
            <div className="flex-1">
              <p className="text-lg font-extrabold">Flashcards</p>
              <p className="text-sm font-semibold text-muted">
                Flip cards, swipe right if you know it
              </p>
            </div>
          </Card>
        </button>

        <button
          disabled={selectedCount < 2}
          onClick={() => router.push(`/learn/quiz?src=${sourceParam(src)}`)}
          className="cursor-pointer text-left disabled:opacity-40"
        >
          <Card className="flex items-center gap-4 p-5 transition-transform active:scale-[0.98]">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-accent">
              <ListChecks size={26} />
            </div>
            <div className="flex-1">
              <p className="text-lg font-extrabold">Quiz</p>
              <p className="text-sm font-semibold text-muted">
                Multiple choice — translations and der/die/das
              </p>
            </div>
          </Card>
        </button>
        {selectedCount === 1 && (
          <p className="text-center text-xs font-semibold text-muted">
            The quiz needs at least 2 words in the selection.
          </p>
        )}
      </div>
    </div>
  );
}
