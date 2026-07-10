@AGENTS.md

# CLAUDE.md — Vokabi

Guidance for AI assistants and new developers working in this repository.

## Project overview

**Vokabi** is a mobile-first Progressive Web App for learning German vocabulary, live at **https://vokabi.app**. Users paste words (single or bulk) or scan them from a photo (on-device OCR, cleaned up by Groq AI when configured), the app enriches them automatically with article (der/die/das), English translation, plural, IPA, and part of speech, then trains them through native TTS playback (with lock-screen media controls that keep playing while the screen is off), pronunciation practice via speech recognition, flashcards, and quizzes. Verbs additionally get an on-device conjugation/Perfekt/grammar breakdown (`lib/verbs.ts`). Data is offline-first (IndexedDB) and syncs per-user to Supabase. An admin back office lives at `/admin`.

## Tech stack

| Layer | Technology | Notes |
|---|---|---|
| Framework | Next.js 16 (App Router) | ⚠️ See `AGENTS.md` — this Next.js version has breaking changes vs. training data; consult `node_modules/next/dist/docs/` |
| UI | React 19, TypeScript 5 (strict), Tailwind CSS v4 | Tailwind v4 uses CSS-based config in `src/app/globals.css` (`@theme inline`), no `tailwind.config` file |
| Animation | Framer Motion 12 | |
| Icons | lucide-react | Never use emoji as UI icons |
| Local DB | Dexie 4 (IndexedDB) + dexie-react-hooks (`useLiveQuery`) | Source of truth on-device |
| Cloud | Supabase (`@supabase/supabase-js` v2) | Auth (email/password) + Postgres with row-level security |
| Speech | Web Speech API | `speechSynthesis` for TTS, `webkitSpeechRecognition` for practice scoring |
| Fonts | Nunito via `next/font/google` | CSS var `--font-nunito` |
| Hosting | Vercel | Auto-deploys from `main`; custom domain vokabi.app |

## Key commands

```bash
npm install        # install dependencies
npm run dev        # dev server at http://localhost:3000
npm run build      # production build (also the de-facto type check)
npm start          # serve production build (service worker only registers in production)
npm run lint       # ESLint (eslint-config-next core-web-vitals + typescript)
```

There is **no test suite** (see `docs/TESTING.md`). Verification = `npm run lint` + `npm run build` + manual checks.

## Branch workflow

**Never commit directly to `main`** — every push to `main` auto-deploys to production. All changes go to the `dev` branch first, get reviewed on localhost (`npm run dev`), and are merged into `main` only after explicit approval.

## Environment variables

All optional — the app degrades gracefully (local-only mode, admin API returns 501):

| Variable | Side | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | client | Supabase project URL (`https://xxx.supabase.co`). Absent → app runs local-only, login gate off |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client | Supabase anon/publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | Powers `/api/admin/*` routes. Never expose to the client |
| `ADMIN_EMAILS` | server only | Comma-separated allowlist of admin account emails |
| `RESEND_API_KEY` | server only | Optional; enables the admin Email broadcast tab |
| `EMAIL_FROM` | server only | Optional; sender for broadcasts, e.g. `Vokabi <hello@vokabi.app>` |

Local dev: put them in `.env.local` (gitignored). Production: Vercel project → Settings → Environment Variables (requires redeploy — `NEXT_PUBLIC_*` values are baked at build time).

The **Groq API key is not an env var**: it lives in the `app_settings` table (service-role only) and is managed in the back office under `/admin/settings`, so it can be changed without a redeploy.

Database schema is applied **manually** in the Supabase SQL Editor: run `supabase/schema.sql` (words/groups + RLS), then `supabase/admin-schema.sql` (feedback/announcements/app_settings). There is no migrations tooling.

## Architecture in one paragraph

The app is almost entirely client-side. Dexie (IndexedDB) is the source of truth; every page reads it reactively via `useLiveQuery`. A sync engine (`src/lib/sync.ts`) pushes dirty rows / tombstoned deletions to Supabase and pulls everything back with last-write-wins merging, keyed by UUIDs (`uid`) since local numeric ids differ per device. Dictionary enrichment (`src/lib/dictionary.ts`) resolves words through: bundled seed dictionary → IndexedDB cache → en.wiktionary.org wikitext parsing → MyMemory translation fallback. Photo scanning (`src/lib/ocr.ts`) runs Tesseract.js on-device (assets self-hosted under `/ocr/`), then the raw text goes to `/api/ai/extract-words` for Groq cleanup with the heuristic line filter as automatic fallback (`src/lib/ai.ts`). Audio (`src/lib/tts.ts`, `player.ts`, `keepalive.ts`) drives the Web Speech API with Android-specific workarounds, a settings-aware playlist loop, a near-silent audio keep-alive for screen-off playback, and Media Session lock-screen controls. The only server code is `/api/admin/*` route handlers guarded by `requireAdmin` (bearer token verified via service-role client + `ADMIN_EMAILS` allowlist) and `/api/ai/*` (signed-in users; calls Groq with the key stored in `app_settings`, and the client falls back to on-device heuristics when it fails). See `docs/ARCHITECTURE.md` for the full picture.

## Directory structure

