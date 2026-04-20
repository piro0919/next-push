/**
 * E2E test for the next-push demo app push subscription flow.
 *
 * NOTE: This test runs against `pnpm build --webpack && pnpm start` (production build),
 * NOT `pnpm dev`, because Serwist Service Worker generation is disabled in
 * development mode (see next.config.ts). The SW is required for push
 * subscriptions to work — without it `usePush` returns `isSupported: false`.
 *
 * Also requires --webpack because @serwist/next uses a webpack plugin to
 * generate public/sw.js and does not support Turbopack. Since next.config.ts
 * has `turbopack: {}`, production builds would otherwise use Turbopack.
 *
 * Chrome Push API does NOT work in ephemeral/incognito contexts (crbug.com/41124656).
 * We therefore use `chromium.launchPersistentContext()` with a temp user data dir
 * so Chrome has a real profile for Push subscriptions.
 *
 * The test verifies:
 * 1. Grant notifications permission via Playwright context
 * 2. Click Subscribe → UI shows "Subscribed: yes", POST /api/push returns 201
 * 3. Click "Send test" → PUT /api/push returns `{ sent >= 1, results[0].ok === true }`
 *    (meaning FCM accepted the push = VAPID signing + aes128gcm encryption is correct)
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium, expect, test } from "@playwright/test";

// Use a persistent user data dir so Chrome has a real profile for Push API.
// Chrome Push does not work in ephemeral/incognito contexts.
test.describe("push-demo e2e", () => {
  test("subscribe and send test notification", async () => {
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "playwright-push-"));

    const context = await chromium.launchPersistentContext(userDataDir, {
      channel: "chrome",
      headless: true,
      baseURL: "http://localhost:3000",
      permissions: ["notifications"],
      args: ["--no-sandbox"],
    });

    try {
      await context.grantPermissions(["notifications"], {
        origin: "http://localhost:3000",
      });

      const page = await context.newPage();

      // Collect all POST/PUT/DELETE to /api/push
      const apiCalls: Array<{ method: string; status: number; body?: unknown }> = [];
      page.on("response", async (res) => {
        const url = res.url();
        if (url.includes("/api/push")) {
          let body: unknown;
          try {
            body = await res.json();
          } catch {
            body = await res.text().catch(() => undefined);
          }
          apiCalls.push({
            method: res.request().method(),
            status: res.status(),
            body,
          });
        }
      });

      // Capture page errors for debugging
      page.on("pageerror", (err) => {
        console.log("[page error]", err.message);
      });

      await page.goto("http://localhost:3000/push-demo");

      // Initial state: not yet subscribed
      await expect(page.getByText(/Subscribed:/)).toContainText("no");

      // Subscribe
      await page.getByRole("button", { name: /^Subscribe$/ }).click();

      // Wait for subscription to take effect in UI
      await expect(page.getByText(/Subscribed:/)).toContainText("yes", {
        timeout: 15_000,
      });

      // POST /api/push should have succeeded with 201
      const postCall = apiCalls.find((c) => c.method === "POST");
      expect(postCall, "POST /api/push should have been called").toBeTruthy();
      expect(postCall?.status).toBe(201);

      // Send test push
      await page.getByRole("button", { name: /^Send test$/ }).click();

      // Wait for the PUT response to come back
      await expect
        .poll(() => apiCalls.some((c) => c.method === "PUT"), {
          timeout: 15_000,
        })
        .toBe(true);

      const putCall = apiCalls.find((c) => c.method === "PUT");
      expect(putCall?.status).toBe(200);

      // PUT body: { sent: 1, results: [{ ok: true, statusCode: 201 }] } if FCM accepted
      const body = putCall?.body as {
        sent: number;
        results: Array<{
          ok: boolean;
          gone?: boolean;
          statusCode?: number;
          error?: unknown;
        }>;
      };
      expect(body.sent).toBeGreaterThanOrEqual(1);

      // Key assertion: FCM/Mozilla accepted the push = VAPID signing + aes128gcm encryption correct
      const firstResult = body.results[0];
      if (!firstResult.ok) {
        // Give detailed output on failure
        throw new Error(
          `Push service rejected: ${JSON.stringify(firstResult, null, 2)}. ` +
            `This usually indicates a bug in VAPID JWT signing, key format, or payload encryption.`,
        );
      }
      expect(firstResult.ok).toBe(true);
    } finally {
      await context.close();
      // Clean up temp profile dir
      fs.rmSync(userDataDir, { recursive: true, force: true });
    }
  });
});
