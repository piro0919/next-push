/**
 * E2E smoke test for Playwright's bundled WebKit.
 *
 * Playwright WebKit is NOT Safari — it is a standalone WebKit build that
 * lacks APNs integration, so pushManager.subscribe() against a real push
 * service will fail. We therefore only exercise the pre-subscribe code path:
 *
 *  - page loads and hydrates
 *  - feature detection in usePush runs
 *  - the UI branches correctly based on isSupported / permission
 *  - preset buttons and info tooltips are operable
 *
 * Real Safari/iOS validation happens on a physical device.
 */

import { expect, test } from "@playwright/test";

test.describe("webkit smoke", () => {
  test("renders demo and branches on feature support", async ({ page }) => {
    await page.goto("http://localhost:3000/");

    // Heading always renders
    await expect(page.getByRole("heading", { name: "Web Push for Next.js" })).toBeVisible();

    // One of three states: unsupported notice, denied notice, or the interactive demo
    const unsupported = page.getByText(/Web Push is not supported/);
    const denied = page.getByText(/Notifications are blocked/);
    const subscribeButton = page.getByRole("button", { name: /^Subscribe$/ });

    const [unsupportedVisible, deniedVisible, subscribeVisible] = await Promise.all([
      unsupported.isVisible(),
      denied.isVisible(),
      subscribeButton.isVisible(),
    ]);

    // Exactly one branch should render
    const count = [unsupportedVisible, deniedVisible, subscribeVisible].filter(Boolean).length;
    expect(count, "exactly one of unsupported/denied/subscribe should be visible").toBe(1);

    if (!subscribeVisible) {
      // Unsupported or denied — no form should be present
      await expect(page.getByRole("group", { name: "Notification payload" })).toHaveCount(0);
      return;
    }

    // Subscribe is available — verify the form renders and is disabled
    const fieldset = page.locator("fieldset");
    await expect(fieldset).toHaveAttribute("disabled", "");

    // Preset buttons work even when fieldset is disabled... actually they don't,
    // since the fieldset disables all form controls inside. Verify that state.
    const brandPreset = page.getByRole("button", { name: "Brand" });
    await expect(brandPreset).toBeDisabled();

    // InfoTips use role="button" on a span, so they should be clickable regardless.
    const infoTips = page.getByRole("button", { name: /Required\. Main heading/ });
    await expect(infoTips.first()).toBeVisible();
    await infoTips.first().click();
    // Tooltip text is the same as aria-label, so we can only assert the
    // popover state via aria-expanded rather than matching content.
    await expect(infoTips.first()).toHaveAttribute("aria-expanded", "true");
  });
});
