"use client";

import { useMemo } from "react";
import { Volume2 } from "lucide-react";
import type { Word } from "@/lib/types";
import { getAdjectiveInfo } from "@/lib/adjectives";
import { speak } from "@/lib/tts";
import { getSettings } from "@/lib/settings";
import { Card, Collapsible } from "./ui";
import { ExampleCard } from "./example-card";

function speakGerman(text: string) {
  const s = getSettings();
  void speak(text, { lang: "de-DE", rate: s.rate, voiceURI: s.germanVoice || undefined });
}

/** Adjective-only sections: example, comparison, combinations, grammar */
export function AdjectiveDetails({ word }: { word: Word }) {
  const info = useMemo(() => getAdjectiveInfo(word.german), [word.german]);
  if (!info) return null;

  const example = word.example || info.example;
  const exampleEn = word.exampleEn || info.exampleEn;

  const rows: [string, string][] =
    info.comparative && info.superlative
      ? [
          ["Positiv", info.base],
          ["Komparativ", info.comparative],
          ["Superlativ", info.superlative],
        ]
      : [];

  const grammar: [string, string][] = [];
  if (info.opposite) grammar.push(["Opposite", info.opposite]);
  if (info.level) grammar.push(["Level", info.level]);

  return (
    <>
      {/* Example sentence */}
      <ExampleCard example={example} exampleEn={exampleEn} />

      {/* Comparison forms (omitted for non-gradable adjectives) */}
      {rows.length > 0 && (
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
                onClick={() =>
                  speakGerman(`${info.base}, ${info.comparative}, ${info.superlative}`)
                }
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
      )}

      {/* Common combinations */}
      {info.combos && info.combos.length > 0 && (
        <Collapsible title="Common combinations" className="mb-3" defaultOpen>
          <div className="flex flex-col">
            {info.combos.map((c, i) => (
              <div
                key={c.de}
                className={
                  "flex items-center gap-3 py-2" + (i > 0 ? " border-t border-border" : "")
                }
              >
                <div className="min-w-0 flex-1">
                  <p className="font-bold" lang="de">{c.de}</p>
                  <p className="text-sm font-semibold text-muted">{c.en}</p>
                </div>
                <button
                  onClick={() => speakGerman(c.de)}
                  aria-label={`Play ${c.de}`}
                  className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-primary-soft text-primary active:scale-90"
                >
                  <Volume2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </Collapsible>
      )}

      {/* Grammar details */}
      {grammar.length > 0 && (
        <Collapsible title="Grammar" className="mb-3" defaultOpen>
          <div className="flex flex-col">
            {grammar.map(([label, value], i) => (
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
        </Collapsible>
      )}
    </>
  );
}
