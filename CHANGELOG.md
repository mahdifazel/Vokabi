# Changelog

All notable changes to Vokabi are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Export/import now round-trips groups.** CSV exports gain a `groups` column (names separated by `|`) and JSON exports carry group names per word plus the full group list, so empty groups survive too. Importing (the file picker now also accepts `.json`) creates any groups that don't exist yet, matched case-insensitively by name, and files every word into its groups; words without group info fall back to the previous behavior. JSON exports no longer include device/sync internals (`uid`, `dirty`, local ids)

- **Default preset groups.** Presets can be flagged as default in the back office (star toggle on the row, switch in the create form); after a sync pull the app seeds unseen default presets into the user's library as normal groups, and unflagging or deleting the preset removes the seeded group again on the next pass (words shared with other groups are kept). Processed preset ids and the created group uids are tracked per account in localStorage, so removal never touches a user's own groups and a user-deleted default group stays deleted on that device. Requires the new `is_default` column (rerun `supabase/admin-schema.sql`)

### Changed

- **Group membership moved into the word edit sheet.** The word detail page no longer shows the full group chip list; the Groups selector now lives in the edit sheet (below Article) and is saved together with the other fields via Save changes. A word saved with no groups is re-homed to General so it stays visible in the library

## [1.5.0] - 2026-07-12

### Added

- **Google sign-in** - a "Continue with Google" button on the login page (Supabase OAuth redirect flow). Requires enabling the Google provider in the Supabase dashboard with a Google Cloud OAuth client; a Google sign-in with the same verified email is linked automatically to an existing email/password account. OAuth errors surface in the login form's message box
- The Vokabi logo is served as static assets at `/vokabi-logo.svg` and `/vokabi-logo.png` (512px, transparent-corner render of the app mark)
- Google Search Console ownership verification file at `/google1d97262e1371303f.html` (must stay in place; Google re-checks it)

### Changed

- **Photo scans accept up to 40 words**; sentences keep their previous limit of 20. The two kinds are counted separately with a shared classifier (`lib/scan-rules.ts`: four or more tokens, or a short entry with sentence punctuation, counts as a sentence), the AI routes prompt for and truncate to the per-kind caps, and the scan error message says which limit was exceeded
- **Commas no longer split pasted text into separate words**, so entries like "die Katze, -n" and sentences containing commas stay whole. Entries are separated by newlines, semicolons, `/`, or a dash surrounded by spaces (a bare dash never splits, protecting "E-Mail" and the plural shorthand "-n"); the add-words sheet explains the separators

## [1.4.0] — 2026-07-12

### Changed

- **Photo scan is now vision-first** — the scanned photo (downscaled, as a JPEG) goes straight to a Groq vision model via the new `/api/ai/extract-words-image` route, which reads the vocabulary directly off the image, including handwriting. If that is unavailable for any reason (signed out, no key, Groq down, timeout) the previous pipeline runs unchanged as fallback: on-device Tesseract OCR → Groq text cleanup → heuristic line detection. Local-only and offline scans stay fully on-device. The vision model id is configurable in the back office under System settings (new `groq_vision_model` app setting, default Llama 4 Scout), and Test connection now checks both models

## [1.3.0] — 2026-07-11

### Added

- **Preset groups** — the back office has a new Manage → Preset groups section for curating ready-made groups with optional word lists (create, inline edit, two-tap delete). In the app, **New group** now offers two paths: *Create my own* (the classic name form) or *Choose a ready-made group* — a searchable browser (matches names and the words inside) with colored tiles, word previews, one-tap add, and "already added" detection. Adding a preset creates a regular local group and enriches its words through the normal pipeline. New `preset_groups` table in `supabase/admin-schema.sql` (service-role writes, authenticated read) — re-run that file in the Supabase SQL Editor when upgrading
- **Group deletion choice** — deleting a non-empty group now asks whether to keep its words in the library (re-homed to General) or delete them too; words that also belong to other groups are never deleted, only detached
- **Back office light/dark toggle** — sun/moon switch in the sidebar footer (desktop) and top bar (mobile), sharing the app's theme setting

