import { test, expect, type Locator, type Page } from "@playwright/test";

// Tap-to-pick, tap-to-place on the Protocol Drift toolbox (#2360, ADR 0062).
// These run only in the iPad projects in playwright.config.ts: Protocol Drift
// is gated on phones, and HTML5 drag out of the toolbox does nothing on a
// touch screen, so a long-press picks a chip and a tap on the canvas places it.
const ROUTE = "/protocol-drift";
const IMMERSIVE = '[data-arcade-cabinet][data-immersive="true"]';
const ROOT = ".pd-touch";
const PANE = `${ROOT} .react-flow__pane`;
const BANNER = '[data-testid="chip-pick-banner"]';
const CHIP = (kind: string) =>
  `${ROOT} .react-flow__node:has([data-chip-kind="${kind}"])`;

/** Launches the cabinet and accepts the briefing, so the workbench is in DRAFT. */
async function launch(page: Page) {
  const button = page.getByRole("button", { name: /Launch Cabinet/i });
  await expect(async () => {
    if ((await page.locator(IMMERSIVE).count()) > 0) return;
    await button.tap({ timeout: 5000 });
    await expect(page.locator(IMMERSIVE)).toBeVisible({ timeout: 5000 });
  }).toPass({ timeout: 180000 });
  await expect(page.locator(ROOT)).toBeVisible({ timeout: 90000 });
  await page
    .getByRole("button", { name: /accept assignment/i })
    .tap({ timeout: 15000 });
}

/**
 * Holds a still touch pointer on the element past the long-press time.
 * Playwright's touchscreen only taps, so the pointer events are dispatched in
 * the page; the hook reads pointer events in every engine.
 */
async function longPress(target: Locator) {
  await target.evaluate(async (el) => {
    const rect = el.getBoundingClientRect();
    const init: PointerEventInit = {
      pointerId: 41,
      pointerType: "touch",
      isPrimary: true,
      bubbles: true,
      cancelable: true,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
    };
    el.dispatchEvent(new PointerEvent("pointerdown", init));
    await new Promise((resolve) => setTimeout(resolve, 600));
    el.dispatchEvent(new PointerEvent("pointerup", init));
  });
}

test.describe("Protocol Drift toolbox pick and place (iPad projects, #2360)", () => {
  test.setTimeout(300000);

  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(
      !/^iPad/.test(testInfo.project.name),
      "iPad projects only (ADR 0061)"
    );
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(ROUTE);
  });

  test("a long-press picks a chip and a tap on the canvas places it", async ({
    page,
  }) => {
    await launch(page);
    const source = page.getByRole("button", { name: /add SourceIngest /i });
    await longPress(source);
    await expect(source).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(BANNER)).toContainText(
      "Tap the canvas to place SourceIngest."
    );
    await expect(page.locator(CHIP("SourceIngest"))).toHaveCount(0);

    await page.locator(PANE).tap({ position: { x: 160, y: 120 } });
    await expect(page.locator(CHIP("SourceIngest"))).toBeVisible();
    await expect(source).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator(BANNER)).toHaveCount(0);
  });

  test("Cancel puts a picked chip back and a plain tap still adds", async ({
    page,
  }) => {
    await launch(page);
    const extract = page.getByRole("button", { name: /add ExtractField /i });
    await longPress(extract);
    await expect(extract).toHaveAttribute("aria-pressed", "true");
    await page.locator(BANNER).getByRole("button", { name: "Cancel" }).tap();
    await expect(extract).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator(CHIP("ExtractField"))).toHaveCount(0);

    await extract.tap();
    await expect(page.locator(CHIP("ExtractField"))).toBeVisible();
  });
});
