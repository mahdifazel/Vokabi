"use client";

import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Download,
  FileUp,
  Moon,
  RefreshCw,
  Sun,
  SunMoon,
  Volume2,
} from "lucide-react";
import { db } from "@/lib/db";
import { updateSettings, useSettings } from "@/lib/settings";
import { getGermanVoices, speak } from "@/lib/tts";
import {
  downloadFile,
  importFromDelimited,
  retryPendingLookups,
  wordsToCSV,
  wordsToJSON,
} from "@/lib/words";
import { Button, Card, Segmented, Switch, cn } from "@/components/ui";
import { AccountCard } from "@/components/account-card";
import { FeedbackCard } from "@/components/feedback-card";

const RATES = [0.5, 0.75, 1, 1.25, 1.5] as const;
const PAUSES = [0, 0.5, 1, 2, 3, 5] as const;
const REPEATS = [1, 2, 3, 5] as const;

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="font-extrabold">{label}</p>
        {hint && <p className="text-sm font-semibold text-muted">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const settings = useSettings();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importMsg, setImportMsg] = useState("");
  const [retrying, setRetrying] = useState(false);
  const wordCount = useLiveQuery(() => db.words.count(), []) ?? 0;
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    // voices load asynchronously on Android, refresh once they arrive
    const synth = window.speechSynthesis;
    if (!synth) return;
    const update = () => setVoices(getGermanVoices());
    const initial = setTimeout(update, 0);
    synth.addEventListener("voiceschanged", update);
    return () => {
      clearTimeout(initial);
      synth.removeEventListener("voiceschanged", update);
    };
  }, []);

  async function previewVoice() {
    await speak("Guten Tag! Willkommen bei Vokabi.", {
      lang: "de-DE",
      rate: settings.rate,
      voiceURI: settings.germanVoice || undefined,
    });
  }

  async function handleImportFile(file: File) {
    const text = await file.text();
    const n = await importFromDelimited(text);
    setImportMsg(`Imported ${n} new word${n === 1 ? "" : "s"} from ${file.name}`);
    setTimeout(() => setImportMsg(""), 4000);
  }

  async function handleExport(format: "csv" | "json") {
    const words = await db.words.toArray();
    const stamp = new Date().toISOString().slice(0, 10);
    if (format === "csv") {
      downloadFile(`vokabi-${stamp}.csv`, wordsToCSV(words), "text/csv;charset=utf-8");
    } else {
      downloadFile(`vokabi-${stamp}.json`, wordsToJSON(words), "application/json");
    }
  }

  return (
    <div className="px-4 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <header className="mb-4">
        <h1 className="text-2xl font-black tracking-tight">Settings</h1>
        <p className="text-sm font-semibold text-muted">Audio, appearance and your data</p>
      </header>

      <AccountCard />

      {/* Audio settings */}
      <Card className="mb-4 px-4 py-2">
        <p className="pt-3 pb-1 text-xs font-extrabold tracking-wide text-muted uppercase">
          Audio
        </p>

        <div className="py-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-extrabold">Reading speed</p>
            <span className="rounded-lg bg-primary-soft px-2 py-0.5 text-sm font-extrabold text-primary">
              {settings.rate}x
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={RATES.length - 1}
            step={1}
            value={RATES.indexOf(settings.rate as (typeof RATES)[number]) === -1 ? 2 : RATES.indexOf(settings.rate as (typeof RATES)[number])}
            onChange={(e) => updateSettings({ rate: RATES[Number(e.target.value)] })}
            aria-label="Reading speed"
          />
          <div className="mt-1 flex justify-between text-xs font-bold text-muted">
            {RATES.map((r) => (
              <span key={r}>{r}x</span>
            ))}
          </div>
        </div>

        <div className="py-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-extrabold">Pause between words</p>
            <span className="rounded-lg bg-primary-soft px-2 py-0.5 text-sm font-extrabold text-primary">
              {settings.pauseSec}s
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={PAUSES.length - 1}
            step={1}
            value={PAUSES.indexOf(settings.pauseSec as (typeof PAUSES)[number]) === -1 ? 3 : PAUSES.indexOf(settings.pauseSec as (typeof PAUSES)[number])}
            onChange={(e) => updateSettings({ pauseSec: PAUSES[Number(e.target.value)] })}
            aria-label="Pause between words"
          />
          <div className="mt-1 flex justify-between text-xs font-bold text-muted">
            {PAUSES.map((p) => (
              <span key={p}>{p}s</span>
            ))}
          </div>
        </div>

        <div className="py-3">
          <p className="mb-2 font-extrabold">Repeat each word</p>
          <Segmented
            options={REPEATS}
            value={(REPEATS.includes(settings.repeatCount as (typeof REPEATS)[number])
              ? settings.repeatCount
              : 1) as (typeof REPEATS)[number]}
            onChange={(v) => updateSettings({ repeatCount: v })}
            format={(v) => `${v}×`}
          />
        </div>

        <Row label="Read article" hint="“das Haus” instead of “Haus”">
          <Switch
            checked={settings.readArticle}
            onCheckedChange={(v) => updateSettings({ readArticle: v })}
            label="Read article"
          />
        </Row>
        <Row label="Read translation" hint="Speak the English meaning after each word">
          <Switch
            checked={settings.readTranslation}
            onCheckedChange={(v) => updateSettings({ readTranslation: v })}
            label="Read translation"
          />
        </Row>
        <Row label="Auto-repeat playlist" hint="Loop the group until you stop it">
          <Switch
            checked={settings.autoRepeat}
            onCheckedChange={(v) => updateSettings({ autoRepeat: v })}
            label="Auto-repeat playlist"
          />
        </Row>
        <Row label="Shuffle" hint="Play group words in random order">
          <Switch
            checked={settings.shuffle}
            onCheckedChange={(v) => updateSettings({ shuffle: v })}
            label="Shuffle"
          />
        </Row>

        {voices.length > 0 && (
          <div className="py-3">
            <p className="mb-2 font-extrabold">German voice</p>
            <select
              className="h-12 w-full cursor-pointer rounded-2xl border border-border bg-surface px-3 text-base font-semibold"
              value={settings.germanVoice}
              onChange={(e) => updateSettings({ germanVoice: e.target.value })}
              aria-label="German voice"
            >
              <option value="">Automatic (best available)</option>
              {voices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name} ({v.lang})
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="pt-1 pb-4">
          <Button variant="secondary" size="sm" onClick={() => void previewVoice()}>
            <Volume2 size={16} /> Preview voice
          </Button>
        </div>
      </Card>

      {/* Appearance */}
      <Card className="mb-4 px-4 py-2">
        <p className="pt-3 pb-1 text-xs font-extrabold tracking-wide text-muted uppercase">
          Appearance
        </p>
        <div className="flex gap-2 py-3">
          {(
            [
              { v: "light", label: "Light", icon: Sun },
              { v: "system", label: "Auto", icon: SunMoon },
              { v: "dark", label: "Dark", icon: Moon },
            ] as const
          ).map(({ v, label, icon: Icon }) => (
            <button
              key={v}
              onClick={() => updateSettings({ theme: v })}
              aria-pressed={settings.theme === v}
              className={cn(
                "flex h-12 flex-1 cursor-pointer items-center justify-center gap-2 rounded-2xl text-sm font-bold transition-all active:scale-95",
                settings.theme === v
                  ? "bg-primary text-on-primary shadow-sm"
                  : "bg-surface-2 text-muted"
              )}
            >
              <Icon size={17} /> {label}
            </button>
          ))}
        </div>
      </Card>

      {/* Data */}
      <Card className="mb-6 px-4 py-2">
        <p className="pt-3 pb-1 text-xs font-extrabold tracking-wide text-muted uppercase">
          Your data
        </p>
        <p className="py-1 text-sm font-semibold text-muted">
          {wordCount} word{wordCount === 1 ? "" : "s"} stored on this device. Everything works
          offline.
        </p>
        <div className="flex flex-wrap gap-2 py-3">
          <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
            <FileUp size={16} /> Import TXT / CSV
          </Button>
          <Button variant="secondary" size="sm" onClick={() => void handleExport("csv")}>
            <Download size={16} /> Export CSV
          </Button>
          <Button variant="secondary" size="sm" onClick={() => void handleExport("json")}>
            <Download size={16} /> Export JSON
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={retrying}
            onClick={async () => {
              setRetrying(true);
              await retryPendingLookups();
              setRetrying(false);
            }}
          >
            <RefreshCw size={16} className={retrying ? "animate-spin" : undefined} /> Retry
            lookups
          </Button>
        </div>
        {importMsg && (
          <p className="pb-3 text-sm font-bold text-accent" role="status">
            {importMsg}
          </p>
        )}
        <input
          ref={fileRef}
          type="file"
          accept=".txt,.csv,.tsv,text/plain,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleImportFile(f);
            e.target.value = "";
          }}
        />
      </Card>

      <FeedbackCard />

      <p className="pb-6 text-center text-xs font-semibold text-muted">
        Vokabi · your personal German vocabulary trainer
      </p>
    </div>
  );
}
