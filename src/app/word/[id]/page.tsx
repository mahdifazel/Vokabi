"use client";

import { use, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Heart,
  Mic,
  Pencil,
  Snail,
  Trash2,
  Volume2,
} from "lucide-react";
import { db } from "@/lib/db";
import { ARTICLE_BG, type Article, type PartOfSpeech, type Word } from "@/lib/types";
import { deleteWord, ensureWordsGrouped, toggleFavorite, wordMeaning } from "@/lib/words";
import { playWordOnce, wordSpokenText } from "@/lib/player";
import { speak } from "@/lib/tts";
import { getSettings, useSettings } from "@/lib/settings";
import { PracticeSheet } from "@/components/practice-sheet";
import { AdjectiveDetails } from "@/components/adjective-details";
import { ExampleCard } from "@/components/example-card";
import { NounDetails } from "@/components/noun-details";
import { VerbDetails } from "@/components/verb-details";
import { Button, Card, Input, Sheet, Textarea, cn } from "@/components/ui";

const ARTICLES: (Article | "")[] = ["", "der", "die", "das"];

const POS_OPTIONS: (PartOfSpeech | "")[] = [
  "",
  "noun",
  "verb",
  "adjective",
  "adverb",
  "pronoun",
  "preposition",
  "conjunction",
  "interjection",
  "numeral",
  "phrase",
  "other",
];

