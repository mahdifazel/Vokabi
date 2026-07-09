# Vokabi Architecture

## System overview

Vokabi is an **offline-first, client-heavy PWA** with a thin server layer used only for administration. There are four cooperating systems:

```
┌─────────────────────────── Browser (client) ────────────────────────────┐
│                                                                          │
│  Next.js App Router pages (all "use client")                             │
│        │ useLiveQuery (reactive reads)                                   │
│        ▼                                                                 │
│  Dexie / IndexedDB  ◄── source of truth on-device                        │
│   ├─ words      (uid, dirty, groupIds[], favorite, dictionary fields)    │
│   ├─ groups     (uid, dirty, name)                                       │
│   ├─ dictCache  (cached online lookups, TTL)                             │
│   └─ outbox     (tombstones for deletions awaiting cloud sync)           │
│        │                                                                 │
│        ▼ push dirty / pull all (lib/sync.ts)                             │
└────────┼─────────────────────────────────────────────────────────────────┘
         ▼
  Supabase (cloud)                          External APIs (client-fetched)
   ├─ Auth: email/password sessions          ├─ en.wiktionary.org (gender,
   ├─ Postgres: words, groups                │   plural, IPA, definitions)
   │   feedback, announcements               └─ api.mymemory.translated.net
   └─ Row-level security per user                (translation fallback)

  Vercel (hosting)
   ├─ static client bundle + SSR shell
   └─ /api/admin/* route handlers ── service-role key + ADMIN_EMAILS
```

## Folder structure

See `CLAUDE.md` → *Directory structure* for the annotated tree. The rule of thumb:

- `src/app/**` — one folder per route; everything except `api/` is a client component
- `src/components/**` — shared UI; `ui.tsx` holds the design-system primitives
- `src/lib/**` — all logic; components stay thin and call into these modules
- `public/sw.js` — hand-written service worker (no Workbox/next-pwa)
- `supabase/*.sql` — cloud schema, applied manually in the SQL Editor

## Data flow

### 1. Adding words

```
paste text → splitWordList() → rows inserted with status:"pending" (UI shows instantly)
           → background enrichment (concurrency 3):
               seed dictionary (in-memory Map, ~300 words)
               → dictCache (IndexedDB, 90-day TTL, 7-day miss TTL)
               → Wiktionary action API (parse wikitext: ==German== section,
                 {{de-noun}} gender/plural, {{IPA|de|…}}, "# " definitions)
               → MyMemory translation fallback
           → row updated to status:"ready" | "notfound" → useLiveQuery re-renders
```

Duplicate words are merged into existing rows (group membership union) rather than re-inserted.

### 2. Sync (lib/sync.ts)

Dexie hooks in `db.ts` stamp every local mutation with `uid` (UUID) and `dirty: 1`, and notify the sync engine (debounced 2.5 s). `syncNow()` runs, in order:

1. **Account switch check** — a different user logging in wipes the previous account's *synced* rows (dirty/never-synced rows survive and upload to the new account)
2. **Push deletions** — outbox tombstones → `DELETE where uid in (…)`
3. **Push dirty groups**, then **dirty words** (local numeric `groupIds` are translated to group `uid`s for the wire; `favorite` 0/1 ↔ boolean)
4. **Pull everything** — groups first (build uid→local-id map), then words; per row **last-write-wins**: local wins only if still dirty *and* newer
5. **Reconcile** — local non-dirty rows whose uid vanished remotely were deleted on another device → delete locally
6. **Seed default group** — if zero groups exist after the pull, create "General"

Writes performed by the sync engine are wrapped in `withRemoteWrites()` so the Dexie hooks don't re-mark them dirty (which would echo forever). Triggers: login, app start, debounced local mutations, `online` event, manual "Sync now".

### 3. Audio playback (lib/player.ts, tts.ts, keepalive.ts)

