"use client";

import { useMemo } from "react";
import { Volume2 } from "lucide-react";
import type { Word } from "@/lib/types";
import { getAdjectiveInfo } from "@/lib/adjectives";
import { speak } from "@/lib/tts";
import { getSettings } from "@/lib/settings";
import { Card } from "./ui";

function speakGerman(text: string) {
  const s = getSettings();
  void speak(text, { lang: "de-DE", rate: s.rate, voiceURI: s.germanVoice || undefined });
}

/** Adjective-only section on the word detail screen: comparison forms */
export function AdjectiveDetails({ word }: { word: Word }) {
  const info = useMemo(() => getAdjectiveInfo(word.german), [word.german]);
  if (!info) return null;

  const rows: [string, string][] = [
    ["Positiv", info.base],
    ["Komparativ", info.comparative],
    ["Superlativ", info.superlative],
  ];

  return (
    <Card className="mb-3 p-4">
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-xs font-extrabold tracking-wide text-muted uppercase">Comparison</p>
        <div className="flex items-center gap-2">
          {info.irregular && (
            <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-extrabold text-primary">
              irregular
            </span>
          )}
          <button
            onClick={() => speakGerman(`${info.base}, ${info.comparative}, ${info.superlative}`)}
            aria-label="Play comparison forms"
            className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-primary-soft text-primary active:scale-90"
          >
            <Volume2 size={18} />
          </button>
        </div>
      </div>
      <div className="flex flex-col">
        {rows.map(([label, value], i) => (
          <div
            key={label}
            className={
              "flex items-baseline justify-between gap-3 py-2" +
              (i > 0 ? " border-t border-border" : "")
            }
          >
            <span className="text-sm font-semibold text-muted">{label}</span>
            <span className="text-right font-bold" lang="de">{value}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
