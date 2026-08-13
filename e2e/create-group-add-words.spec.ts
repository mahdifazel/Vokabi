import { test, expect } from "@playwright/test";

test("create a group and add a word to it", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "New group" }).click();

  // presets only appear when Supabase is configured; local-only test runs
  // skip straight to the name form, but stay defensive either way
  const createOwn = page.getByRole("button", { name: "Create my own" });
  if (await createOwn.isVisible().catch(() => false)) {
    await createOwn.click();
  }

  const groupName = `Test group ${Date.now()}`;
  await page.getByLabel("Group name").fill(groupName);
  await page.getByRole("button", { name: "Create group" }).click();

  await expect(page).toHaveURL(/\/groups\/\d+/);
  await expect(page.getByRole("heading", { name: groupName })).toBeVisible();

  await page.getByRole("button", { name: "Add words" }).click();
  await page.getByRole("textbox").fill("Haus");
  await page.getByRole("button", { name: /Add \d+ word/ }).click();

  const row = page.getByRole("button", { name: "Open details for Haus" });
  await expect(row).toBeVisible();
});