### Changed

- **Design refresh** — Baloo 2 display font for titles and sheet headers; soft der/die/das-tinted glows behind every page; group cards get stable per-group tile colors with a staggered reveal; gradient add-words button; slightly deeper card shadows
- **Animated bottom navigation** — inactive tabs show a centered icon; the active tab bounces its icon and slides the label in beside it with an underline animated to the label's width; Library now stays highlighted on its sub-pages (groups, favorites, all words)
- The add-words sheet's Paste and Scan actions are now prominent full-width buttons ("Paste text" / "Scan photo") instead of small text links
- Focused inputs show a tinted border with a soft glow instead of a heavy offset outline; the floating + button casts a lighter shadow

## [1.2.0] — 2026-07-10

### Added

- **Photo scan** — add words by pointing the camera at a book page or list (or picking a photo). Recognition runs fully on-device with Tesseract.js (German model, assets served same-origin from `/ocr/`, offline after the first download). An in-app camera is used so Android doesn't kill the PWA while the system camera is open
- **AI vocabulary identification** — the raw OCR text is analyzed by Groq (Llama 3.3) via the new `/api/ai/extract-words` route: it fixes OCR misreadings, keeps der/die/das articles, keeps sentences intact, and drops noise. When AI is unavailable for any reason (no key, signed out, Groq down, timeout) the app silently falls back to the previous heuristic line detection
- **Back office redesign** — professional left sidebar on desktop with grouped navigation (Manage / Communication / System), page headers, signed-in admin shown in the footer; sticky top bar with scrollable tabs on mobile
- **System settings** (`/admin/settings`) — store the Groq API key and model server-side (new `app_settings` table, service-role only, added to `supabase/admin-schema.sql`), with show/hide, test connection, and remove-key actions
- **Playback diagnostics** — a persistent event log for debugging screen-off audio on real devices, hidden behind 7 taps on the Settings footer

### Changed

- The add-words sheet preselects the first group when opened from the Library page, so the Add button works without an extra tap
- Deleting a group moves its words to **General** instead of leaving them ungrouped and invisible on the Library page; a self-healing routine (startup, after sync, after group deletion) re-homes any ungrouped words
- The Android PWA launch screen now uses the dark splash background color instead of light gray, so launching flows straight into the splash
- Screen-off playback hardening: the audio session is claimed at play time, the keep-alive loop satisfies Chrome's audibility detector, and the current word is held and retried when Android kills TTS at screen lock
- Service worker cache bumped to `vokabi-v13`

### Fixed

- Words without any group were invisible on the Library page (only reachable via All words and search); they are now automatically placed in General
- A login session the server no longer accepts (e.g. created before a Supabase key rotation) dead-ended the back office: `/admin` redirected to `/login`, which saw the client-side session and bounced straight back. A rejected session is now signed out locally first, so the login form appears and one sign-in recovers everything

## [1.1.0] — 2026-07-09

### Added

- **Verb details on the word screen** — for words tagged as verbs: a natural example sentence with English translation and TTS playback, the Perfekt form with its sein/haben auxiliary, a collapsible present-tense conjugation table (ich/du/er·sie·es/wir/ihr/sie·Sie), and a collapsible grammar section (verb type, required preposition, required case, language level). Powered by a new on-device verb engine (`lib/verbs.ts`): rule-based conjugation for any infinitive (separable prefixes, reflexives, stem rules) plus curated data for ~100 common A1–B1 verbs
- `Collapsible` accordion primitive in `components/ui.tsx`

### Changed

- **Player redesign** — the mini-player is now a full card: the word being read is shown large and fully wrapped (no truncation) with its English translation beneath, controls are centered below it, and the close button sits top-right
- **Simpler groups UX** — the "All words" card is hidden when only one group exists; the add-words sheet skips the group picker with a single group (auto-assigns) and requires at least one selected group when there are several
- **Anna is the preferred German voice on iOS/macOS** (auto-pick and voice list ordering)
- **Dark mode is the default theme** for first-time users (previously followed the system)
- Service worker cache bumped to `vokabi-v6`

