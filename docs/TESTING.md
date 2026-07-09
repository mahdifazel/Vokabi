# Testing

## Current state — honest assessment

⚠️ **There is no automated test suite.** No test runner, no test files, no CI pipeline exist in this repository. This is flagged as the project's biggest technical-debt item.

What *is* enforced today:

| Check | Command | What it catches |
|---|---|---|
| Lint | `npm run lint` | React-hooks correctness (strict: setState-in-effect, ref-in-render are errors), unused code, Next.js pitfalls |
| Types + build | `npm run build` | Full TypeScript strict-mode check across the app and API routes; broken imports; invalid route signatures |

Both must pass cleanly before every push to `main` (which deploys to production — see `docs/DEPLOYMENT.md`).

## Manual verification checklist

Until automated coverage exists, changes are verified against the affected flows below. A full pass covers:

**Words & dictionary**
- [ ] Add a single word ("Haus") → article/translation/plural/IPA appear within seconds
- [ ] Bulk paste with mixed forms (`der Baum`, lowercase noun, a verb) → parsed, deduplicated, enriched
- [ ] Add an obscure word offline → status "no translation found"; Settings → *Retry lookups* fixes it once online
- [ ] Edit a word manually; delete a word
- [ ] Open a verb (e.g. "gehen", "aufstehen", "sich freuen") → example with playback, Perfekt with sein/haben chip, collapsible conjugation and grammar sections; nouns/adjectives show none of these

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
- [ ] Add word on device A → appears on device B after sync; delete on B → disappears on A
- [ ] New account gets a "General" group exactly once (check a second device too)

**PWA & shell**
- [ ] Fresh session shows the splash once; reloads/tab-switches never show it
- [ ] Offline: app opens and words/audio work (local voices)
- [ ] Install to home screen; icon and theme colors correct
- [ ] Dark and light themes on every changed screen

**Back office**
- [ ] Non-admin account: no Back office button; `/admin` shows "administrators" notice; `/api/admin/*` returns 403
- [ ] Users list/detail, ban/unban, password reset, delete user
- [ ] Feedback: submit from Settings → appears in inbox → resolve
- [ ] Announcement: publish → banner appears in app → dismiss persists → toggle off removes it

## Recommended future setup (not yet implemented)

If/when tests are added, the natural fit for this codebase:

1. **Unit tests (Vitest)** — highest value-per-effort targets are the pure logic modules:
   - `lib/dictionary.ts` — `parseInput`, `splitWordList`, wikitext parsing (`parseGermanWikitext`, `parseDeNounTemplate` — fixture-friendly), plural resolution, umlaut stems
   - `lib/speech.ts` — `scoreAttempt`, `levenshtein`, `charMatches`
   - `lib/learn.ts` — `buildQuiz` option/correctness invariants
   - `lib/verbs.ts` — `getVerbInfo` conjugation/Perfekt against a table of known-good verbs (pure functions, ideal fixture target)
   - `lib/words.ts` — `parseCSV`, `wordsToCSV` round-trip
   - Dexie-dependent code can run against `fake-indexeddb`
2. **Component/integration tests** — React Testing Library for the add-words flow and settings toggles
3. **E2E (Playwright)** — login gate, add-word happy path, group playback start/stop; run against a preview deployment with a dedicated test Supabase project
4. **CI** — GitHub Actions running `lint` + `build` (+ tests when they exist) on PRs, so `main` stops depending on contributors remembering to run them locally

Coverage philosophy when adopted: prioritize the sync engine and dictionary parser (highest complexity, highest breakage cost), not UI snapshot coverage.
