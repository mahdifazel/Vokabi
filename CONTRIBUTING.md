# Contributing to Vokabi

Thanks for helping improve Vokabi! This guide reflects how the project is actually built — read `CLAUDE.md` first for stack details and gotchas.

## Dev environment setup

1. **Node.js 18+** (developed on Node 24) and npm
2. ```bash
   git clone https://github.com/mahdifazel/Vokabi.git
   cd Vokabi
   npm install
   npm run dev
   ```
3. No configuration is required for UI work — the app runs local-only without env vars.
   For auth/sync/admin work, create `.env.local` (see `README.md` → *Enable accounts & cloud sync*). Never commit `.env*` files — they are gitignored.
4. To test PWA behavior (service worker, offline, install prompt) you must use a **production build**: `npm run build && npm start`. The service worker does not register in dev mode.
5. Mobile testing: run the dev server, then open `http://<your-LAN-IP>:3000` on a phone on the same Wi-Fi. Note that microphone (pronunciation practice) requires HTTPS or localhost, so speech features need the deployed site or a tunnel.

## Branch naming

Day-to-day work happens on the `dev` branch, which auto-deploys a preview; `dev` is merged into `main` (production) only after review. For contributions, branch from `main` using:

```
feature/<short-description>     # new functionality      e.g. feature/spaced-repetition
fix/<short-description>         # bug fixes              e.g. fix/tts-android-drop
docs/<short-description>        # documentation only
chore/<short-description>       # tooling, deps, cleanup
```

## Commit message format

Follow the style used throughout the history (`git log` is the reference):

```
<imperative summary line, sentence case, no trailing period>

<optional body: what and why, wrapped paragraphs or "- " bullets;
mention user-visible behavior and any tricky rationale>
```

Examples from the repo:
- `Fix silent TTS on Android Chrome`
- `Add back office: user management, feedback, announcements, email`
- `Keep group playback running while the screen is off`

Rules:
- Imperative mood ("Add", "Fix", "Remove" — not "Added", "Fixes")
- Summary ≤ ~65 characters; body explains *why* when the change isn't obvious
- One logical change per commit
- If a change alters cached assets or service-worker behavior, bump `CACHE` in `public/sw.js` in the same commit and say so in the body

## Pull request process

1. Fork/branch from `main`
2. Before opening a PR, make sure **both** pass locally:
   ```bash
   npm run lint    # must be zero errors and zero warnings
   npm run build   # must compile — this is also the type check
   ```
3. Manually verify the affected flows (there is no automated test suite yet — see `docs/TESTING.md` for the manual checklist); test **both light and dark themes** for UI changes and, ideally, a real Android phone for audio/speech changes
4. Describe in the PR: what changed, why, how you verified it, and screenshots for UI changes
5. PRs merge into `main`, which **auto-deploys to production** (vokabi.app) via Vercel — treat every merge as a release

## Code style rules

Derived from the existing codebase — match what's already there:

- **TypeScript strict**; no `any` (use `unknown` + narrowing; the codebase does this even for browser API gaps)
- **Prettier-style formatting**: 2-space indent, double quotes, semicolons, trailing commas (no Prettier config is committed — match the surrounding code)
- **Components**: function components only, `"use client"` at the top of anything using hooks/browser APIs; PascalCase component names, camelCase files except components (`kebab-case.tsx`)
- **State**: module-level stores with `useSyncExternalStore` for cross-component state (see `lib/settings.ts`, `lib/player.ts`); local `useState` otherwise. Don't add a state-management library
- **Data**: read Dexie via `useLiveQuery`; route writes through `lib/words.ts` helpers so sync/outbox side effects stay correct; wrap sync-engine writes in `withRemoteWrites()`
- **Styling**: Tailwind v4 utilities with the semantic tokens from `globals.css` (`bg-surface`, `text-muted`, `border-border`, `bg-primary-soft`…). No hardcoded colors, no inline styles except dynamic values
- **Icons**: `lucide-react` only — never emoji as UI icons
- **Accessibility**: interactive elements need `aria-label` when icon-only, `aria-pressed` for toggles, 44×44px minimum touch targets, visible focus states — this is the established pattern
- **Animation**: Framer Motion, transform/opacity only; respect `prefers-reduced-motion` (see `splash.tsx` for the pattern)
- **React hooks lint rules are enforced as errors**: no synchronous `setState` inside effect bodies, no ref reads during render — restructure instead of suppressing (the two existing `eslint-disable` comments are documented exceptions with rationale)
- **User-facing copy**: friendly, short, sentence case; errors say what went wrong and what to do next

## Database changes

- Local: add a new Dexie `db.version(n)` with an `upgrade()` — never mutate an existing version block (`src/lib/db.ts`)
- Cloud: update `supabase/schema.sql` / `supabase/admin-schema.sql` idempotently (`create table if not exists`, `drop policy if exists` + `create policy`) and document that operators must re-run the file manually — there is no migration tooling