## [1.0.0] — 2026-07-09

Initial release at [vokabi.app](https://vokabi.app).

### Added

**Vocabulary management**
- Bulk word adding: paste one word or an entire list; leading articles ("das Haus") are detected and split
- Automatic dictionary enrichment: article, English translation, plural, IPA, part of speech — resolved via a bundled ~300-word A1/A2 seed dictionary, then en.wiktionary.org (wikitext parsing for gender, plural, IPA, definitions), then MyMemory translation fallback; results cached in IndexedDB with TTLs
- Library home with group cards (All words, Favorites, user groups) and instant global search across German, English, plural, and article
- Default **General** group seeded for new accounts; the add-words sheet preselects it
- Groups: create, rename, delete (words are detached, not deleted); words can belong to multiple groups
- Favorites via heart toggle, acting as their own collection
- Word detail: edit all fields (article, translation, plural, examples, notes), group membership, slow playback, delete
- Import from TXT/CSV (with or without translations, header detection); export to CSV and JSON
- Gender color coding throughout: blue der, rose die, green das

**Audio**
- Native German TTS via the Web Speech API with best-voice auto-selection and a manual voice picker
- Android reliability layer: watchdog retry for dropped utterances, forced resume, hard timeout
- Playlist engine honoring settings: speed 0.5–1.5×, pause 0–5 s, repeat 1–5×, read article, read translation, shuffle, endless auto-repeat
- Floating mini-player with previous/pause/next/stop
- Screen-off playback: near-silent keep-alive audio loop exempts the tab from background suspension
- Media Session integration: lock-screen/notification controls showing the current word and translation

**Learning**
- Pronunciation practice: speech recognition (de-DE) scored with Levenshtein similarity; Excellent/Good/Needs-improvement rating and per-letter mistake highlighting (LCS diff)
- Flashcards: 3D flip cards with pronunciation, swipe/tap grading, progress bar, end summary, retry-missed round
- Quiz: multiple choice with three question types (German→English, English→German, der/die/das), audio feedback, score and review list

**Accounts & sync**
- Email/password authentication (Supabase); login required when cloud is configured, with a standalone login page
- Offline-first sync engine: UUID identity, dirty-flag push, tombstoned deletions via outbox, full pull with last-write-wins merge, group-reference translation between devices, account-switch data swap
- Postgres row-level security: every user sees only their own rows
- Graceful local-only mode when Supabase env vars are absent

**PWA & polish**
- Installable PWA: manifest, hand-written offline-first service worker (network-first navigations, cache-first static assets, API responses never cached)
- Custom logo ("the bubble speaks V"): app icon, favicon, in-app brand marks
- Cinematic once-per-session splash screen (gradient wash, aurora blobs, particles, glow logo reveal) honoring `prefers-reduced-motion`
- Dark / light / system theme with pre-hydration script to prevent flash
- Announcement banner shown to signed-in users, dismissible per device

**Back office (`/admin`)**
- Server-side admin API guarded by an `ADMIN_EMAILS` allowlist and the Supabase service-role key
- User management: searchable list with word/group counts, detail view with recent words and feedback, ban/unban, delete user + data, send password-reset email
- Feedback inbox (users submit from Settings) with new/read/resolved statuses
- Announcements: publish/toggle/delete in-app banners
- Email broadcast to all users via Resend, with copy-all-addresses fallback when unconfigured

### Security
- Service worker excludes `/api/` from caching so per-user admin responses can never leak between accounts on a shared device
- Admin authorization enforced server-side on every request (bearer token verification + allowlist)

[Unreleased]: https://github.com/mahdifazel/Vokabi/compare/v1.3.0...HEAD
[1.3.0]: https://github.com/mahdifazel/Vokabi/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/mahdifazel/Vokabi/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/mahdifazel/Vokabi/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/mahdifazel/Vokabi/releases/tag/v1.0.0
