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
   ├─ Auth: email/password + Google          ├─ en.wiktionary.org (gender,
   ├─ Postgres: words, groups                │   plural, IPA, definitions)
   │   feedback, announcements,              └─ api.mymemory.translated.net
   │   app_settings (server-only KV:             (translation fallback)
   │   Groq key/model),
   │   preset_groups (admin-curated,
   │   read-only for signed-in users)
   └─ Row-level security per user           External APIs (server-fetched)
                                             └─ api.groq.com (vision: photo →
  Vercel (hosting)                               words; text: OCR cleanup)
   ├─ static client bundle + SSR shell
   ├─ /api/admin/* route handlers ── service-role key + ADMIN_EMAILS
   └─ /api/ai/* route handlers ───── any signed-in user; Groq key from app_settings
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

`splitWordList()` separates entries on newlines, semicolons, `/`, or a dash surrounded by spaces. Commas never split, so plural notes ("die Katze, -n") and example sentences stay one entry, and a bare dash never splits either ("E-Mail", the plural shorthand "-n").

**Preset groups** feed the same flow: the "New group" sheet (`components/new-group-sheet.tsx`) fetches admin-curated `preset_groups` rows via `lib/presets.ts` (direct Supabase read; RLS grants select to authenticated users), and picking one creates a plain local group and pushes its word list through `addWordsFromText()` — so preset words enrich, sync, and behave exactly like pasted words, with no lasting link to the preset ("already added" is detected by name). Presets flagged `is_default` in the back office skip the sheet entirely: after each successful sync pull, `seedDefaultPresetGroups()` (`lib/words.ts`) materializes any the account hasn't processed yet through the same copy pipeline. The localStorage record (`vokabi.seededPresets.<userId>`) maps each processed preset id to the uid of the group the seeding created, which makes the operation reversible: a user who deletes a default group doesn't get it re-seeded on that device, and when the admin unflags or deletes the preset the next seeding pass removes the created group again (via `deleteGroupAndWords()`, so words shared with other groups survive), with the deletion syncing to the account's other devices.

**Photo scan** feeds the same flow. The in-app camera (`components/camera-capture.tsx`, so Android doesn't kill the PWA while a system camera is open) or a picked file is decoded and downscaled once (`lib/image.ts`, ≤1600px, EXIF-safe), then goes vision-first:

```
photo → downscale on canvas (lib/image.ts, shared with OCR)
      → JPEG data URL → POST /api/ai/extract-words-image (Groq vision model,
                          key + model from app_settings): reads the vocabulary
                          straight off the photo, incl. handwriting
        ↳ on ANY failure (no key, signed out, Groq down, timeout, empty result),
          fall back to the previous pipeline:
          Tesseract.js on-device (German model, assets self-hosted under /ocr/,
          cached offline after first download)
          → raw text → POST /api/ai/extract-words (Groq text model):
                         fixes OCR misreadings, keeps articles/sentences, drops noise
                       ↳ on ANY failure: heuristic fallback (confidence filter,
                         letter-ratio filter, hyphenation joining) in lib/ocr.ts
      → detected words land in the add-words textarea for review
```

The AI steps are server-side only (`lib/ai.ts` returns `null` on failure so callers fall back); the Groq key never reaches the client. Local-only and signed-out scans skip both uploads and stay fully on-device.

Scans are capped at **40 word entries and 20 sentence entries**, counted separately. The caps and the word-vs-sentence classifier (`isSentence`: four or more tokens, or a short entry ending in sentence punctuation) live in `lib/scan-rules.ts`, a pure module imported by both the AI routes (prompt limits + parse truncation) and the add-words sheet (which reports which limit a too-busy photo exceeded).

### 2. Sync (lib/sync.ts)

Dexie hooks in `db.ts` stamp every local mutation with `uid` (UUID) and `dirty: 1`, and notify the sync engine (debounced 2.5 s). `syncNow()` runs, in order:

1. **Account switch check** — a different user logging in wipes the previous account's *synced* rows (dirty/never-synced rows survive and upload to the new account)
2. **Push deletions** — outbox tombstones → `DELETE where uid in (…)`
3. **Push dirty groups**, then **dirty words** (local numeric `groupIds` are translated to group `uid`s for the wire; `favorite` 0/1 ↔ boolean)
4. **Pull everything** — groups first (build uid→local-id map), then words; per row **last-write-wins**: local wins only if still dirty *and* newer
5. **Reconcile** — local non-dirty rows whose uid vanished remotely were deleted on another device → delete locally
6. **Seed & self-heal** — if zero groups exist after the pull, create "General"; then `ensureWordsGrouped()` re-homes any words left without a group (a deleted group, or group references that didn't resolve in the merge) to General, since the Library page only shows group cards and ungrouped words would be invisible. The same routine runs at app start (local-only mode) and after group deletion

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
- The login page offers email/password and Google. Google uses `supabase.auth.signInWithOAuth` (full-page redirect to Google and back to `/login`); the returning session is consumed from the URL by the Supabase client and lands through the same `onAuthStateChange` listener, so gating and sync-on-login need no special casing. The provider must be enabled in the Supabase dashboard with a Google Cloud OAuth client
- The splash plays fully once per session (`sessionStorage`), and on reloads is removed pre-paint (layout effect) so navigation never flashes it
- `/admin` bypasses the shell entirely — it has its own layout and server-verified guard

### 5. Verb details (lib/verbs.ts)

The word detail screen shows verb-specific sections (example sentence, Perfekt, present conjugation, grammar) for words with `pos: "verb"`. Everything is **computed at render time on-device** — nothing is stored or synced:

- A rule-based conjugator handles any infinitive: stem endings (`arbeitest`), sibilant stems (`du heißt`), `-eln` verbs (`ich sammle`), separable prefixes (`ich stehe auf`), reflexives (`ich freue mich`), and Perfekt derivation (ge-/no-ge, `-ieren`, inseparable prefixes) with sein/haben auxiliaries
- A curated table (~100 common A1–B1 verbs) supplies irregular forms, strong participles, natural example sentences, required prepositions/cases, and language levels
- Verbs outside the table still get a full conjugation and Perfekt, but no example/level unless the user adds one

### 6. Admin (src/app/api/admin/*, lib/admin/server.ts)

Every route handler calls `requireAdmin(req)`:
bearer token from the client session → verified via service-role `auth.getUser(token)` → email checked against `ADMIN_EMAILS`. Returns 501 when unconfigured, 401/403 on failures. The service-role client bypasses RLS, which is exactly why it exists only in server code. The client (`lib/admin/client.ts` → `adminFetch`) attaches the session token to every call. When the server rejects that token (401), the admin layout signs out locally before redirecting to `/login`: a session can look valid client-side (unexpired JWT in storage) yet be rejected server-side, for example after a Supabase key rotation, and without the local sign-out the login page would see the stored session and bounce right back.

The back office UI (`/admin`) is a desktop sidebar layout (mobile: top bar with scrollable tabs, plus a light/dark theme toggle shared with the app's setting) with sections for Users, Feedback, Announcements, **Preset groups**, Email, and **System settings**. Preset groups are curated word lists stored in the `preset_groups` table: admin routes handle create/update/delete (words normalized server-side: trimmed, deduped, capped), while an RLS select policy lets any signed-in user read them from the app. Each preset carries an `is_default` flag (star toggle on the row, switch in the create form): default presets are seeded into every user's library automatically on the client (see "Preset groups" above). System settings manages the Groq API key plus the text and vision model ids in the `app_settings` table: a plain key/value table with RLS enabled and deliberately **no policies**, so only the service role can touch it. Storing the key in the database (instead of an env var) means it can be added, rotated, or removed from the UI without a redeploy.

### 7. AI routes (src/app/api/ai/*)

Two non-admin server routes accept requests from **any signed-in user** (bearer token verified via the service-role client, no allowlist) and share their plumbing in `src/app/api/ai/_shared.ts` (auth, `app_settings` read, Groq call, word-list parsing). `/api/ai/extract-words-image` takes a downscaled JPEG data URL and asks the configured vision model (default Llama 4 Scout, key `groq_vision_model`) for a JSON list of vocabulary entries read straight off the photo. `/api/ai/extract-words` takes raw OCR text and asks the text model (default Llama 3.3, key `groq_model`) to clean it up. Both run at temperature 0 with capped input and output, 25/20-second timeouts, prompts forbidding invented words, and per-kind entry caps (40 words / 20 sentences, shared with the client via `lib/scan-rules.ts`). Every failure mode returns a non-200 status; the client helpers (`lib/ai.ts`) convert any of them to `null`, which callers treat as "use the next fallback" (vision → on-device OCR + text cleanup → heuristics). This means AI outages degrade the scan quality, never break the feature.

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
- Photo scan is vision-first (Groq vision model on the downscaled photo), with on-device OCR (Tesseract.js, self-hosted assets) + AI text cleanup + heuristic detection as the automatic fallback chain
- Groq key and model ids server-held in `app_settings` (admin-editable, no redeploy); the key never reaches the client

## Known gaps / undocumented areas

Flagged honestly for future work:

- **No automated tests** (see `docs/TESTING.md`)
- **No error monitoring** (Sentry etc.) — client errors are invisible in production
- **No analytics/telemetry** — usage is unknown beyond Supabase table sizes
- **Settings are per-device** (localStorage), deliberately not synced — undocumented in the UI
- Wiktionary/MyMemory are called client-side without keys; their rate limits are unenforced and failures degrade to "notfound" silently (a "Retry lookups" button exists in Settings)
- The `/api/ai/*` routes (`extract-words`, `extract-words-image`) have no per-user rate limiting: any signed-in user can spend the Groq quota (free tier is generous; revisit if usage grows)
- `{{de-noun}}` plural parsing is best-effort; unusual template forms yield no plural
- No in-app "forgot password" flow — resets are triggered from the back office or the Supabase dashboard
- Supabase dashboard configuration (Site URL, redirect URLs, email confirmation off) lives outside the repo with no infrastructure-as-code
