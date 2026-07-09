"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ArrowLeft,
  Heart,
  Mic,
  Pencil,
  Snail,
  Trash2,
  Volume2,
} from "lucide-react";
import { db } from "@/lib/db";
import { ARTICLE_BG, type Article } from "@/lib/types";
import { deleteWord, setWordGroups, toggleFavorite } from "@/lib/words";
import { playWordOnce, wordSpokenText } from "@/lib/player";
import { speak } from "@/lib/tts";
import { getSettings } from "@/lib/settings";
import { PracticeSheet } from "@/components/practice-sheet";
import { VerbDetails } from "@/components/verb-details";
import { Button, Card, Input, Sheet, Textarea, cn } from "@/components/ui";

const ARTICLES: (Article | "")[] = ["", "der", "die", "das"];

export default function WordDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const wordId = Number(id);
  const router = useRouter();

  const word = useLiveQuery(() => db.words.get(wordId), [wordId]);
  const groups = useLiveQuery(() => db.groups.orderBy("name").toArray(), []) ?? [];

  const [practiceOpen, setPracticeOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [draft, setDraft] = useState({
    german: "",
    article: "" as Article | "",
    english: "",
    plural: "",
    example: "",
    exampleEn: "",
    notes: "",
  });

  if (word === undefined) return null; // loading
  if (word === null) {
    return (
      <div className="flex flex-col items-center px-4 pt-24 text-center">
        <p className="font-extrabold">Word not found</p>
        <Button variant="secondary" className="mt-4" onClick={() => router.replace("/")}>
          Back to words
        </Button>
      </div>
    );
  }

  function openEdit() {
    if (!word) return;
    setDraft({
      german: word.german,
      article: word.article ?? "",
      english: word.english ?? "",
      plural: word.plural ?? "",
      example: word.example ?? "",
      exampleEn: word.exampleEn ?? "",
      notes: word.notes ?? "",
    });
    setEditOpen(true);
  }

  async function saveEdit() {
    if (!draft.german.trim()) return;
    await db.words.update(wordId, {
      german: draft.german.trim(),
      article: draft.article || undefined,
      english: draft.english.trim() || undefined,
      plural: draft.plural.trim() || undefined,
      example: draft.example.trim() || undefined,
      exampleEn: draft.exampleEn.trim() || undefined,
      notes: draft.notes.trim() || undefined,
      status: "ready",
      updatedAt: Date.now(),
    });
    setEditOpen(false);
  }

  async function playSlow() {
    await speak(wordSpokenText(word!, getSettings().readArticle), {
      lang: "de-DE",
      rate: 0.6,
      voiceURI: getSettings().germanVoice || undefined,
    });
  }

  async function toggleGroup(groupId: number) {
    const has = word!.groupIds.includes(groupId);
    await setWordGroups(
      wordId,
      has ? word!.groupIds.filter((g) => g !== groupId) : [...word!.groupIds, groupId]
    );
  }

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
        <div className="flex-1" />
        <button
          onClick={openEdit}
          aria-label="Edit word"
          className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-2xl text-muted active:bg-surface-2"
        >
          <Pencil size={20} />
        </button>
        <button
          onClick={() => toggleFavorite(word)}
          aria-label={word.favorite ? "Remove from favorites" : "Add to favorites"}
          aria-pressed={!!word.favorite}
          className={cn(
            "flex h-11 w-11 cursor-pointer items-center justify-center rounded-2xl active:scale-90",
            word.favorite ? "text-rose-500" : "text-muted"
          )}
        >
          <Heart size={22} fill={word.favorite ? "currentColor" : "none"} />
        </button>
      </header>

      {/* Word hero */}
      <div className="mb-5 text-center">
        {word.article && (
          <span
            className={cn(
              "mb-2 inline-block rounded-xl px-3 py-1 text-sm font-extrabold",
              ARTICLE_BG[word.article]
            )}
          >
            {word.article}
          </span>
        )}
        <h1 className="text-4xl font-black tracking-tight">{word.german}</h1>
        {word.ipa && <p className="mt-1 text-base font-semibold text-muted">{word.ipa}</p>}
        <p className="mt-2 text-xl font-bold text-muted">{word.english ?? "—"}</p>
        {(word.plural || word.pos) && (
          <p className="mt-1 text-sm font-semibold text-muted">
            {word.pos}
            {word.plural && (
              <>
                {" · "}plural: <span className="text-foreground">die {word.plural}</span>
              </>
            )}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="mb-5 flex justify-center gap-3">
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={() => void playWordOnce(word)}
            aria-label="Play pronunciation"
            className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-full bg-primary text-on-primary shadow-lg active:scale-90"
          >
            <Volume2 size={26} />
          </button>
          <span className="text-xs font-bold text-muted">Play</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={() => void playSlow()}
            aria-label="Play slowly"
            className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-full bg-surface-2 text-foreground shadow-sm active:scale-90"
          >
            <Snail size={26} />
          </button>
          <span className="text-xs font-bold text-muted">Slow</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={() => setPracticeOpen(true)}
            aria-label="Practice pronunciation"
            className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-full bg-accent text-white shadow-lg active:scale-90 dark:text-[#0c0f1a]"
          >
            <Mic size={26} />
          </button>
          <span className="text-xs font-bold text-muted">Practice</span>
        </div>
      </div>

      {/* Example (verbs show it in the verb section below Groups instead) */}
      {word.pos !== "verb" && (word.example || word.exampleEn) && (
        <Card className="mb-3 p-4">
          <p className="mb-1 text-xs font-extrabold tracking-wide text-muted uppercase">
            Example
          </p>
          {word.example && <p className="font-bold">{word.example}</p>}
          {word.exampleEn && <p className="text-sm font-semibold text-muted">{word.exampleEn}</p>}
        </Card>
      )}

      {/* Notes */}
      {word.notes && (
        <Card className="mb-3 p-4">
          <p className="mb-1 text-xs font-extrabold tracking-wide text-muted uppercase">Notes</p>
          <p className="text-sm font-semibold whitespace-pre-wrap">{word.notes}</p>
        </Card>
      )}

      {/* Groups */}
      <Card className="mb-3 p-4">
        <p className="mb-2 text-xs font-extrabold tracking-wide text-muted uppercase">Groups</p>
        {groups.length === 0 ? (
          <p className="text-sm font-semibold text-muted">
            No groups yet — create one in the Groups tab.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {groups.map((g) => (
              <button
                key={g.id}
                onClick={() => toggleGroup(g.id!)}
                aria-pressed={word.groupIds.includes(g.id!)}
                className={cn(
                  "cursor-pointer rounded-full px-4 py-2 text-sm font-bold transition-all active:scale-95",
                  word.groupIds.includes(g.id!)
                    ? "bg-primary text-on-primary"
                    : "bg-surface-2 text-muted"
                )}
              >
                {g.name}
              </button>
            ))}
          </div>
        )}
      </Card>

      {/* Verb details: example, Perfekt, conjugation, grammar */}
      {word.pos === "verb" && <VerbDetails word={word} />}

      {/* Delete */}
      {!confirmDelete ? (
        <Button
          variant="destructive"
          className="mb-6 w-full"
          onClick={() => setConfirmDelete(true)}
        >
          <Trash2 size={18} /> Delete word
        </Button>
      ) : (
        <Card className="mb-6 border-destructive/40 p-4">
          <p className="mb-3 text-sm font-bold text-destructive">
            Delete “{word.german}” permanently?
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-destructive text-white"
              onClick={async () => {
                await deleteWord(wordId);
                router.back();
              }}
            >
              Delete
            </Button>
          </div>
        </Card>
      )}

      <PracticeSheet word={word} open={practiceOpen} onClose={() => setPracticeOpen(false)} />

      <Sheet open={editOpen} onClose={() => setEditOpen(false)} title="Edit word">
        <div className="flex flex-col gap-3 pb-2">
          <label className="text-sm font-extrabold">
            German word
            <Input
              className="mt-1"
              value={draft.german}
              onChange={(e) => setDraft({ ...draft, german: e.target.value })}
              lang="de"
            />
          </label>
          <div>
            <p className="mb-1 text-sm font-extrabold">Article</p>
            <div className="flex gap-2">
              {ARTICLES.map((a) => (
                <button
                  key={a || "none"}
                  onClick={() => setDraft({ ...draft, article: a })}
                  aria-pressed={draft.article === a}
                  className={cn(
                    "h-10 flex-1 cursor-pointer rounded-xl text-sm font-bold transition-all",
                    draft.article === a
                      ? "bg-primary text-on-primary"
                      : "bg-surface-2 text-muted"
                  )}
                >
                  {a || "none"}
                </button>
              ))}
            </div>
          </div>
          <label className="text-sm font-extrabold">
            English translation
            <Input
              className="mt-1"
              value={draft.english}
              onChange={(e) => setDraft({ ...draft, english: e.target.value })}
            />
          </label>
          <label className="text-sm font-extrabold">
            Plural
            <Input
              className="mt-1"
              value={draft.plural}
              onChange={(e) => setDraft({ ...draft, plural: e.target.value })}
              lang="de"
            />
          </label>
          <label className="text-sm font-extrabold">
            Example sentence (German)
            <Textarea
              className="mt-1"
              rows={2}
              value={draft.example}
              onChange={(e) => setDraft({ ...draft, example: e.target.value })}
              lang="de"
            />
          </label>
          <label className="text-sm font-extrabold">
            Example translation (English)
            <Textarea
              className="mt-1"
              rows={2}
              value={draft.exampleEn}
              onChange={(e) => setDraft({ ...draft, exampleEn: e.target.value })}
            />
          </label>
          <label className="text-sm font-extrabold">
            Notes
            <Textarea
              className="mt-1"
              rows={3}
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            />
          </label>
          <Button size="lg" disabled={!draft.german.trim()} onClick={saveEdit}>
            Save changes
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
