import { expect, test, type Page } from "@playwright/test";
import { installSupabaseStub, remoteGroup, remoteWord, type SupabaseStub } from "./supabase-stub";

/**
 * Regression cover for the class of bug where a sync deletes local rows it was
 * never told to delete. The reconcile pass infers "deleted on another device"
 * from a row being absent from a pull, and every way a pull can come back
 * short looks identical to that - so each test here makes the server come back
 * short in a different way and asserts the library survives.
 *
 * The one that actually shipped: a Supabase project caps REST responses at
 * max-rows (1000 by default) silently, so `select("*")` stopped returning the
 * whole library past 1000 words and reconcile deleted the remainder on every
 * single sync, pinning the device to exactly 1000 words while the rest sat
 * untouched in the cloud. Newly added words were the visible casualties,
 * because the cap cuts off the most recently written rows.
 */

const GROUP_UID = "00000000-0000-4000-a000-000000000001";

/**
 * Rows currently in IndexedDB. Opens at whatever version already exists rather
 * than at an implied v1: creating the database from under the app would block
 * Dexie's own upgrade and deadlock the page. Returns -1 until the app has
 * created the store, which the pollers below simply treat as "not yet".
 */
async function localWordCount(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const meta = (await indexedDB.databases()).find((d) => d.name === "vokabi");
    if (!meta?.version) return -1;
    const db: IDBDatabase = await new Promise((resolve, reject) => {
      const req = indexedDB.open("vokabi", meta.version);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    try {
      if (!db.objectStoreNames.contains("words")) return -1;
      return await new Promise<number>((resolve) => {
        const req = db.transaction("words", "readonly").objectStore("words").count();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(-1);
      });
    } finally {
      db.close();
    }
  });
}

/** Wait for the sync engine to settle on a stable local row count. */
async function waitForSyncedCount(page: Page, expected: number) {
  await expect.poll(() => localWordCount(page), { timeout: 30_000, intervals: [250] }).toBe(expected);
}

/**
 * Wait until the app stops talking to the backend. Worth doing before driving
 * the UI: a sync landing mid-interaction rewrites the list underneath an open
 * sheet, and Playwright will not click an element that is still moving.
 */
async function waitForSyncQuiet(page: Page, stub: SupabaseStub) {
  await expect
    .poll(
      async () => {
        const before = stub.requests.length;
        await page.waitForTimeout(1_000);
        return stub.requests.length === before;
      },
      { timeout: 30_000, intervals: [250] }
    )
    .toBe(true);
}

test("a library larger than the server's row cap survives repeated syncs", async ({ page }) => {
  const TOTAL = 1200;
  const stub = await installSupabaseStub(page, {
    groups: [remoteGroup(GROUP_UID, "Kapitel 1")],
    words: Array.from({ length: TOTAL }, (_, i) => remoteWord(i + 1, GROUP_UID)),
    // exactly what a default Supabase project does
    maxRows: 1000,
  });

  await page.goto("/");
  await waitForSyncedCount(page, TOTAL);

  // the pull has to have been paged rather than taken in one truncated shot
  const wordSelects = stub.requests.filter((r) => r.table === "words" && r.method === "GET");
  expect(wordSelects.length).toBeGreaterThan(1);

  // and it has to stay stable: the original bug re-deleted on every sync, so a
  // second pass is what turned a truncated read into permanent local loss
  await page.reload();
  await waitForSyncedCount(page, TOTAL);
  expect(stub.words).toHaveLength(TOTAL);
});

test("a word added past the row cap is not deleted again by its own sync", async ({ page }) => {
  // only the relationship matters (library > cap), so keep both small: this
  // spec drives the real UI and a thousand rendered rows just makes it slow
  const TOTAL = 60;
  const stub = await installSupabaseStub(page, {
    groups: [remoteGroup(GROUP_UID, "Kapitel 1")],
    words: Array.from({ length: TOTAL }, (_, i) => remoteWord(i + 1, GROUP_UID)),
    maxRows: 50,
  });

  await page.goto("/");
  await waitForSyncedCount(page, TOTAL);

  await waitForSyncQuiet(page, stub);
  await page.getByRole("link", { name: /Kapitel 1/ }).click();
  await page.getByRole("button", { name: "Add words" }).click();
  await page.getByRole("textbox").fill("Ich habe dir die Dateien geschickt.");
  // dispatched rather than clicked: the sheet springs in from the bottom, so
  // the button spends the first moments moving and partly below the fold, and
  // the entrance animation is not what this test is about
  await page.getByRole("button", { name: /Add \d+ word/ }).dispatchEvent("click");

  const row = page.getByRole("button", { name: "Open details for Ich habe dir die Dateien geschickt." });
  await expect(row).toBeVisible();

  // the add is local-first, so wait for the debounced sync to actually push it
  await expect.poll(() => stub.words.length, { timeout: 30_000 }).toBe(TOTAL + 1);

  // that same sync then pulls and reconciles, and this is where the word used
  // to die: pushed, marked clean, then absent from a pull the cap cut short,
  // so reconcile deleted the thing that had just been added
  await page.waitForTimeout(3_000);
  expect(await localWordCount(page)).toBe(TOTAL + 1);
  await expect(row).toBeVisible();

  await page.reload();
  await waitForSyncedCount(page, TOTAL + 1);
  await expect(row).toBeVisible();
});

test("a pull that comes back empty never wipes the library", async ({ page }) => {
  const TOTAL = 40;
  const stub = await installSupabaseStub(page, {
    groups: [remoteGroup(GROUP_UID, "Kapitel 1")],
    words: Array.from({ length: TOTAL }, (_, i) => remoteWord(i + 1, GROUP_UID)),
  });

  await page.goto("/");
  await waitForSyncedCount(page, TOTAL);

  // the backend goes blank - an auth hiccup, an RLS mismatch, a bad moment -
  // without ever returning an error
  stub.maxRows = 0;
  await page.reload();
  await page.waitForTimeout(6_000);
  expect(await localWordCount(page)).toBe(TOTAL);
});

test("a mass deletion elsewhere has to be confirmed by a second pull", async ({ page }) => {
  // deliberately waits out the real confirmation window rather than mocking it
  test.setTimeout(120_000);
  const TOTAL = 60;
  const stub = await installSupabaseStub(page, {
    groups: [remoteGroup(GROUP_UID, "Kapitel 1")],
    words: Array.from({ length: TOTAL }, (_, i) => remoteWord(i + 1, GROUP_UID)),
  });

  await page.goto("/");
  await waitForSyncedCount(page, TOTAL);

  // half the library vanishes from the server. One pull saying so is not
  // enough: a truncated or half-served response looks exactly like this.
  stub.words = stub.words.slice(0, TOTAL / 2);
  await page.reload();
  await page.waitForTimeout(6_000);
  expect(await localWordCount(page)).toBe(TOTAL);

  // it only lands once a later pull independently agrees
  await page.waitForTimeout(31_000);
  await page.reload();
  await waitForSyncedCount(page, TOTAL / 2);
});