```
startPlaylist(words, title)
  → keepalive: loop near-silent WAV (tab counts as "playing audio" →
     Android doesn't suspend it when the screen turns off)
  → Media Session: lock-screen metadata + play/pause/next/prev/stop handlers
  → loop per word (generation counter cancels stale loops):
       repeat × speak("der Haus…", de-DE, rate)   [tts.ts]
       optional english utterance (en-US)
       pause (0–5 s, chunked sleep so cancellation is responsive)
       auto-repeat / shuffle per settings
```

`tts.ts` hardens `speechSynthesis` for Android Chrome: resume-before-speak, a watchdog that re-queues silently dropped utterances once, and a hard timeout so a lost `onend` can't hang the playlist.

### 4. Auth gating (components/app-shell.tsx)

- `cloudConfigured()` false → no gate, local-only mode (dev convenience)
- Otherwise: session restoring → cinematic splash covers the screen; restored & signed out → redirect to `/login`; signed in → app renders and `syncNow()` fires
- The splash plays fully once per session (`sessionStorage`), and on reloads is removed pre-paint (layout effect) so navigation never flashes it
- `/admin` bypasses the shell entirely — it has its own layout and server-verified guard

### 5. Verb details (lib/verbs.ts)

The word detail screen shows verb-specific sections (example sentence, Perfekt, present conjugation, grammar) for words with `pos: "verb"`. Everything is **computed at render time on-device** — nothing is stored or synced:

- A rule-based conjugator handles any infinitive: stem endings (`arbeitest`), sibilant stems (`du heißt`), `-eln` verbs (`ich sammle`), separable prefixes (`ich stehe auf`), reflexives (`ich freue mich`), and Perfekt derivation (ge-/no-ge, `-ieren`, inseparable prefixes) with sein/haben auxiliaries
- A curated table (~100 common A1–B1 verbs) supplies irregular forms, strong participles, natural example sentences, required prepositions/cases, and language levels
- Verbs outside the table still get a full conjugation and Perfekt, but no example/level unless the user adds one

### 6. Admin (src/app/api/admin/*, lib/admin/server.ts)

Every route handler calls `requireAdmin(req)`:
bearer token from the client session → verified via service-role `auth.getUser(token)` → email checked against `ADMIN_EMAILS`. Returns 501 when unconfigured, 401/403 on failures. The service-role client bypasses RLS, which is exactly why it exists only in server code. The client (`lib/admin/client.ts` → `adminFetch`) attaches the session token to every call.

## Key technical decisions

Summarized here; rationale in `docs/DECISIONS.md`:

- Offline-first with IndexedDB as source of truth; cloud is a replica
- UUID (`uid`) identity for sync; local auto-increment ids never leave the device
- Hand-written service worker; `/api/` never cached (auth-dependent)
- Web Speech API (no TTS backend, no API keys, offline-capable voices)
- Verb conjugation computed on-device (rules + curated table), never stored or synced
- Module-store state via `useSyncExternalStore` instead of a state library
- Hand-rolled UI primitives in the shadcn idiom instead of the Radix dependency tree
- Admin authorization via env-var allowlist instead of a roles table

## Known gaps / undocumented areas

Flagged honestly for future work:

- **No automated tests** (see `docs/TESTING.md`)
- **No error monitoring** (Sentry etc.) — client errors are invisible in production
- **No analytics/telemetry** — usage is unknown beyond Supabase table sizes
- **Settings are per-device** (localStorage), deliberately not synced — undocumented in the UI
- Wiktionary/MyMemory are called client-side without keys; their rate limits are unenforced and failures degrade to "notfound" silently (a "Retry lookups" button exists in Settings)
- `{{de-noun}}` plural parsing is best-effort; unusual template forms yield no plural
- No in-app "forgot password" flow — resets are triggered from the back office or the Supabase dashboard
- Supabase dashboard configuration (Site URL, redirect URLs, email confirmation off) lives outside the repo with no infrastructure-as-code
