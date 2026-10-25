import { test, expect, type Page } from "@playwright/test";

// The Labyrinth maze on desktop and wide screens (#2842). It grows in whole
// steps of its 240x144 art and letterboxes the rest (#1522): 3x up to 1440,
// and from 1536px the cabinet widens past the text column so 1920 and 2560
// take the next whole steps.
const ROUTE = "/arcade/retro-labyrinth";
const CANVAS = ".arcade-labyrinth-canvas canvas";

async function launch(page: Page) {
  await page.goto(ROUTE);
  const launchButton = page.getByRole("button", { name: /Launch Cabinet/i });
  await expect(async () => {
    if ((await launchButton.count()) > 0) {
      await launchButton.first().click({ timeout: 2000 });
    }
    await expect(page.locator(CANVAS)).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 90000 });
}

test.describe("Retro Labyrinth maze scale (#2842)", () => {
  for (const [width, height, scale] of [
    [1024, 768, 3],
    [1280, 800, 3],
    [1440, 900, 3],
    [1920, 1080, 5],
    [2560, 1440, 7],
  ] as const) {
    test(`draws the maze at ${scale}x in a ${width}x${height} window`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height });
      await launch(page);
      const canvas = page.locator(CANVAS);
      await expect(canvas).toHaveAttribute("data-pixel-scale", String(scale));
      const box = await canvas.boundingBox();
      // A whole number of screen pixels per art pixel, never stretched.
      expect(box?.width).toBe(240 * scale);
      expect(box?.height).toBe(144 * scale);
      await expect(canvas).toBeInViewport({ ratio: 1 });
    });
  }
});
