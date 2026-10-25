import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// The Labyrinth hotbar at desktop sizes (#2840, playtest finding N2). At
// 1024x768 the five slots, the Market and its closed note used to wrap to a
// second row and push the controls hint below the fold.
const ROUTE = "/arcade/retro-labyrinth";
const CONTROLS = ".arcade-labyrinth-controls";

async function launch(page: Page) {
  await page.goto(ROUTE);
  const launchButton = page.getByRole("button", { name: /Launch Cabinet/i });
  await expect(async () => {
    if ((await launchButton.count()) > 0) {
      await launchButton.first().click({ timeout: 2000 });
    }
    await expect(page.locator(CONTROLS)).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 90000 });
  await expect(
    page.getByRole("button", { name: /^\[1\]/ }).first()
  ).toBeVisible({ timeout: 90000 });
}

/** The rows the hotbar's slots, Market and closed-market note sit on. */
async function hotbarRows(page: Page): Promise<number> {
  return page.evaluate((selector) => {
    const row = document.querySelector(`${selector} > div > div`);
    const tops = Array.from(row?.children ?? [])
      .map((child) => child.getBoundingClientRect())
      .filter((rect) => rect.width > 1)
      .map((rect) => rect.top)
      .sort((a, b) => a - b);
    // Items on one line differ by a few pixels of padding, not a line.
    return tops.filter((top, i) => i === 0 || top - tops[i - 1] > 8).length;
  }, CONTROLS);
}

/** Whether every text span inside the first slot is drawn. */
async function firstSlotFullyShown(page: Page): Promise<boolean> {
  return page.evaluate((selector) => {
    const slot = document.querySelector(`${selector} > div > div button`);
    return Array.from(slot?.querySelectorAll("span") ?? []).every(
      (span) => span.getBoundingClientRect().width > 1
    );
  }, CONTROLS);
}

test.describe("Retro Labyrinth desktop hotbar (#2840)", () => {
  test("stays on one row at 1024x768 with the hint above the fold", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await launch(page);

    expect(await hotbarRows(page)).toBe(1);
    const hint = page.getByText(/WASD \/ ARROWS/);
    await expect(hint).toBeInViewport({ ratio: 1 });

    // A compact slot draws its key and charges, and keeps its tool name in
    // its accessible name.
    expect(await firstSlotFullyShown(page)).toBe(false);
    await expect(
      page.getByRole("button", { name: /^\[1\] \S.*\(\d+\)$/ })
    ).toBeVisible();

    const results = await new AxeBuilder({ page }).include(CONTROLS).analyze();
    expect(
      results.violations.filter((violation) =>
        ["critical", "serious", "moderate"].includes(violation.impact ?? "")
      )
    ).toEqual([]);
  });

  test("shows a compact slot's tool name while it has keyboard focus", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await launch(page);
    const slot = page.getByRole("button", { name: /^\[1\]/ }).first();
    const before = (await slot.boundingBox())?.width ?? 0;
    await slot.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect(slot).toBeFocused();
    expect((await slot.boundingBox())?.width ?? 0).toBeGreaterThan(before);
  });

  for (const [width, height] of [
    [1280, 800],
    [1440, 900],
  ] as const) {
    test(`keeps the tool names on show at ${width}x${height}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height });
      await launch(page);
      expect(await firstSlotFullyShown(page)).toBe(true);
    });
  }
});
