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

    // Canvas banner should display "FALLACY DETECTED" and "Revert Edge" button
    const canvasBannerText = page.getByText("FALLACY DETECTED", {
      exact: true,
    });
    await expect(canvasBannerText).toBeVisible();

    const revertEdgeBtn = page.getByRole("button", { name: /Revert Edge/i });
    await expect(revertEdgeBtn).toBeVisible();

    // Side drawer Fallacy tab should show "Rollback Step" action button
    const fallacyTab = page.getByRole("button", {
      name: "Fallacy",
      exact: true,
    });
    await expect(fallacyTab).toBeVisible();
    await fallacyTab.click();

    const rollbackStepBtn = page.getByRole("button", {
      name: /Rollback Step/i,
    });
    await expect(rollbackStepBtn).toBeVisible();

    // Capture screenshot of active fallacy state with banner & drawer CTA
    await page.screenshot({ path: "/tmp/fallacy-rollback-active.png" });

    // Click "Revert Edge" on canvas banner
    await revertEdgeBtn.click();

    // Verify Fallacy state resets cleanly
    await expect(canvasBannerText).toBeHidden();
    await expect(page.getByText("Zero Active Fallacies")).toBeVisible();

    // Capture screenshot after rollback
    await page.screenshot({ path: "/tmp/fallacy-rollback-cleared.png" });
  });
});
