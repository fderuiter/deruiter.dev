import { test, expect, type Locator } from "@playwright/test";

/**
 * Asserts a control is fully on screen. Chrome's IntersectionObserver
 * reports a ratio like 0.9999997 for a control laid out at fractional pixel
 * offsets inside the pseudo-fullscreen stage, even when every clipping
 * ancestor contains it, so `ratio: 1` fails on float noise. Check the box
 * against the viewport exactly, and the observer ratio to within 0.1%.
 */
async function expectFullyVisible(
  control: Locator,
  view: { width: number; height: number }
) {
  await expect(control).toBeInViewport({ ratio: 0.999 });
  const box = await control.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(view.width);
  expect(box!.y + box!.height).toBeLessThanOrEqual(view.height);
}

const games = [
  "laser-loon",
  "retro-labyrinth",
  "garmin-watch",
  "clinical-chaos",
  "working-with-duck",
  "quasi-puzzler",
];
const views = [
  { name: "small portrait", width: 320, height: 568 },
  { name: "portrait", width: 390, height: 844 },
  { name: "landscape", width: 667, height: 375 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
];

for (const view of views) {
  for (const game of games) {
    test(`${game}: ${view.name} controls and fullscreen fallback`, async ({
      page,
    }) => {
      await page.setViewportSize(view);
      // Exercise the CSS fallback used when native fullscreen is unavailable.
      await page.addInitScript(() => {
        Object.defineProperty(HTMLElement.prototype, "requestFullscreen", {
          value: undefined,
          configurable: true,
        });
        Object.defineProperty(navigator, "maxTouchPoints", { get: () => 1 });
      });
      await page.goto(`/arcade/${game}`);
      const cabinet = page.locator("[data-arcade-cabinet]");
      await expect(async () => {
        const launch = page.getByRole("button", { name: /Launch Cabinet/i });
        if (await launch.isVisible()) await launch.click();
        await expect(cabinet).toBeVisible({ timeout: 2000 });
      }).toPass({ timeout: 15000 });
      await expect(
        cabinet.getByRole("button", { name: /Enter Fullscreen/i })
      ).toHaveCount(1);
      await cabinet.getByRole("button", { name: /Enter Fullscreen/i }).click();
      await expect(cabinet).toHaveAttribute("data-fullscreen", "true");
      const canvas = cabinet.locator("canvas").first();
      if (game !== "quasi-puzzler") {
        await expect(canvas).toBeVisible();
        await canvas.scrollIntoViewIfNeeded();
        const bounds = await canvas.boundingBox();
        expect(bounds).not.toBeNull();
        expect(bounds!.x).toBeGreaterThanOrEqual(0);
        expect(bounds!.width).toBeGreaterThan(100);
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(view.width + 1);
        expect(bounds!.y).toBeGreaterThanOrEqual(0);
        expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(view.height + 1);
      }
      if (game === "retro-labyrinth" && view.name === "landscape") {
        await expectFullyVisible(
          cabinet.getByRole("button", { name: "Move Down", exact: true }),
          view
        );
      }
      if (game === "laser-loon") {
        await cabinet.getByRole("button", { name: /START CAMPAIGN/ }).click();
        await cabinet.getByRole("button", { name: /ENGAGE STAGE/ }).click();
        const fire = cabinet.getByRole("button", {
          name: "Primary Fire",
          exact: true,
        });
        await expectFullyVisible(fire, view);
        await fire.dispatchEvent("pointerdown", { pointerId: 1 });
        await fire.dispatchEvent("pointerup", { pointerId: 1 });
        await cabinet
          .getByRole("button", { name: "3: Aurora", exact: true })
          .click();
      }
      // An in-game dialog owns the first Escape; a subsequent Escape exits
      // pseudo-fullscreen after that topmost focus trap closes.
      await expect(async () => {
        if ((await cabinet.getAttribute("data-fullscreen")) === "true") {
          await page.keyboard.press("Escape");
        }
        await expect(cabinet).toHaveAttribute("data-fullscreen", "false", {
          timeout: 2000,
        });
      }).toPass({ timeout: 15000 });
      await expect(
        page.getByRole("button", { name: /Enter Fullscreen/i }).first()
      ).toBeVisible();
    });
  }
}
