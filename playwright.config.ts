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
      name: "chrome",
      use: {
        ...devices["Desktop Chrome"],
        channel: "chrome",
        headless: true,
      },
    },
    {
      name: "firefox",
      use: {
        ...devices["Desktop Firefox"],
        headless: true,
        // Playwright's bundled Firefox ships with Push API disabled via
        // playwright.cfg. Re-enable it here so we can exercise the real
        // Mozilla autopush service. If this stops working in a future
        // Playwright release, we may need to pin the Firefox version or
        // switch to `channel: "firefox"` (real installed Firefox).
        launchOptions: {
          firefoxUserPrefs: {
            "dom.push.enabled": true,
            "dom.push.connection.enabled": true,
            "dom.push.serverURL": "wss://push.services.mozilla.com/",
            "dom.push.testing.ignorePermission": false,
          },
        },
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