```
src/
  app/
    page.tsx               Library home: group cards + global search
    all/                   All-words list with play controls
    groups/[id]/           Group detail (play, add, rename, delete)
    groups/page.tsx        Redirect → / (legacy route)
    favorites/             Favorites list
    learn/                 Learn hub, flashcards/, quiz/
    word/[id]/             Word detail (edit, practice, groups, delete; verb sections for verbs)
    login/                 Standalone auth screen (no shell chrome)
    settings/              Audio/theme/data/account/feedback
    admin/                 Back office UI (own layout + guard)
    api/admin/             Server route handlers (service-role)
    api/ai/                AI routes for signed-in users (Groq word extraction)
    layout.tsx             Root layout: fonts, theme script, AppShell
    globals.css            Tailwind v4 theme tokens (light + .dark)
    icon.svg               Favicon (Next.js file convention)
  components/
    app-shell.tsx          Bottom nav, auth gate, splash orchestration, SW registration
    ui.tsx                 Primitives: Button, Card, Input, Switch, Segmented, Sheet, Collapsible…
    …                      Feature components (word-row, mini-player, verb-details, splash, …)
  lib/
    types.ts               All shared types + article color maps
    db.ts                  Dexie schema v2, mutation hooks (uid/dirty), remote-write guard
    words.ts               Word CRUD, bulk add + enrichment, import/export, search
    dictionary.ts          Lookup pipeline + Wiktionary wikitext parser
    seed-dictionary.ts     ~300 common A1/A2 words bundled for offline
    sync.ts                Push/pull/merge engine + default-group seeding
    auth.ts / supabase.ts  Session store / lazy client (null when unconfigured)
    ocr.ts                 On-device OCR (Tesseract.js, German) for photo scans
    ai.ts                  Client for /api/ai/extract-words (null on failure = use fallback)
    player.ts              Playlist engine + Media Session
    tts.ts / speech.ts     Speech synthesis / recognition scoring
    keepalive.ts           Silent-audio loop for background playback
    diag.ts                Playback event log (hidden UI: 7 taps on Settings footer)
    learn.ts               Learn sources + quiz question builder
    verbs.ts               Verb engine: present conjugation, Perfekt + sein/haben, grammar data
    settings.ts            localStorage settings store + theme application
    admin/server.ts        requireAdmin + service client (server only)
    admin/client.ts        adminFetch + admin row types
public/
  manifest.webmanifest, sw.js (hand-written service worker), icon.svg
  ocr/                      Tesseract worker/wasm/German model (copied on postinstall)
scripts/
  copy-ocr-assets.mjs       Copies Tesseract assets into public/ocr (postinstall)
supabase/
  schema.sql, admin-schema.sql   Run manually in Supabase SQL Editor
docs/                       Architecture, decisions, deployment, testing
```

## Coding conventions

- **State stores**: module-level state + `useSyncExternalStore` (see `settings.ts`, `player.ts`, `auth.ts`, `sync.ts`). No Redux/Zustand.
- **DB access**: components read via `useLiveQuery`; writes go through helpers in `words.ts` where side effects (outbox tombstones, sync scheduling) matter. Never mark rows dirty when applying remote data — wrap in `withRemoteWrites()`.
- **Styling**: Tailwind utility classes referencing semantic tokens (`bg-surface`, `text-muted`, `bg-primary-soft`…) defined in `globals.css`. Dark mode = `.dark` class on `<html>` (set by inline script pre-hydration + `settings.ts`); **dark is the default** for users without saved settings. Never hardcode hex in components.
- **Client vs server**: everything under `src/app` (except `api/`) is client components (`"use client"`). Only `api/admin/*`, `api/ai/*` and `lib/admin/server.ts` run on the server.
- **ESLint is strict about React**: no synchronous `setState` in effect bodies (use timers/microtasks or restructure), no ref reads during render. `npm run lint` must be clean before committing.
- **Copy style**: user-facing text is friendly, concise, sentence case ("Add your first words", "Got it").
- **Word data**: `favorite` is `0 | 1` (Dexie can't index booleans). `groupIds` is a multiEntry index. German nouns are auto-capitalized in `buildWord`.
- After changing cached assets or fixing SW behavior, **bump `CACHE` in `public/sw.js`** (currently `vokabi-v13`) or clients keep the old version.

## Gotchas

- `speechSynthesis` on Android silently drops utterances queued right after `cancel()` — `tts.ts` has a watchdog/retry; don't "simplify" it away.
- The login gate only activates when Supabase env vars exist; local dev without `.env.local` runs ungated and local-only. That's intentional.
- `/api/` is deliberately excluded from service-worker caching (auth-dependent responses; see commit `e377d23`).
- The splash plays once per session (`sessionStorage` flag) and is removed pre-paint on reloads — don't reintroduce state that remounts `AppShell`.
- The `/groups` index route redirects to `/`; group detail `/groups/[id]`, `/favorites`, and `/all` are real pages.
- Every word must belong to a group: the Library page only shows group cards, so ungrouped words are invisible there. `ensureWordsGrouped()` (in `words.ts`) self-heals by re-homing orphans to "General"; it runs at startup, after sync pulls, and after group deletion. Don't create code paths that leave words ungrouped.
- The manifest `background_color` must match the dark theme background (`#0c0f1a`): Android's generated PWA launch screen uses it, and the in-app splash draws on that color, so they blend into one splash.
- Playback diagnostics UI is intentionally hidden: 7 taps on the Settings footer reveal it. The logging itself always runs.
- Supabase dashboard settings that matter and live outside the repo: Site URL (`https://vokabi.app`), redirect URLs, "Confirm email" disabled (built-in mailer has a very low hourly limit).
