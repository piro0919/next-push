/**
 * E2E test for the next-push demo app push subscription flow.
 *
 * Runs against `pnpm dev`. @serwist/turbopack serves the SW dynamically
 * via /serwist/[...path], so no production build is needed.
 *
 * Chrome Push API does not work in ephemeral contexts (crbug.com/41124656).
 * For the "chrome" project, we therefore use chromium.launchPersistentContext
 * with a temp user data dir. Firefox does not have this restriction, so for
 * the "firefox" project we use the standard page fixture.
 *
 * Both browsers exercise the same flow: grant permission -> subscribe -> send
 * test -> assert FCM/Mozilla autopush returned ok:true.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium, expect, type Page, test } from "@playwright/test";

type ApiCall = { method: string; status: number; body?: unknown };

async function runPushFlow(page: Page, apiCalls: ApiCall[]): Promise<void> {
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
  page.on("pageerror", (err) => {
    console.log("[page error]", err.message);
  });

  await page.goto("http://localhost:3000/");
  await expect(page.getByText(/Subscribed:/)).toContainText("no");
  await page.getByRole("button", { name: /^Subscribe$/ }).click();
  await expect(page.getByText(/Subscribed:/)).toContainText("yes", { timeout: 20_000 });

  const postCall = apiCalls.find((c) => c.method === "POST");
  expect(postCall, "POST /api/push should have been called").toBeTruthy();
  expect(postCall?.status).toBe(201);

  await page.getByRole("button", { name: /^Send notification$/ }).click();
  await expect.poll(() => apiCalls.some((c) => c.method === "PUT"), { timeout: 20_000 }).toBe(true);
  const putCall = apiCalls.find((c) => c.method === "PUT");
  expect(putCall?.status).toBe(200);

  const body = putCall?.body as {
    sent: number;
    results: Array<{ ok: boolean; gone?: boolean; statusCode?: number; error?: unknown }>;
  };
  expect(body.sent).toBeGreaterThanOrEqual(1);
  const firstResult = body.results[0];
  if (!firstResult.ok) {
    throw new Error(
      `Push service rejected: ${JSON.stringify(firstResult, null, 2)}. This indicates a bug in VAPID signing or payload encryption.`,
    );
  }
  expect(firstResult.ok).toBe(true);
}

test.describe("push-demo e2e", () => {
  test("subscribe and send test notification", async ({ page, context, browserName }) => {
    const apiCalls: ApiCall[] = [];

    if (browserName === "chromium") {
      // Chrome ephemeral context disables Push API — use a persistent profile.
      const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "playwright-push-"));
      const persistent = await chromium.launchPersistentContext(userDataDir, {
        channel: "chrome",
        headless: true,
        baseURL: "http://localhost:3000",
        permissions: ["notifications"],
        args: ["--no-sandbox"],
      });
      try {
        await persistent.grantPermissions(["notifications"], {
          origin: "http://localhost:3000",
        });
        const persistentPage = await persistent.newPage();
        await runPushFlow(persistentPage, apiCalls);
      } finally {
        await persistent.close();
        fs.rmSync(userDataDir, { recursive: true, force: true });
      }
    } else {
      // Firefox: the standard ephemeral context supports Push; grant permission directly.
      await context.grantPermissions(["notifications"], {
        origin: "http://localhost:3000",
      });
      await runPushFlow(page, apiCalls);
    }
  });
});
