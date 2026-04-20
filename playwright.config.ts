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
  // Run against the production build because Serwist SW generation is disabled in development
  // (disable: process.env.NODE_ENV === 'development' in next.config.ts). The SW is required for
  // push subscriptions to work, so we must use a production build.
  //
  // We force webpack (--webpack) for the build because Serwist's @serwist/next uses a webpack
  // plugin to generate public/sw.js, and it does not support Turbopack. The next.config.ts has
  // `turbopack: {}` which would otherwise activate Turbopack for the production build too.
  webServer: {
    command: "pnpm exec next build --webpack && pnpm start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000, // build takes time
    stdout: "pipe",
    stderr: "pipe",
  },
});
