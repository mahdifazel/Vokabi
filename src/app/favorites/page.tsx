"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { Heart, Play, Shuffle } from "lucide-react";
import { db } from "@/lib/db";
import { startPlaylist } from "@/lib/player";
import { updateSettings, useSettings } from "@/lib/settings";
import { WordRow } from "@/components/word-row";
import { Button, EmptyState } from "@/components/ui";

export default function FavoritesPage() {
  const settings = useSettings();
  const words = useLiveQuery(
    () => db.words.where("favorite").equals(1).sortBy("createdAt"),
    []
  );

  return (
    <div className="px-4 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <header className="mb-4">
        <h1 className="text-2xl font-black tracking-tight">Favorites</h1>
        <p className="text-sm font-semibold text-muted">
          {words ? `${words.length} word${words.length === 1 ? "" : "s"}` : "…"}
        </p>
      </header>

      {words && words.length > 0 && (
        <div className="mb-4 flex gap-2">
          <Button className="flex-1" onClick={() => startPlaylist(words, "Favorites")}>
            <Play size={18} /> Play favorites
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
          icon={<Heart size={28} />}
          title="No favorites yet"
          hint="Tap the heart on any word to collect it here — favorites work like their own group."
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
