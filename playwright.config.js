import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.BASE_URL || "https://spore-bet.pages.dev";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: { baseURL, trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    { name: "chromium-desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox-desktop", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit-desktop", use: { ...devices["Desktop Safari"] } },
    { name: "android-pixel", use: { ...devices["Pixel 7"] } },
    { name: "ios-iphone", use: { ...devices["iPhone 13"] } }
  ]
});
