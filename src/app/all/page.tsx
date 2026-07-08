"use client";

import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft, BookOpen, Play, Shuffle } from "lucide-react";
import { db } from "@/lib/db";
import { startPlaylist } from "@/lib/player";
import { updateSettings, useSettings } from "@/lib/settings";
import { WordRow } from "@/components/word-row";
import { Button, EmptyState } from "@/components/ui";

export default function AllWordsPage() {
  const router = useRouter();
  const settings = useSettings();
  const words = useLiveQuery(() => db.words.orderBy("createdAt").reverse().toArray(), []);

  return (
    <div className="px-4 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <header className="mb-4 flex items-center gap-2">
        <button
          onClick={() => router.back()}
          aria-label="Back"
          className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-2xl text-muted active:bg-surface-2"
        >
          <ArrowLeft size={22} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-black tracking-tight">All words</h1>
          <p className="text-sm font-semibold text-muted">
            {words ? `${words.length} word${words.length === 1 ? "" : "s"}` : "…"}
          </p>
        </div>
      </header>

      {words && words.length > 0 && (
        <div className="mb-4 flex gap-2">
          <Button className="flex-1" onClick={() => startPlaylist(words, "All words")}>
            <Play size={18} /> Play all
          </Button>
          <Button
            variant={settings.shuffle ? "accent" : "secondary"}
            size="icon"
            aria-label={settings.shuffle ? "Shuffle on" : "Shuffle off"}
            aria-pressed={settings.shuffle}
            onClick={() => updateSettings({ shuffle: !settings.shuffle })}
          >
            <Shuffle size={18} />
          </Button>
        </div>
      )}

      {words && words.length === 0 ? (
        <EmptyState
          icon={<BookOpen size={28} />}
          title="No words yet"
          hint="Add words from the Library page."
        />
      ) : (
        <div className="flex flex-col gap-2.5">
          {words?.map((w, i) => (
            <WordRow key={w.id} word={w} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
