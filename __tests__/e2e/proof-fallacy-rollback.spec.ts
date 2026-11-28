import { test, expect } from "@playwright/test";

test.describe("Dual-surface Inline Fallacy Rollback", () => {
  test("displays floating canvas banner and side drawer CTA upon fallacy detection, and reverts edge cleanly", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/proof");

    // Open terminal console if collapsed
    const expandBtn = page.getByRole("button", { name: "Expand" });
    if (await expandBtn.isVisible()) {
      await expandBtn.click();
    }

    // Type invalid connection command 'connect C A' into CLI console input
    const input = page.getByPlaceholder(/Enter logic command/i);
    await expect(input).toBeVisible();
    await input.fill("connect C A");
    await input.press("Enter");

    // Canvas banner should display "FALLACY DETECTED" and "Dismiss Fallacy" button
    const canvasBannerText = page.getByText("FALLACY DETECTED", {
      exact: true,
    });
    await expect(canvasBannerText).toBeVisible();

    const dismissBannerBtn = page
      .getByRole("button", {
        name: /Dismiss Fallacy|Revert Edge/i,
      })
      .first();
    await expect(dismissBannerBtn).toBeVisible();

    // Side drawer Fallacy tab should show "Dismiss Fallacy" recovery action button
    const fallacyTab = page.getByRole("button", {
      name: "Fallacy",
      exact: true,
    });
    await expect(fallacyTab).toBeVisible();
    await fallacyTab.click();

    const dismissDrawerBtn = page
      .getByRole("button", {
        name: /Dismiss Fallacy|Rollback Step/i,
      })
      .last();
    await expect(dismissDrawerBtn).toBeVisible();

    // Capture screenshot of active fallacy state with banner & drawer CTA
    await page.screenshot({ path: "/tmp/fallacy-rollback-active.png" });

    // Click "Dismiss Fallacy" on canvas banner and verify initial valid edges remain proven
    await dismissBannerBtn.click();

    // Verify Fallacy state resets cleanly while keeping Node C PROVEN and 2 active edges
    await expect(canvasBannerText).toBeHidden();
    await expect(page.getByText("Zero Active Fallacies")).toBeVisible();
    await expect(page.locator(".react-flow__edge")).toHaveCount(2);

    // Capture screenshot after rollback
    await page.screenshot({ path: "/tmp/fallacy-rollback-cleared.png" });
  });
});
