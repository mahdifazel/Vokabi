"use client";

import { Volume2 } from "lucide-react";
import { speak } from "@/lib/tts";
import { getSettings } from "@/lib/settings";
import { Card } from "./ui";

function speakGerman(text: string) {
  const s = getSettings();
  void speak(text, { lang: "de-DE", rate: s.rate, voiceURI: s.germanVoice || undefined });
}

/** Example sentence card (German + English + play button), shared by all word kinds */
export function ExampleCard({ example, exampleEn }: { example?: string; exampleEn?: string }) {
  if (!example && !exampleEn) return null;
  return (
    <Card className="mb-3 p-4">
      <p className="mb-1 text-xs font-extrabold tracking-wide text-muted uppercase">Example</p>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          {example && <p className="font-bold" lang="de">{example}</p>}
          {exampleEn && <p className="mt-0.5 text-sm font-semibold text-muted">{exampleEn}</p>}
        </div>
        {example && (
          <button
            onClick={() => speakGerman(example)}
            aria-label="Play example sentence"
            className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-primary-soft text-primary active:scale-90"
          >
            <Volume2 size={18} />
          </button>
        )}
      </div>
    </Card>
  );
}
