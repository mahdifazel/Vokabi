# Changelog

All notable changes to Vokabi are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

- Nothing yet.

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

[Unreleased]: https://github.com/mahdifazel/Vokabi/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/mahdifazel/Vokabi/releases/tag/v1.0.0
