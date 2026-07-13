# Vokabi — German Vocabulary Trainer

**Live at [vokabi.app](https://vokabi.app)**

A mobile-first Progressive Web App for learning German vocabulary. Paste words, get automatic articles/translations/plurals, hear native pronunciation (even with the screen off), practice speaking with instant feedback, and train with flashcards and quizzes. Offline-first with per-user cloud sync.

## Features

- **Bulk word adding** — paste one word or a whole list, one per line or separated by `/` or a spaced `-`; `das Haus`-style articles are detected automatically, and commas stay part of the entry so plural notes like `die Katze, -n` and full sentences survive
- **Photo scan** — point the camera at a book page or word list (or pick a photo); a Groq vision model (Qwen 3.6) reads the vocabulary straight off the photo, including handwriting. When AI is unavailable or rate-limited the scan falls back automatically to on-device Tesseract.js OCR with Groq text cleanup, and finally to heuristic detection — and says so, so degraded results are never silent. It always works, even offline. Each scan accepts up to 40 words and 20 sentences
- **Automatic dictionary** — article (🔵 der / 🔴 die / 🟢 das), English translation, plural, IPA, and part of speech via a bundled ~300-word offline seed dictionary → Wiktionary → translation-API fallback, cached in IndexedDB
- **Native pronunciation** — best available German system voice (Google natural voices on Android, Anna on iOS), voice picker, 0.5–1.5× speed, slow-play button
- **Listening playlists** — play a group with configurable pause (0–5 s), repeat count (1–5×), read-article and read-translation toggles, shuffle, endless loop; a floating player card shows the current word in large type with its translation and centered controls
- **Verb details** — verbs get an example sentence (with playback), the Perfekt with its sein/haben auxiliary, a collapsible present-tense conjugation table, and grammar details (verb type, preposition, case, level)
- **Screen-off playback** — audio keeps playing when the phone is locked, with lock-screen media controls (current word, play/pause/next/prev)
- **Pronunciation practice** — speak the word, get *Excellent / Good / Needs improvement* with mistake letters highlighted (speech recognition)
- **Flashcards** — 3D flip cards, swipe right = got it / left = still learning, retry-missed rounds
- **Quiz** — multiple choice: German→English, English→German, and der/die/das article questions with audio feedback
- **Organization** — groups (with a default **General** group), favorites, instant global search, word details with examples and notes (group membership is edited in the word's edit sheet); "New group" offers a custom name or a searchable list of **ready-made groups** curated in the back office (added with their words in one tap), and presets flagged **default** appear in every user's library automatically; deleting a group lets you keep its words or delete them too (words shared with other groups are never deleted)
- **Import / export** — TXT/CSV/JSON import, CSV/JSON export; both formats carry group membership, so importing on another account recreates missing groups and files every word into the right ones
- **Accounts & sync** — email/password or Google login (Supabase); words sync across devices, protected by Postgres row-level security; offline-first so everything works without a connection
- **PWA** — installable on Android, offline service worker, dark (default)/light/system theme, cinematic once-per-session splash
- **Admin back office** (`/admin`) — sidebar layout with light/dark toggle, user management (ban/delete/reset password), feedback inbox, announcement banners, preset groups (curated word lists users can add from the app; those flagged default are seeded into every library and removed again when unflagged), email broadcast, and System settings (Groq AI key plus vision/text model ids, stored server-side and editable without a redeploy)

## Prerequisites

- **Node.js 18+** (developed on Node 24) and npm
- Optional, for accounts/sync/admin: a free [Supabase](https://supabase.com) project
- Optional, for admin email broadcasts: a [Resend](https://resend.com) account
- Optional, for AI-assisted photo scanning: a free [Groq](https://console.groq.com) API key (entered in the back office, not an env var)

## Installation

```bash
git clone https://github.com/mahdifazel/Vokabi.git
cd Vokabi
npm install
npm run dev            # http://localhost:3000
```

Without any configuration the app runs in **local-only mode** (no login, data stays on the device).

### Enable accounts & cloud sync

1. Create a Supabase project at [database.new](https://database.new)
2. In the Supabase **SQL Editor**, run `supabase/schema.sql`, then `supabase/admin-schema.sql`
3. In **Authentication → URL Configuration**, set the Site URL to your domain; in **Sign In / Providers → Email**, consider disabling "Confirm email" (the built-in mailer is heavily rate-limited)
4. Create `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...        # anon/publishable key
# back office (optional):
SUPABASE_SERVICE_ROLE_KEY=eyJ...            # service_role key — keep secret
ADMIN_EMAILS=you@example.com
# admin email broadcasts (optional):
RESEND_API_KEY=re_...
EMAIL_FROM="Vokabi <hello@yourdomain.com>"
```

5. Restart the dev server. The app now requires login; sign up with an email listed in `ADMIN_EMAILS` to get the **Back office** button in Settings.
6. Optional, for AI photo scanning: open **Back office → System settings** and save your Groq API key (get one free at [console.groq.com](https://console.groq.com)). With it, scanned photos are read by a Groq vision model; without it, photo scans still work using on-device OCR with heuristic word detection.
7. Optional, for **Google sign-in**: create a Google OAuth client and enable the Google provider in Supabase (see [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)). Without it the login page offers email/password only.

For production deployment see [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Usage

- **Add words**: tap **+** on the Library page and paste, e.g.:
  ```
  Haus
  der Baum
  Schmetterling
  ```
  Articles, translations, plurals, and IPA appear automatically a few seconds later.
- **Scan words**: in the add sheet tap **Scan photo** → point the camera at the page (or pick from the gallery). The detected words land in the text box for review before adding.
- **Add a ready-made group**: **New group** → **Choose a ready-made group** → search and tap one; it lands in your library with all its words.
- **Listen**: open a group → **Play group**. Tune speed, pauses, repeats, and article/translation reading in **Settings → Audio**. Lock the phone — playback continues.
- **Practice speaking**: open a word → 🎤 **Practice** → say the word → get graded feedback.
- **Train**: **Learn** tab → pick a source → **Flashcards** or **Quiz**.
- **Install on Android**: open vokabi.app in Chrome → menu → **Add to Home screen**.

## Project documentation

- [`CLAUDE.md`](CLAUDE.md) — developer/AI onboarding: stack, conventions, gotchas
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — system design and data flow
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — why key technical choices were made
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — deploying to production
- [`docs/TESTING.md`](docs/TESTING.md) — verification strategy
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — how to contribute
- [`CHANGELOG.md`](CHANGELOG.md) — release history

## License

**No license has been chosen yet** — the code is currently "all rights reserved" by default. If you intend to open-source Vokabi, add a `LICENSE` file (MIT is the common choice for projects like this).
