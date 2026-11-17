import { test, expect } from "@playwright/test";

test("public sportsbook shell loads without horizontal overflow", async ({ page }) => {
  const response = await page.goto("/", { waitUntil: "domcontentloaded" });
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle(/SPORE BET/i);
  await expect(page.locator("body")).toContainText(/demo sportsbook|demo environment|sportsbook/i);
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport + 1);
});

test("health endpoint reports healthy demo-only mode", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  const health = await response.json();
  expect(health.status).toBe("ok");
  expect(health.mode).toBe("demo-only");
  expect(health.realMoneyEnabled).toBe(false);
});

test("administrator page loads but protected overview rejects anonymous access", async ({ page, request }) => {
  const response = await page.goto("/admin", { waitUntil: "domcontentloaded" });
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: /SPORE BET.*Admin/i })).toBeVisible();
  const api = await request.get("/api/admin/overview");
  expect(api.status()).toBe(401);
});

test("money interface is explicitly preview-only and does not enable payment", async ({ page }) => {
  const response = await page.goto("/money-preview.html", { waitUntil: "domcontentloaded" });
  expect(response?.status()).toBe(200);
  await expect(page.locator("body")).toContainText(/preview only|preview-only/i);
  await expect(page.locator("body")).toContainText(/deposits, withdrawals, payouts and real-money wagering remain disabled/i);
});

test("security headers and cross-site state-change guard are present", async ({ request }) => {
  const pageResponse = await request.get("/");
  expect(pageResponse.status()).toBe(200);
  const headers = pageResponse.headers();
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["strict-transport-security"]).toContain("max-age=31536000");

  const blocked = await request.post("/api/auth/logout", {
    headers: { Origin: "https://attacker.invalid", "Sec-Fetch-Site": "cross-site", "Content-Type": "application/json" },
    data: {}
  });
  expect(blocked.status()).toBe(403);
});
