# Testing

## Current state — honest assessment

⚠️ **There is no unit test suite yet** (no Vitest/Jest, no CI pipeline) — still the project's biggest technical-debt item. One Playwright E2E smoke test exists, covering a single critical-path flow; it is not a substitute for unit coverage of the pure logic modules (dictionary parser, verb/noun/adjective engines) described below.

What *is* enforced today:

| Check | Command | What it catches |
|---|---|---|
| Lint | `npm run lint` | React-hooks correctness (strict: setState-in-effect, ref-in-render are errors), unused code, Next.js pitfalls |
| Types + build | `npm run build` | Full TypeScript strict-mode check across the app and API routes; broken imports; invalid route signatures |
| E2E smoke | `npm run test:e2e` | `e2e/create-group-add-words.spec.ts` — create a group, add a word, confirm it renders. Runs against `next dev` on port 3100 with Supabase env vars forced empty (see below), so it never touches auth/cloud |

Lint and build must pass cleanly before every push to `main` (which deploys to production — see `docs/DEPLOYMENT.md`). The E2E test is not yet part of that required gate (no CI wired up) — run it manually when touching the group/add-words flow.

### E2E setup notes (`playwright.config.ts`)

- Runs against `next dev`, not `next start` — the service worker only registers when `NODE_ENV === "production"` (`app-shell.tsx`), so `next dev` avoids SW/cache interference in tests.
- The `webServer` block force-overrides `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` to empty strings, regardless of what's in `.env.local`. This keeps the login gate off (`cloudConfigured()` in `lib/supabase.ts` returns false) so E2E covers the local-only, IndexedDB-backed flows without needing a test Supabase project. Sync/auth/multi-device flows are explicitly out of scope for this test and would need a dedicated test Supabase project to cover properly.
- Each Playwright test gets a fresh browser context (fresh IndexedDB per test) — no manual state cleanup needed between tests.
- Uses the `Pixel 7` device profile (mobile viewport + touch), matching the app's mobile-first design.

## Manual verification checklist

Until automated coverage exists, changes are verified against the affected flows below. A full pass covers:

**Words & dictionary**
- [ ] Add a single word ("Haus") → article/translation/plural/IPA appear within seconds
- [ ] Bulk paste with mixed forms (`der Baum`, lowercase noun, a verb) → parsed, deduplicated, enriched
- [ ] Separators: entries split on newlines, `;`, `/`, and a spaced `-`; a comma stays inside the entry ("die Katze, -n" is one word) and "E-Mail" never splits
- [ ] Add an obscure word offline → status "no translation found"; Settings → *Retry lookups* fixes it once online
- [ ] Edit a word manually; delete a word
- [ ] Open a verb (e.g. "gehen", "aufstehen", "sich freuen") → example with playback, Perfekt with sein/haben chip, collapsible conjugation and grammar sections; nouns/adjectives show none of these
- [ ] Photo scan: "Scan a photo" opens the in-app camera (or file picker without camera permission); a clear printed word list yields clean entries in the textarea; with a Gemini or Groq key configured the "Identifying words" phase runs (Gemini first, Groq as fallback); with all keys removed the scan still works (heuristic fallback); scans keep sentences whole and are capped at 40 words / 20 sentences with a matching error message
- [ ] Delete a group that contains words → its words appear in General, not lost
- [ ] Add-words sheet from the Library page has the first group preselected; from a group page that group is targeted
- [ ] Add-words sheet "Add to groups" is a single horizontal row that scrolls sideways (no wrap, no visible scrollbar); selected groups sort to the front, and tapping a far-off chip scrolls the row back to the start

**Audio** (needs a real Android phone for full confidence)
- [ ] Single-word play; slow play on word detail
- [ ] Group playback honoring speed / pause / repeat / read-article / read-translation / shuffle / auto-repeat
- [ ] Player card: current word shown large with translation, prev/pause/next centered, close top-right
- [ ] Screen off during playback → audio continues; lock-screen controls show current word and work

**Learning**
- [ ] Pronunciation practice: correct word → Excellent; wrong word → highlighted letters (Chrome only; other browsers show the unsupported notice)
- [ ] Flashcards: flip, swipe both directions, end summary, retry-missed round
- [ ] Quiz: all three question types, correct/wrong feedback, score screen

**Accounts & sync**
- [ ] Signed out (configured deployment) → any URL redirects to `/login`
- [ ] Sign up, sign in, sign out; wrong password shows a readable error
- [ ] "Continue with Google" completes the OAuth round-trip and lands signed in with sync running (needs the Google provider configured in Supabase); with the provider disabled the error appears in the message box
- [ ] Add word on device A → appears on device B after sync; delete on B → disappears on A
- [ ] New account gets a "General" group exactly once (check a second device too)

**PWA & shell**
- [ ] Fresh session shows the splash once; reloads/tab-switches never show it
- [ ] Offline: app opens and words/audio work (local voices)
- [ ] Install to home screen; icon and theme colors correct
- [ ] Dark and light themes on every changed screen

**Back office**
- [ ] Non-admin account: no Back office button; `/admin` shows "administrators" notice; `/api/admin/*` returns 403
- [ ] Sidebar layout on desktop (≥1024px), top bar with scrollable tabs on mobile; active section highlighted
- [ ] Users list/detail, ban/unban, password reset, delete user
- [ ] Feedback: submit from Settings → appears in inbox → resolve
- [ ] Announcement: publish → banner appears in app → dismiss persists → toggle off removes it
- [ ] System settings: save a Gemini or Groq key (masked hint shown), Test connection reports key validity and model availability, Remove key works; the Gemini card notes when the env-var key is active

## Recommended future setup (not yet implemented)

If/when tests are added, the natural fit for this codebase:

1. **Unit tests (Vitest)** — highest value-per-effort targets are the pure logic modules:
   - `lib/dictionary.ts` — `parseInput`, `splitWordList`, wikitext parsing (`parseGermanWikitext`, `parseDeNounTemplate` — fixture-friendly), plural resolution, umlaut stems
   - `lib/scan-rules.ts` — `isSentence` word-vs-sentence classification against sample entries
   - `lib/speech.ts` — `scoreAttempt`, `levenshtein`, `charMatches`
   - `lib/learn.ts` — `buildQuiz` option/correctness invariants
   - `lib/verbs.ts` — `getVerbInfo` conjugation/Perfekt against a table of known-good verbs (pure functions, ideal fixture target)
   - `lib/words.ts` — `parseCSV`, `wordsToCSV` round-trip
   - Dexie-dependent code can run against `fake-indexeddb`
2. **Component/integration tests** — React Testing Library for the add-words flow and settings toggles
3. **More E2E (Playwright)** — the create-group/add-word smoke test exists (see above); extend with delete-word/delete-group and group playback start/stop. Sync/login-gate flows need a dedicated test Supabase project and a preview deployment, a materially bigger step — not yet done
4. **CI** — GitHub Actions running `lint` + `build` + `test:e2e` on PRs, so `main` stops depending on contributors remembering to run them locally

Coverage philosophy when adopted: prioritize the sync engine and dictionary parser (highest complexity, highest breakage cost), not UI snapshot coverage.
