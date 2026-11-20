import { test, expect, request as apiRequest } from "@playwright/test";

test("customer homepage has no demo wallet, demo slip or sample fixtures", async ({ page }) => {
  const response = await page.goto("/", { waitUntil: "domcontentloaded" });
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle(/SPORE BET/i);
  await expect(page.locator("body")).toContainText(/real-money service not yet available/i);
  await expect(page.locator("body")).toContainText(/no demo balances/i);
  await expect(page.locator("body")).not.toContainText(/demo credits|virtual bet slip|illustrative odds/i);
  const dimensions = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport + 1);
});

test("health endpoint reports locked real-money launch state", async ({ request }) => {
  const api = await apiRequest.newContext({ baseURL: process.env.API_BASE_URL || "https://spore-bet.pages.dev" });
  const response = await api.get("/api/health");
  expect(response.status()).toBe(200);
  const health = await response.json();
  expect(health.status).toBe("ok");
  expect(health.mode).toBe("real-money-not-launched");
  expect(health.realMoneyEnabled).toBe(false);
  expect(health.wageringAvailable).toBe(false);
  await api.dispose();
});

test("anonymous users cannot access administrator finance controls", async ({ request }) => {
  const api = await apiRequest.newContext({ baseURL: process.env.API_BASE_URL || "https://spore-bet.pages.dev" });
  expect((await api.get("/admin")).status()).toBe(200);
  expect((await api.get("/api/admin/overview")).status()).toBe(401);
  expect((await api.get("/api/admin/cash-transactions")).status()).toBe(401);
  await api.dispose();
});

test("customer money endpoints fail closed without creating transactions", async ({ request }) => {
  const api = await apiRequest.newContext({ baseURL: process.env.API_BASE_URL || "https://spore-bet.pages.dev" });
  for (const path of ["/api/bets", "/api/deposits", "/api/withdrawals"]) {
    const response = await api.post(path, { data: {} });
    expect([401, 415, 423]).toContain(response.status());
  }
  await api.dispose();
});

test("security headers and cross-site state-change guard are present", async ({ request }) => {
  const api = await apiRequest.newContext({ baseURL: process.env.API_BASE_URL || "https://spore-bet.pages.dev" });
  const pageResponse = await api.get("/");
  expect(pageResponse.status()).toBe(200);
  const headers = pageResponse.headers();
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["strict-transport-security"]).toContain("max-age=31536000");
  const blocked = await api.post("/api/auth/logout", { headers: { Origin: "https://attacker.invalid", "Sec-Fetch-Site": "cross-site", "Content-Type": "application/json" }, data: {} });
  expect(blocked.status()).toBe(403);
  await api.dispose();
});
