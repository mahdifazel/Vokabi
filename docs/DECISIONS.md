# Technical Decisions

Why Vokabi is built the way it is. Each entry: context → decision → trade-offs. Dates reference the git history (July 2026).

## 1. Offline-first: IndexedDB as source of truth

**Context:** A vocabulary trainer is used on commutes, in dead zones, abroad. The original spec demanded full offline support.
**Decision:** Dexie/IndexedDB holds all data; every screen reads it via `useLiveQuery`. The cloud is a per-user replica, not the primary store.
**Trade-offs:** Instant UI and true offline; but sync complexity lands on us (UUIDs, dirty flags, tombstones, LWW). Accepted because vocab data is small (hundreds of rows) and conflicts are rare for a personal dataset.

## 2. Sync design: UUID identity + dirty flags + full pull with LWW

**Context:** Dexie auto-increment ids differ per device, so rows need portable identity; deletions must propagate; two devices can edit offline.
**Decision:** Every row gets a `uid` (crypto.randomUUID) stamped by Dexie hooks; local mutations set `dirty: 1`; deletions are tombstoned in an `outbox` table; sync pushes dirty/deleted, then pulls **everything** and merges last-write-wins by `updatedAt`; local group ids are translated to uids on the wire.
**Trade-offs:** Full pull is O(dataset) per sync — wasteful for huge datasets, trivially fine for vocabulary scale, and it makes cross-device deletions reliable without change feeds. Rejected alternatives: CRDTs (overkill), incremental pull with change tracking (can't see remote deletions without extra bookkeeping).

## 3. Supabase for auth + storage

**Context:** "Users must log in and have their own words" — needed auth, a database, and per-user isolation, with zero server maintenance and a free tier.
**Decision:** Supabase email/password auth + Postgres with row-level security (`auth.uid() = user_id` policies on every table).
**Trade-offs:** Security is enforced *in the database*, so even a compromised client can't read others' data. Vendor lock-in is limited (plain Postgres). Rejected: Firebase (NoSQL modeling, heavier SDK), custom backend (maintenance cost).

## 4. Web Speech API for TTS — no audio backend

**Context:** "No robotic TTS" but also no API keys, no per-request costs, and offline playback.
**Decision:** `speechSynthesis` with best-voice auto-selection (Android ships Google's natural de-DE voices). `lib/tts.ts` is deliberately pluggable if a cloud TTS is ever wanted.
**Trade-offs:** Voice quality varies by device; Android Chrome has real bugs (utterances dropped after `cancel()`, paused wake-ups, lost `onend`) that required a watchdog/retry/hard-timeout layer. Accepted for zero cost + offline capability.

## 5. Screen-off playback: near-silent keep-alive audio + Media Session

**Context:** Users listen to word lists with the phone locked; Android suspends background tabs, killing speech synthesis and timers.
**Decision:** While a playlist plays, loop a programmatically generated near-silent WAV (`lib/keepalive.ts`) so the tab counts as audible media (exempt from suspension), and register Media Session metadata/handlers for lock-screen controls.
**Trade-offs:** It's the established web-app workaround, not an official API; aggressive OEM battery savers can still kill it. The definitive fix would be a TWA (Play Store app) — deferred.

## 6. Hand-written service worker; `/api/` never cached

**Context:** PWA offline support; later, a security incident where cached admin API responses leaked to another account on the same device.
**Decision:** A small explicit `public/sw.js` (network-first navigations, cache-first static assets) instead of Workbox/next-pwa; API routes are excluded from caching entirely; cache name is version-bumped manually (`vokabi-vN`) to invalidate.
**Trade-offs:** Manual cache-version bumps are easy to forget (documented in CLAUDE.md/CONTRIBUTING.md); in exchange the caching policy is fully auditable — which is how the admin-leak bug was found and fixed.

## 7. Dictionary pipeline: seed → cache → Wiktionary → MyMemory

**Context:** Automatic article/translation/plural/IPA lookup with no paid dictionary API, working offline for common words.
**Decision:** A bundled ~300-word seed dictionary for instant/offline hits; en.wiktionary.org wikitext parsing (one request yields gender, plural template, IPA, and English definitions); MyMemory as translation-only fallback; everything cached in IndexedDB (90-day TTL, 7-day retry for misses).
**Trade-offs:** Wikitext parsing is best-effort (notably `{{de-noun}}` plural forms); both APIs are unauthenticated with unknown rate limits. Words remain user-editable, which is the ultimate fallback.

## 8. Module stores + `useSyncExternalStore` instead of a state library

**Context:** Cross-cutting state (settings, player, auth, sync status) needed by distant components.
**Decision:** Plain module-level state with subscriber sets, exposed through `useSyncExternalStore` hooks.
**Trade-offs:** Zero dependencies, SSR-safe server snapshots, and the player loop can read/write state outside React (essential for the audio engine). Less tooling than Redux/Zustand — fine at this scale.

## 9. Hand-rolled UI primitives (shadcn idiom, no Radix)

**Context:** The spec named shadcn/ui; the app needs ~8 primitives, mobile-first.
**Decision:** `components/ui.tsx` implements Button/Card/Input/Switch/Segmented/Sheet in the same visual idiom with Tailwind tokens + Framer Motion, without the Radix dependency tree.
**Trade-offs:** Less a11y machinery than Radix (mitigated with explicit aria attributes); much smaller bundle and full control over mobile behavior (bottom sheets, touch targets).

## 10. Admin authorization: `ADMIN_EMAILS` env allowlist

**Context:** One (maybe a few) trusted admins; roles-in-database felt heavy.
**Decision:** Server route handlers verify the caller's JWT via the service-role client, then check the email against a comma-separated env allowlist. The service-role key exists only server-side.
**Trade-offs:** Adding an admin requires an env change + redeploy — acceptable at this scale. Client-side "is admin" checks exist purely for UI (showing the button); the server re-verifies every request.

## 11. Login required when cloud is configured; local-only otherwise

**Context:** Requirement: "no one can add words without logging in" — but development and self-hosting without Supabase should still work.
**Decision:** The auth gate activates only when `NEXT_PUBLIC_SUPABASE_*` exist. Configured deployments redirect signed-out visitors to `/login`; unconfigured builds run the original local-only experience.
**Trade-offs:** Two behavioral modes to keep in mind while developing; in exchange, no mock-auth complexity locally and the same codebase serves both modes.

## 12. Splash screen: once per session, removed pre-paint on reloads

**Context:** A branded 3-second intro was requested; Android reloads the PWA on app switches, which replayed it constantly (user complaint).
**Decision:** `sessionStorage` flag; on reloads a layout effect flips state before first paint and bypasses `AnimatePresence`, so the splash never renders at all. It still covers genuine session restores.
**Trade-offs:** Slightly intricate mounting logic (documented in code); the alternative — shortening the intro — would have degraded the intended first impression.

## 13. Default "General" group, seeded after first sync

**Context:** First-time users adding words with no groups yet would create invisible/orphaned-feeling words; the user explicitly wanted a default group.
**Decision:** After a successful pull (cloud mode) or on first launch (local mode), if zero groups exist, create "General". The add-words sheet hides the group picker entirely when only one group exists (words are auto-assigned to it); with several groups the user must select at least one. Likewise the Library hides the "All words" card while there's only one group, since it would duplicate it.
**Trade-offs:** Seeding *after* the pull avoids duplicate "General" groups across devices. Requiring an explicit selection with multiple groups adds one tap but prevents words landing in an unintended default.
**Update (July 2026):** a production user ended up with words in no group at all (invisible on the Library page, which only shows group cards). Now `ensureWordsGrouped()` self-heals: any ungrouped word is re-homed to General at startup, after every sync pull, and after group deletion; deleting a group therefore moves its words to General instead of detaching them into limbo. The add-words sheet also preselects the first group when opened from the Library page.

## 14. Verb details computed on-device (no verb API, nothing stored)

**Context:** The verb screen needs present conjugation, Perfekt with sein/haben, examples, and grammar facts — with no paid API, offline, and without touching the sync schema.
**Decision:** `lib/verbs.ts` derives everything at render time: a rule-based conjugator covers any infinitive (stem/sibilant/-eln rules, separable prefixes, reflexives, Perfekt formation), and a curated table of ~100 common A1–B1 verbs supplies irregular forms, example sentences, prepositions/cases, and levels. Results are never persisted or synced.
**Trade-offs:** Zero latency, fully offline, no DB/schema changes, and fixes to the engine instantly apply to every word. Uncommon verbs get correct-by-rule conjugation but no example or level (the user can add an example via Edit); truly exotic irregulars outside the table would need a table entry. Rejected: storing verb data per word (sync/schema churn, stale data) and calling a conjugation API (cost, latency, offline gap).

## 15. Photo scan: OCR on-device with Tesseract.js, assets self-hosted

**Context:** Users wanted to add words by photographing a textbook page. Requirements: no per-scan cost, works offline after setup, and the PWA must survive the process (Android kills backgrounded PWAs when the system camera opens).
**Decision:** Tesseract.js with the German model runs entirely in the browser; all runtime assets (worker, wasm, language data, ~5 MB once) are copied to `/ocr/` at postinstall and served same-origin, so repeat scans work offline. An in-app `getUserMedia` camera avoids leaving the app; photos are downscaled on a canvas before recognition (iOS memory limits, free EXIF rotation).
**Trade-offs:** On-device OCR is noticeably less accurate than cloud vision APIs, especially on handwriting and low light. Accepted for zero cost and offline capability, and later mitigated by the AI cleanup layer (decision 16). Rejected: cloud OCR APIs (cost, privacy, offline gap).

## 16. AI vocabulary extraction: server-held Groq key in the database, heuristics as fallback

**Context:** Raw OCR lines were too noisy to be reliable (misreadings, page numbers, headers mixed in). Filtering with rules alone plateaued. An LLM cleans this up well, but API keys must not ship to the client, and the operator wanted to manage the key without touching env vars or redeploying.
**Decision:** The Groq API key and model live in an `app_settings` key/value table (RLS on, zero policies, so service-role only) managed from the back office at `/admin/settings`. A single server route, `/api/ai/extract-words`, verifies any signed-in user's token, calls Llama 3.3 with temperature 0 and a prompt forbidding invented words, and returns a JSON word list. The client treats every failure (no key, signed out, timeout, Groq error, empty result) as `null` and falls back to the heuristic line detection, so the feature degrades in quality but never breaks.
**Trade-offs:** A DB read per scan and one more moving part vs. env vars, in exchange for key rotation from the UI. No per-user rate limiting yet, so signed-in users share the operator's Groq quota. Llama 3.3 on Groq was chosen for its free tier and speed; the model id is stored alongside the key so it can be swapped as Groq's lineup changes. Rejected: calling Groq from the client (key exposure) and vision-capable models on the image itself (larger payloads, the OCR text path is cheaper and auditable).
