import { test, expect } from "@playwright/test";

test("customer homepage removes demo betting and displays launch status", async ({ page }) => {
  const response = await page.goto("/", { waitUntil: "domcontentloaded" });
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle(/SPORE BET/i);
  await expect(page.locator("body")).toContainText(/real-money service not yet available/i);
  await expect(page.locator("body")).toContainText(/no demo balances/i);
  await expect(page.locator("body")).not.toContainText(/demo credits|virtual bet slip|illustrative odds/i);
  const dimensions = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport + 1);
});

test("administrator dashboard has no demo metrics and keeps financial controls locked", async ({ page }) => {
  const response = await page.goto("/admin.html", { waitUntil: "domcontentloaded" });
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: /SPORE BET.*Administrator/i })).toBeVisible();
  await expect(page.locator("body")).toContainText(/real-money launch locked/i);
  await expect(page.locator("body")).not.toContainText(/demo credits outstanding|payment destination settings/i);
});

test("financial operations page displays launch gates, not transaction approval buttons", async ({ page }) => {
  const response = await page.goto("/admin-money.html", { waitUntil: "domcontentloaded" });
  expect(response?.status()).toBe(200);
  await expect(page.locator("body")).toContainText(/cash operations locked/i);
  await expect(page.locator("body")).toContainText(/double-entry ledger/i);
  await expect(page.getByRole("button")).toHaveCount(0);
});

test("simulated wallet preview page has been removed", async ({ page }) => {
  const response = await page.goto("/money-preview.html", { waitUntil: "domcontentloaded" });
  expect(response?.status()).toBe(404);
});

