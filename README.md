# Vokabi — German Vocabulary Trainer

A mobile-first PWA for learning German vocabulary: native pronunciation, speaking practice, word groups, and listening playlists. All data lives on-device (IndexedDB) and the app works offline.

## Run

```bash
npm install
npm run dev        # development at http://localhost:3000
npm run build && npm start   # production (service worker enabled)
```

For the full PWA experience, open it in Chrome on Android and "Add to Home Screen".

## Features

- **Add words in bulk** — paste one word or a whole list; articles like "das Haus" are detected
- **Automatic dictionary** — article (der/die/das), English translation, plural, IPA, and part of speech via a built-in offline seed dictionary (~300 A1/A2 words), Wiktionary, and a translation fallback; results are cached in IndexedDB
- **Native pronunciation** — best available German system voice (Google natural voices on Android), selectable in Settings
- **Pronunciation practice** — speak the word, get Excellent / Good / Needs improvement feedback with per-letter mistake highlighting (Web Speech API)
- **Groups** — create/rename/delete groups, words can belong to several
- **Playlists** — play a whole group with configurable speed (0.5–1.5×), pause between words (0–5 s), repeat count (1–5×), read article, read translation, shuffle, and endless auto-repeat; mini-player with prev/pause/next
- **Favorites** — heart any word; favorites act as their own group
- **Search** — instant search across German, English, plural, and article
- **Word details** — plural, IPA, example sentence, notes, group membership, slow playback, edit everything
- **Import/Export** — import TXT/CSV (with or without translations), export CSV/JSON
- **Dark/light/system theme**, offline-first service worker, installable PWA

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Framer Motion · Dexie (IndexedDB) · Web Speech API (TTS + recognition) · lucide-react

## Architecture notes

- `src/lib/db.ts` — Dexie schema: `words`, `groups`, `dictCache`
- `src/lib/dictionary.ts` — lookup pipeline: seed → cache → en.wiktionary (gender/plural/IPA/definitions parsed from wikitext) → MyMemory translation fallback
- `src/lib/player.ts` — playback engine driven by user settings; cancellation via generation counter
- `src/lib/speech.ts` — SpeechRecognition scoring (Levenshtein + LCS char diff)
- TTS is pluggable: swap `src/lib/tts.ts` for Azure/Google Cloud TTS later; cloud sync can hook into the Dexie tables
