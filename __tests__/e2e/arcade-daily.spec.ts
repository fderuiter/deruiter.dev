import { test, expect } from "@playwright/test";
import { dailySeed } from "../../lib/trial-and-error";

/**
 * #2113: the hub's Arcade Daily panel starts a game on the day's seed and
 * marks the run as a daily. Trial & Error is the probe: it is the one listed
 * game with no desktop-only gate, and its Daily Protocol is its daily.
 */
test.describe("Arcade Daily panel", () => {
  test("launches Trial & Error on today's daily seed", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/arcade", { waitUntil: "domcontentloaded" });
    const today = new Date().toISOString().slice(0, 10);
    const panel = page.getByTestId("arcade-daily-panel");
    await expect(panel).toBeVisible({ timeout: 15000 });
    await expect(panel).toContainText(today);

    await expect(async () => {
      await panel
        .getByRole("link", { name: "Play daily: today's Trial & Error" })
        .click();
      await expect(page).toHaveURL(/\/arcade\/trial-and-error#daily=/, {
        timeout: 3000,
      });
    }).toPass({ timeout: 15000 });
    expect(new URL(page.url()).hash).toBe(`#daily=${today}`);

    const dialog = page.getByRole("dialog", { name: "New run" });
    await expect(async () => {
      const launchBtn = page.getByRole("button", { name: /Launch Cabinet/i });
      if (await launchBtn.isVisible()) await launchBtn.click();
      await expect(dialog).toBeVisible({ timeout: 3000 });
    }).toPass({ timeout: 30000 });
    await expect(dialog.getByTestId("new-run-seed")).toHaveValue(
      dailySeed(today)
    );
    await dialog.getByRole("button", { name: "Start run" }).click();
    await expect(dialog).toBeHidden();

    const info = page.getByRole("dialog", { name: "Run Info" });
    await expect(async () => {
      await page.getByTestId("run-info-button").click();
      await expect(info).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 15000 });
    await expect(info.getByTestId("run-daily")).toContainText(today);
    await expect(info.getByTestId("run-seed")).toHaveText(dailySeed(today));
  });
});
