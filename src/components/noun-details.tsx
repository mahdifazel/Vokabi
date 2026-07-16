"use client";

import { useMemo } from "react";
import { Volume2 } from "lucide-react";
import type { Word } from "@/lib/types";
import { getNounInfo, type NounCase, type NounForm } from "@/lib/nouns";
import { speak } from "@/lib/tts";
import { getSettings } from "@/lib/settings";
import { Collapsible } from "./ui";

const CASES: [NounCase, string][] = [
  ["nominativ", "Nominativ"],
  ["akkusativ", "Akkusativ"],
  ["dativ", "Dativ"],
  ["genitiv", "Genitiv"],
];

function speakGerman(text: string) {
  const s = getSettings();
  void speak(text, { lang: "de-DE", rate: s.rate, voiceURI: s.germanVoice || undefined });
}

function joinForms(forms: Record<NounCase, NounForm>): string {
  return CASES.map(([key]) => `${forms[key].article} ${forms[key].noun}`).join(", ");
}

function FormGroup({
  title,
  forms,
  badge,
}: {
  title: string;
  forms: Record<NounCase, NounForm>;
  badge?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-extrabold tracking-wide text-muted uppercase">{title}</p>
        <div className="flex items-center gap-2">
          {badge && (
            <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-extrabold text-primary">
              {badge}
            </span>
          )}
          <button
            onClick={() => speakGerman(joinForms(forms))}
            aria-label={`Play ${title.toLowerCase()} forms`}
            className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-primary-soft text-primary active:scale-90"
          >
            <Volume2 size={18} />
          </button>
        </div>
      </div>
      <div className="flex flex-col">
        {CASES.map(([key, label], i) => (
          <div
            key={key}
            className={
              "flex items-baseline justify-between gap-3 py-2" +
              (i > 0 ? " border-t border-border" : "")
            }
          >
            <span className="text-sm font-semibold text-muted">{label}</span>
            <span className="min-w-0 text-right font-bold break-words hyphens-auto" lang="de">
              {forms[key].article} {forms[key].noun}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Noun-only section on the word detail screen: declension + gender hint */
export function NounDetails({ word }: { word: Word }) {
  const info = useMemo(
    () => getNounInfo(word.german, word.article, word.plural),
    [word.german, word.article, word.plural]
  );
  if (!info) return null;

  const hint = info.genderHint;

  return (
    <Collapsible title="Declension" className="mb-3" defaultOpen>
      {hint && (
        <div className="mb-2 rounded-xl bg-primary-soft px-3 py-2 text-sm font-semibold">
          <span className="font-extrabold text-primary">Why {word.article}?</span>
          {" Nouns ending in "}
          <span className="font-extrabold" lang="de">{hint.suffix}</span>
          {hint.soft ? " are usually " : " are "}
          {hint.gender}.
        </div>
      )}
      <FormGroup title="Singular" forms={info.singular} badge={info.weak ? "n-noun" : undefined} />
      {info.plural && (
        <div className="mt-3 border-t border-border pt-3">
          <FormGroup title="Plural" forms={info.plural} />
        </div>
      )}
    </Collapsible>
  );
}
