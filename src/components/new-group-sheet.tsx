"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  CloudOff,
  FolderOpen,
  Loader2,
  PencilLine,
  Plus,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { db } from "@/lib/db";
import { addWordsFromText } from "@/lib/words";
import { fetchPresetGroups, presetsAvailable, type PresetGroup } from "@/lib/presets";
import { GROUP_TILES } from "@/lib/types";
import { Button, Input, Sheet, cn } from "./ui";

type Mode = "choice" | "custom" | "browse";

const stepMotion = {
  initial: { opacity: 0, x: 16 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -16 },
  transition: { duration: 0.18, ease: "easeOut" as const },
};

export function NewGroupSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  // without a backend there are no presets, so the sheet is just the name form
  const hasPresets = presetsAvailable();

  const [mode, setMode] = useState<Mode>(hasPresets ? "choice" : "custom");
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [presets, setPresets] = useState<PresetGroup[] | null | "error">(null);
  const [addingId, setAddingId] = useState<string | null>(null);

  const groups = useLiveQuery(() => db.groups.toArray(), []);
  const existingNames = useMemo(
    () => new Set((groups ?? []).map((g) => g.name.trim().toLowerCase())),
    [groups]
  );

  // fetch once per opened browse step; sheet re-opens get fresh data
  useEffect(() => {
    if (mode !== "browse" || presets !== null) return;
    let cancelled = false;
    fetchPresetGroups().then((list) => {
      if (!cancelled) setPresets(list ?? "error");
    });
    return () => {
      cancelled = true;
    };
  }, [mode, presets]);

  const filtered = useMemo(() => {
    if (presets === null || presets === "error") return [];
    const q = query.trim().toLowerCase();
    if (!q) return presets;
    return presets.filter(
      (p) =>
        p.name.toLowerCase().includes(q) || p.words.some((w) => w.toLowerCase().includes(q))
    );
  }, [presets, query]);

  function close() {
    onClose();
    // reset after the exit animation so the content doesn't flash mid-slide
    setTimeout(() => {
      setMode(hasPresets ? "choice" : "custom");
      setName("");
      setQuery("");
      setPresets(null);
      setAddingId(null);
    }, 300);
  }

  async function createCustom() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const id = (await db.groups.add({ name: trimmed, createdAt: Date.now() })) as number;
    close();
    router.push(`/groups/${id}`);
  }

  async function addPreset(preset: PresetGroup) {
    if (addingId) return;
    setAddingId(preset.id);
    try {
      const id = (await db.groups.add({ name: preset.name, createdAt: Date.now() })) as number;
      if (preset.words.length > 0) {
        // rows appear instantly as "pending"; enrichment continues in background
        await addWordsFromText(preset.words.join("\n"), [id]);
      }
      close();
      router.push(`/groups/${id}`);
    } finally {
      setAddingId(null);
    }
  }

  return (
    <Sheet open={open} onClose={close} title="New group">
      <div className="relative min-h-[16rem] overflow-x-clip pb-2">
        <AnimatePresence mode="wait" initial={false}>
          {mode === "choice" && (
            <motion.div key="choice" {...stepMotion} className="flex flex-col gap-2.5">
              <p className="mb-1 text-sm font-semibold text-muted">
                Start from scratch or pick a ready-made list.
              </p>
              <button
                onClick={() => setMode("custom")}
                className="flex w-full cursor-pointer items-center gap-3 rounded-3xl border border-border bg-surface p-4 text-left transition-all active:scale-[0.98]"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                  <PencilLine size={22} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-extrabold">Create my own</p>
                  <p className="text-sm font-semibold text-muted">
                    Name a new empty group yourself
                  </p>
                </div>
                <ChevronRight size={18} className="shrink-0 text-muted" />
              </button>
              <button
                onClick={() => setMode("browse")}
                className="flex w-full cursor-pointer items-center gap-3 rounded-3xl border border-border bg-surface p-4 text-left transition-all active:scale-[0.98]"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300">
                  <Sparkles size={22} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-extrabold">Choose a ready-made group</p>
                  <p className="text-sm font-semibold text-muted">
                    Curated groups, words included
                  </p>
                </div>
                <ChevronRight size={18} className="shrink-0 text-muted" />
              </button>
            </motion.div>
          )}

          {mode === "custom" && (
            <motion.div key="custom" {...stepMotion}>
              {hasPresets && <BackRow onBack={() => setMode("choice")} />}
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Food, A1, Verbs…"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && createCustom()}
                aria-label="Group name"
              />
              <Button
                className="mt-4 w-full"
                size="lg"
                disabled={!name.trim()}
                onClick={createCustom}
              >
                Create group
              </Button>
            </motion.div>
          )}

          {mode === "browse" && (
            <motion.div key="browse" {...stepMotion}>
              <BackRow onBack={() => setMode("choice")} />
              <div className="relative mb-3">
                <Search
                  size={18}
                  className="absolute top-1/2 left-4 -translate-y-1/2 text-muted"
                />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search groups…"
                  className="pr-10 pl-11"
                  type="search"
                  aria-label="Search ready-made groups"
                />
                {query && (
                  <button
                    onClick={() => setQuery("")}
                    aria-label="Clear search"
                    className="absolute top-1/2 right-3 flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-muted active:bg-surface-2"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              {presets === null ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="animate-spin text-muted" size={26} />
                </div>
              ) : presets === "error" ? (
                <BrowseNote
                  icon={<CloudOff size={24} />}
                  title="Couldn't load groups"
                  hint="Check your connection and try again."
                  action={
                    <Button size="sm" variant="secondary" onClick={() => setPresets(null)}>
                      Retry
                    </Button>
                  }
                />
              ) : filtered.length === 0 ? (
                <BrowseNote
                  icon={<Search size={24} />}
                  title={query ? "Nothing found" : "No ready-made groups yet"}
                  hint={
                    query
                      ? `No groups match “${query}”.`
                      : "Check back later, or create your own group instead."
                  }
                />
              ) : (
                <div className="flex flex-col gap-2" role="list">
                  {filtered.map((p, i) => {
                    const added = existingNames.has(p.name.trim().toLowerCase());
                    const adding = addingId === p.id;
                    return (
                      <motion.button
                        key={p.id}
                        role="listitem"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: Math.min(i * 0.04, 0.3) }}
                        onClick={() => !added && addPreset(p)}
                        disabled={added || addingId !== null}
                        aria-label={
                          added ? `${p.name} already in your library` : `Add ${p.name}`
                        }
                        className={cn(
                          "flex w-full cursor-pointer items-center gap-3 rounded-3xl border border-border bg-surface p-3.5 text-left transition-all active:scale-[0.98]",
                          added && "opacity-60",
                          !added && addingId !== null && !adding && "opacity-50"
                        )}
                      >
                        <div
                          className={cn(
                            "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
                            GROUP_TILES[i % GROUP_TILES.length]
                          )}
                        >
                          <FolderOpen size={20} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-extrabold">{p.name}</p>
                          <p className="truncate text-sm font-semibold text-muted">
                            {p.words.length === 0
                              ? "Empty group"
                              : `${p.words.length} word${p.words.length === 1 ? "" : "s"} · ${p.words
                                  .slice(0, 3)
                                  .join(", ")}${p.words.length > 3 ? "…" : ""}`}
                          </p>
                        </div>
                        <div
                          className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                            added
                              ? "bg-accent-soft text-accent"
                              : "bg-primary-soft text-primary"
                          )}
                        >
                          {adding ? (
                            <Loader2 size={17} className="animate-spin" />
                          ) : added ? (
                            <Check size={17} />
                          ) : (
                            <Plus size={17} />
                          )}
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Sheet>
  );
}

function BackRow({ onBack }: { onBack: () => void }) {
  return (
    <button
      onClick={onBack}
      className="mb-3 inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl pr-3 text-sm font-bold text-muted active:text-foreground"
    >
      <ArrowLeft size={16} /> Back
    </button>
  );
}

function BrowseNote({
  icon,
  title,
  hint,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-3xl bg-surface-2 text-muted">
        {icon}
      </div>
      <p className="font-extrabold">{title}</p>
      <p className="mt-1 max-w-xs text-sm font-semibold text-muted">{hint}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