export default function WordDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const wordId = Number(id);
  const router = useRouter();

  const word = useLiveQuery(() => db.words.get(wordId), [wordId]);
  const { meaningLanguage } = useSettings();
  const groups = useLiveQuery(() => db.groups.orderBy("name").toArray(), []) ?? [];

  // Which group the previous/next buttons walk through. Word rows carry the
  // group they were listed under in the URL; opening a word from somewhere
  // without that context (All words, favorites, search, a shared link) falls
  // back to its first group, and the card names the group either way so it is
  // never a mystery what "next" means.
  const searchParams = useSearchParams();
  const groupParam = Number(searchParams.get("group"));
  const contextGroupId =
    Number.isInteger(groupParam) && groupParam > 0 ? groupParam : word?.groupIds[0];
  // same query and order as the group page, so the sequence matches the list
  // the user was just looking at
  const siblings = useLiveQuery(
    () =>
      contextGroupId == null
        ? Promise.resolve([] as Word[])
        : db.words.where("groupIds").equals(contextGroupId).sortBy("createdAt"),
    [contextGroupId]
  );
  const position = siblings?.findIndex((w) => w.id === wordId) ?? -1;
  const prevWord = position > 0 ? siblings?.[position - 1] : undefined;
  const nextWord =
    siblings && position >= 0 && position < siblings.length - 1
      ? siblings[position + 1]
      : undefined;
  const contextGroup = groups.find((g) => g.id === contextGroupId);
  const hasSiblings = !!siblings && siblings.length > 1 && position >= 0;

  function goToSibling(id: number | undefined) {
    if (id == null) return;
    // replace, not push: stepping through ten words shouldn't bury the list
    // ten entries deep in history, and Previous already walks back
    router.replace(
      contextGroupId != null ? `/word/${id}?group=${contextGroupId}` : `/word/${id}`
    );
  }

  const [practiceOpen, setPracticeOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [draft, setDraft] = useState({
    german: "",
    article: "" as Article | "",
    pos: "" as PartOfSpeech | "",
    english: "",
    definitionDe: "",
    plural: "",
    example: "",
    exampleEn: "",
    notes: "",
    groupIds: [] as number[],
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
      pos: word.pos ?? "",
      english: word.english ?? "",
      definitionDe: word.definitionDe ?? "",
      plural: word.plural ?? "",
      example: word.example ?? "",
      exampleEn: word.exampleEn ?? "",
      notes: word.notes ?? "",
      groupIds: word.groupIds,
    });
    setEditOpen(true);
  }

  async function saveEdit() {
    if (!draft.german.trim()) return;
    await db.words.update(wordId, {
      german: draft.german.trim(),
      article: draft.article || undefined,
      pos: draft.pos || undefined,
      english: draft.english.trim() || undefined,
      definitionDe: draft.definitionDe.trim() || undefined,
      plural: draft.plural.trim() || undefined,
      example: draft.example.trim() || undefined,
      exampleEn: draft.exampleEn.trim() || undefined,
      notes: draft.notes.trim() || undefined,
      groupIds: draft.groupIds,
      status: "ready",
      updatedAt: Date.now(),
    });
    // a word saved without any group would be invisible on the library page
    if (draft.groupIds.length === 0) await ensureWordsGrouped();
    setEditOpen(false);
  }

  async function playSlow() {
    await speak(wordSpokenText(word!, getSettings().readArticle), {
      lang: "de-DE",
      rate: 0.6,
      voiceURI: getSettings().germanVoice || undefined,
    });
  }

  function toggleDraftGroup(groupId: number) {
    setDraft((d) => ({
      ...d,
      groupIds: d.groupIds.includes(groupId)
        ? d.groupIds.filter((g) => g !== groupId)
        : [...d.groupIds, groupId],
    }));
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
        <p className="mt-2 text-xl font-bold text-muted">
          {wordMeaning(word, meaningLanguage) ?? "-"}
        </p>
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

      {/* Actions, with the group navigation flanking them. The two nav
          circles are smaller and neutral so the word's own actions stay the
          loudest thing in the row; a fixed-height wrapper keeps every label
          on the same line despite the size difference. */}
      <div className={cn("flex items-start justify-center gap-2", hasSiblings ? "mb-2" : "mb-5")}>
        {hasSiblings && (
          <div className="flex flex-col items-center gap-1">
            <div className="flex h-16 items-center">
              <button
                onClick={() => goToSibling(prevWord?.id)}
                disabled={!prevWord}
                aria-label={
                  prevWord ? `Previous word, ${prevWord.german}` : "No previous word"
                }
                className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-full bg-surface-2 text-foreground shadow-sm active:scale-90 disabled:pointer-events-none disabled:opacity-40"
              >
                <ChevronLeft size={22} />
              </button>
            </div>
            <span className="text-xs font-bold text-muted">Prev</span>
          </div>
        )}
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
        {hasSiblings && (
          <div className="flex flex-col items-center gap-1">
            <div className="flex h-16 items-center">
              <button
                onClick={() => goToSibling(nextWord?.id)}
                disabled={!nextWord}
                aria-label={nextWord ? `Next word, ${nextWord.german}` : "No next word"}
                className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-full bg-surface-2 text-foreground shadow-sm active:scale-90 disabled:pointer-events-none disabled:opacity-40"
              >
                <ChevronRight size={22} />
              </button>
            </div>
            <span className="text-xs font-bold text-muted">Next</span>
          </div>
        )}
      </div>

      {/* where in the group you are, so "next" is never a mystery */}
      {hasSiblings && (
        <p className="mb-5 text-center text-xs font-semibold text-muted">
          {contextGroup?.name ?? "Group"} · {position + 1} of {siblings!.length}
        </p>
      )}

      {/* Example (verbs and adjectives show it in their own sections instead) */}
      {word.pos !== "verb" && word.pos !== "adjective" && (
        <ExampleCard example={word.example} exampleEn={word.exampleEn} />
      )}

      {/* Notes */}
      {word.notes && (
        <Card className="mb-3 p-4">
          <p className="mb-1 text-xs font-extrabold tracking-wide text-muted uppercase">Notes</p>
          <p className="text-sm font-semibold whitespace-pre-wrap">{word.notes}</p>
        </Card>
      )}

      {/* Verb details: example, past forms, conjugation, grammar */}
      {word.pos === "verb" && <VerbDetails word={word} />}

      {/* Adjective details: comparison forms */}
      {word.pos === "adjective" && <AdjectiveDetails word={word} />}

      {/* Noun details: declension + gender hint */}
      {word.pos === "noun" && <NounDetails word={word} />}

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
          <div>
            <p className="mb-1 text-sm font-extrabold">Part of speech</p>
            <div className="flex flex-wrap gap-2">
              {POS_OPTIONS.map((p) => (
                <button
                  key={p || "none"}
                  onClick={() => setDraft({ ...draft, pos: p })}
                  aria-pressed={draft.pos === p}
                  className={cn(
                    "cursor-pointer rounded-full px-3 py-1.5 text-sm font-bold transition-all active:scale-95",
                    draft.pos === p ? "bg-primary text-on-primary" : "bg-surface-2 text-muted"
                  )}
                >
                  {p || "none"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 text-sm font-extrabold">Groups</p>
            {groups.length === 0 ? (
              <p className="text-sm font-semibold text-muted">
                No groups yet. Create one from the library.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {groups.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => toggleDraftGroup(g.id!)}
                    aria-pressed={draft.groupIds.includes(g.id!)}
                    className={cn(
                      "cursor-pointer rounded-full px-4 py-2 text-sm font-bold transition-all active:scale-95",
                      draft.groupIds.includes(g.id!)
                        ? "bg-primary text-on-primary"
                        : "bg-surface-2 text-muted"
                    )}
                  >
                    {g.name}
                  </button>
                ))}
              </div>
            )}
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
            German definition
            <Textarea
              className="mt-1"
              rows={2}
              value={draft.definitionDe}
              onChange={(e) => setDraft({ ...draft, definitionDe: e.target.value })}
              lang="de"
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
