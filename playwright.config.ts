import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  timeout: 60000,
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Use installed Google Chrome — FCM push subscriptions require a Google-signed browser.
        // If Chrome is not installed, change to channel: "chromium" and note it as a known limitation.
        //
        // NOTE: We do NOT use the standard Playwright context here because Chrome Push API does not
        // work in ephemeral/incognito contexts (https://crbug.com/41124656). Instead, the test
        // uses `chromium.launchPersistentContext()` directly with a temp user data dir.
        channel: "chrome",
        headless: true,
      },
    },
  ],
  // Run against `pnpm dev` — @serwist/turbopack serves the SW dynamically via
  // the /serwist/[...path] Route Handler, so no production build is needed.
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
