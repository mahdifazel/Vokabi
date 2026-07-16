"use client";

import { useMemo } from "react";
import { Volume2 } from "lucide-react";
import type { Word } from "@/lib/types";
import { getVerbInfo } from "@/lib/verbs";
import { speak } from "@/lib/tts";
import { getSettings } from "@/lib/settings";
import { Card, Collapsible } from "./ui";

const PRONOUNS = [
  ["ich", "ich"],
  ["du", "du"],
  ["er", "er/sie/es"],
  ["wir", "wir"],
  ["ihr", "ihr"],
  ["sie", "sie/Sie"],
] as const;

function speakGerman(text: string) {
  const s = getSettings();
  void speak(text, { lang: "de-DE", rate: s.rate, voiceURI: s.germanVoice || undefined });
}

/** Verb-only sections on the word detail screen: example, Perfekt, conjugation, grammar */
export function VerbDetails({ word }: { word: Word }) {
  const info = useMemo(() => getVerbInfo(word.german), [word.german]);
  if (!info) return null;

  const example = word.example || info.example;
  const exampleEn = word.exampleEn || info.exampleEn;

  const grammar: [string, string][] = [];
  grammar.push(["Verb type", info.types.join(" · ")]);
  if (info.prep) grammar.push(["Preposition", info.prep]);
  if (info.caseGov) grammar.push(["Case", info.caseGov]);
  if (info.level) grammar.push(["Level", info.level]);

  return (
    <>
      {/* Example sentence */}
      {example && (
        <Card className="mb-3 p-4">
          <p className="mb-1 text-xs font-extrabold tracking-wide text-muted uppercase">Example</p>
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-bold" lang="de">{example}</p>
              {exampleEn && <p className="mt-0.5 text-sm font-semibold text-muted">{exampleEn}</p>}
            </div>
            <button
              onClick={() => speakGerman(example)}
              aria-label="Play example sentence"
              className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-primary-soft text-primary active:scale-90"
            >
              <Volume2 size={18} />
            </button>
          </div>
        </Card>
      )}

      {/* Past forms (Präteritum + Perfekt) */}
      <Card className="mb-3 p-4">
        <p className="mb-1 text-xs font-extrabold tracking-wide text-muted uppercase">
          Past forms
        </p>
        <div className="flex items-center gap-2 py-2">
          <span className="text-sm font-semibold text-muted">Präteritum</span>
          <p className="min-w-0 flex-1 text-right font-bold" lang="de">{info.praeteritumEr}</p>
          <button
            onClick={() => speakGerman(info.praeteritumEr)}
            aria-label="Play Präteritum form"
            className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-primary-soft text-primary active:scale-90"
          >
            <Volume2 size={18} />
          </button>
        </div>
        <div className="flex items-center gap-2 border-t border-border py-2">
          <span className="text-sm font-semibold text-muted">Perfekt</span>
          <p className="min-w-0 flex-1 text-right font-bold" lang="de">{info.perfekt}</p>
          <span className="shrink-0 rounded-full bg-primary-soft px-3 py-1 text-xs font-extrabold text-primary">
            with {info.aux}
          </span>
          <button
            onClick={() => speakGerman(info.perfekt)}
            aria-label="Play Perfekt form"
            className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-primary-soft text-primary active:scale-90"
          >
            <Volume2 size={18} />
          </button>
        </div>
      </Card>

      {/* Present tense conjugation */}
      <Collapsible title="Conjugation (Präsens)" className="mb-3" defaultOpen>
        <div className="flex flex-col">
          {PRONOUNS.map(([key, label], i) => (
            <div
              key={key}
              className={
                "flex items-baseline justify-between gap-3 py-2" +
                (i > 0 ? " border-t border-border" : "")
              }
            >
              <span className="text-sm font-semibold text-muted">{label}</span>
              <span className="font-bold" lang="de">{info.present[key]}</span>
            </div>
          ))}
        </div>
      </Collapsible>

      {/* Simple past conjugation */}
      <Collapsible title="Conjugation (Präteritum)" className="mb-3">
        <div className="flex flex-col">
          {PRONOUNS.map(([key, label], i) => (
            <div
              key={key}
              className={
                "flex items-baseline justify-between gap-3 py-2" +
                (i > 0 ? " border-t border-border" : "")
              }
            >
              <span className="text-sm font-semibold text-muted">{label}</span>
              <span className="font-bold" lang="de">{info.praeteritum[key]}</span>
            </div>
          ))}
        </div>
      </Collapsible>

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
                <span className="text-right font-bold">{value}</span>
              </div>
            ))}
          </div>
        </Collapsible>
      )}
    </>
  );
}
