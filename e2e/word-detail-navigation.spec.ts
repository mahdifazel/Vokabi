import { expect, test, type Page } from "@playwright/test";

/**
 * Stepping through a group from the word detail page. The sequence has to
 * match the group list exactly, so the test reads the order off the group
 * page first and then walks it, rather than hardcoding names: the two are
 * driven by the same query and drifting apart is the failure worth catching.
 */

async function createGroupWithWords(page: Page, name: string, words: string[]) {
  await page.goto("/");
  await page.getByRole("button", { name: "New group" }).click();
  const createOwn = page.getByRole("button", { name: "Create my own" });
  if (await createOwn.isVisible().catch(() => false)) await createOwn.click();
  await page.getByLabel("Group name").fill(name);
  await page.getByRole("button", { name: "Create group" }).click();
  await expect(page).toHaveURL(/\/groups\/\d+/);

  await page.getByRole("button", { name: "Add words" }).click();
  await page.getByRole("textbox").fill(words.join("\n"));
  // dispatched rather than clicked: the sheet springs in from the bottom and
  // spends its first moments moving, which is not what this test is about
  await page.getByRole("button", { name: /Add \d+ words?/ }).dispatchEvent("click");
  await expect(page.getByRole("button", { name: /^Open details for/ })).toHaveCount(
    words.length
  );
}

/** The group page's row order, which the detail navigation must reproduce. */
async function listOrder(page: Page): Promise<string[]> {
  const labels = await page
    .getByRole("button", { name: /^Open details for/ })
    .evaluateAll((els) =>
      els.map((el) => el.getAttribute("aria-label")!.replace("Open details for ", ""))
    );
  return labels;
}

test("previous and next step through the group from the word detail page", async ({ page }) => {
  const words = ["Haus", "Baum", "Auto"];
  await createGroupWithWords(page, "Kapitel 1", words);
  const order = await listOrder(page);
  expect(order).toHaveLength(3);

  // open the first word
  await page.getByRole("button", { name: `Open details for ${order[0]}` }).click();
  await expect(page).toHaveURL(/\/word\/\d+\?group=\d+/);

  const nav = page.getByRole("button", { name: /^(Next word|No next word)/ });
  const back = page.getByRole("button", { name: /^(Previous word|No previous word)/ });

  await expect(page.getByText("Kapitel 1 · 1 of 3")).toBeVisible();
  // nothing before the first word
  await expect(back).toBeDisabled();

  await nav.click();
  await expect(page.getByRole("heading", { name: order[1] })).toBeVisible();
  await expect(page.getByText("Kapitel 1 · 2 of 3")).toBeVisible();
  await expect(back).toBeEnabled();

  await nav.click();
  await expect(page.getByRole("heading", { name: order[2] })).toBeVisible();
  await expect(page.getByText("Kapitel 1 · 3 of 3")).toBeVisible();
  // nothing after the last word
  await expect(nav).toBeDisabled();

  await back.click();
  await expect(page.getByRole("heading", { name: order[1] })).toBeVisible();
  await expect(page.getByText("Kapitel 1 · 2 of 3")).toBeVisible();

  // stepping through words must not bury the group list in history
  await page.goBack();
  await expect(page).toHaveURL(/\/groups\/\d+/);
});

test("a group of one offers no navigation card", async ({ page }) => {
  await createGroupWithWords(page, "Einzeln", ["Haus"]);
  await page.getByRole("button", { name: /^Open details for/ }).click();
  await expect(page).toHaveURL(/\/word\/\d+/);
  await expect(page.getByRole("heading", { name: "Haus" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Previous word|No previous word/ })).toHaveCount(0);
});
