import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { assertNoHorizontalOverflow } from "./mobile-harness";

// Retro Labyrinth on a phone (ADR 0061). The cabinet declares a landscape
// layout: on a phone held upright the rotate prompt covers it, and turned
// sideways the maze fills the stage with the controls either side. These
// specs run on the touch projects only, and always play sideways.
const ROUTE = "/arcade/retro-labyrinth";
const IMMERSIVE = '[data-arcade-cabinet][data-immersive="true"]';
const PLAYFIELD = ".arcade-labyrinth-playfield";
const STAGE = `${IMMERSIVE} .arcade-cabinet-stage`;
const BLOCKING = new Set(["critical", "serious", "moderate"]);
// The phone bar's touch target floor (ADR 0061, rule 4).
const MIN_TARGET_PX = 44;

/** Taps Launch until the cabinet is immersive. Retries only while Launch is up. */
async function launchCabinet(page: Page) {
  const launch = page.getByRole("button", { name: /Launch Cabinet/i });
  await expect(async () => {
    if ((await launch.count()) > 0) {
      await launch.tap({ timeout: 2000 });
    }
    await expect(page.locator(IMMERSIVE)).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 90000 });
  // The game loads as a separate chunk behind a "Building the dungeon" stub.
  // Wait for its controls, so the checks below run against the mounted game.
  await expect(
    page.getByRole("button", { name: "Fire EMP burst" })
  ).toBeVisible({ timeout: 90000 });
}

/** Turns the emulated phone sideways, whatever the project's default. */
async function turnSideways(page: Page) {
  const size = page.viewportSize();
  expect(size).not.toBeNull();
  await page.setViewportSize({
    width: Math.max(size!.width, size!.height),
    height: Math.min(size!.width, size!.height),
  });
}

/** The score and floor as the phone HUD shows them. */
async function readHud(page: Page) {
  return {
    score: (
      await page.getByTestId("labyrinth-phone-score").textContent()
    )?.trim(),
    floor: (
      await page.getByTestId("labyrinth-phone-floor").textContent()
    )?.trim(),
  };
}

/** Where the netrunner stands, from the accessible status subtree. */
async function readPlayerGrid(page: Page): Promise<string> {
  const text = await page
    .locator("output", { hasText: "Player Location" })
    .first()
    .textContent();
  return text ?? "";
}

test.describe("Retro Labyrinth on a phone", () => {
  // A cold game chunk on a dev server can take most of a minute to compile.
  test.setTimeout(240000);

  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(!testInfo.project.use.hasTouch, "touch projects only");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(ROUTE);
  });

  test("launches sideways with the maze in the stage and nothing clipped", async ({
    page,
  }) => {
    await turnSideways(page);
    await launchCabinet(page);

    const cabinet = page.locator(IMMERSIVE);
    await expect(cabinet).toHaveAttribute("data-mobile-layout", "fit");
    const viewport = page.viewportSize()!;
    const box = await cabinet.boundingBox();
    expect(box?.width).toBeCloseTo(viewport.width, 0);
    expect(box?.height).toBeCloseTo(viewport.height, 0);

    await assertNoHorizontalOverflow(page);

    // Nothing essential is below the fold: the playfield and the stage both
    // fit their own boxes, so no hidden strip is clipped off the bottom.
    const fit = await page.locator(PLAYFIELD).evaluate((el) => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    }));
    expect(fit.scrollHeight).toBeLessThanOrEqual(fit.clientHeight + 1);
    const stage = await page.locator(STAGE).evaluate((el) => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    }));
    expect(stage.scrollHeight).toBeLessThanOrEqual(stage.clientHeight + 1);

    // The maze fills the stage in the declared orientation.
    const canvas = await page
      .locator(`${PLAYFIELD} canvas`)
      .first()
      .boundingBox();
    expect(canvas).not.toBeNull();
    // Judged by its sides: the maze fills the largest 5:3 box its dock leaves,
    // so at 568x320 it is width-bound (about 300x180 CSS px).
    expect(canvas!.height).toBeGreaterThanOrEqual(viewport.height * 0.5);
    expect(canvas!.width).toBeGreaterThanOrEqual(viewport.width * 0.5);
  });

  test("every phone control is at least 44px square", async ({ page }) => {
    await turnSideways(page);
    await launchCabinet(page);

    // The four pad arrows and the six action slots are touch buttons; the HUD's
    // Options button is a plain button, so it joins the set on its own.
    const field = page.locator(PLAYFIELD);
    const controls = field
      .locator("[data-touch-button], [data-hold-dpad] button")
      .or(field.getByRole("button", { name: "Options", exact: true }));
    const count = await controls.count();
    expect(count).toBeGreaterThanOrEqual(11);
    for (let i = 0; i < count; i++) {
      const box = await controls.nth(i).boundingBox();
      expect(box, `control ${i}`).not.toBeNull();
      expect(box!.width, `control ${i} width`).toBeGreaterThanOrEqual(
        MIN_TARGET_PX - 0.5
      );
      expect(box!.height, `control ${i} height`).toBeGreaterThanOrEqual(
        MIN_TARGET_PX - 0.5
      );
    }
  });

  test("plays with taps only until the score or the floor changes", async ({
    page,
  }) => {
    await turnSideways(page);
    await launchCabinet(page);
    const start = await readHud(page);
    const moves = ["Move Right", "Move Down", "Move Left", "Move Up"];

    let changed = false;
    for (let step = 0; step < 240 && !changed; step++) {
      // Fire the EMP now and then: it is how a bug is cleared for score.
      if (step % 4 === 3) {
        await page.getByRole("button", { name: "Fire EMP burst" }).tap();
      } else {
        await page
          .getByRole("button", {
            name: moves[(step + Math.floor(step / 3)) % 4],
          })
          .tap();
      }
      const retry = page.getByRole("button", { name: /RETRY BREACH/i });
      if (await retry.isVisible()) await retry.tap();
      const next = page.getByRole("button", { name: /^Next Room$/ });
      if (await next.isVisible()) await next.tap();
      const now = await readHud(page);
      changed = now.score !== start.score || now.floor !== start.floor;
    }
    expect(changed, "a tap-only run should change the score or the floor").toBe(
      true
    );
  });

  test("a swipe across the maze moves one step, and a tap does nothing", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", "touch swipes use the CDP touch API");
    await turnSideways(page);
    await launchCabinet(page);

    const canvas = await page
      .locator(`${PLAYFIELD} canvas`)
      .first()
      .boundingBox();
    expect(canvas).not.toBeNull();
    const cx = canvas!.x + canvas!.width / 2;
    const cy = canvas!.y + canvas!.height / 2;
    const before = await readPlayerGrid(page);

    const cdp = await page.context().newCDPSession(page);
    // A tap: no movement.
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: cx, y: cy }],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    expect(await readPlayerGrid(page)).toBe(before);

    // A drag to the right: one step.
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: cx - 40, y: cy }],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: cx + 20, y: cy }],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await expect(
      page.locator("output", { hasText: "Player Location" }).first()
    ).not.toHaveText(before);
  });

  test("holding a d-pad arrow walks, and releasing it stops", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", "touch holds use the CDP touch API");
    await turnSideways(page);
    await launchCabinet(page);

    const arrow = page.getByRole("button", { name: "Move Right" });
    const box = await arrow.boundingBox();
    expect(box).not.toBeNull();
    const cx = box!.x + box!.width / 2;
    const cy = box!.y + box!.height / 2;
    const before = await readPlayerGrid(page);

    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: cx, y: cy }],
    });
    // Press long enough for the hold repeat to start and run a few steps.
    await page.waitForTimeout(900);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    const held = await readPlayerGrid(page);
    expect(held, "a held arrow should walk more than one cell").not.toBe(
      before
    );

    // After release the walk stops.
    await page.waitForTimeout(600);
    expect(await readPlayerGrid(page)).toBe(held);
  });

  test("the phone pauses when the tab hides and resumes on a tap", async ({
    page,
  }) => {
    await turnSideways(page);
    await launchCabinet(page);

    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => "hidden",
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect(page.getByText("PAUSED", { exact: true })).toBeVisible();
    await expect(page.getByText("Tap Resume")).toBeVisible();

    await page.evaluate(() => {
      // @ts-expect-error restoring the browser's own property
      delete document.visibilityState;
    });
    await page.getByRole("button", { name: "Resume", exact: true }).tap();
    await expect(page.getByText("PAUSED", { exact: true })).toHaveCount(0);
  });

  test("the options sheet opens over the maze, pauses the room, and closes", async ({
    page,
  }) => {
    await turnSideways(page);
    await launchCabinet(page);

    await page.getByRole("button", { name: "Options", exact: true }).tap();
    const sheet = page.getByTestId("labyrinth-options-sheet");
    await expect(sheet).toBeVisible();
    await expect(page.getByText("PAUSED", { exact: true })).toBeVisible();

    await sheet.getByRole("button", { name: "Close options" }).tap();
    await expect(sheet).toHaveCount(0);
  });

  test("turned upright the rotate prompt covers the cabinet, and turning back clears it", async ({
    page,
  }) => {
    await turnSideways(page);
    await launchCabinet(page);
    const prompt = page.getByTestId("rotate-device-prompt");
    await expect(prompt).toHaveCount(0);

    const size = page.viewportSize()!;
    await page.setViewportSize({
      width: Math.min(size.width, size.height),
      height: Math.max(size.width, size.height),
    });
    await expect(prompt).toBeVisible();
    await expect(prompt).toContainText("landscape");

    await turnSideways(page);
    await expect(prompt).toHaveCount(0);
  });

  test("has no blocking axe violations over the phone cabinet", async ({
    page,
  }) => {
    await turnSideways(page);
    await launchCabinet(page);

    const results = await new AxeBuilder({ page })
      .include(IMMERSIVE)
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const blocking = results.violations
      .filter((v) => BLOCKING.has(v.impact ?? ""))
      .map((v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s)`);
    expect(blocking).toEqual([]);
  });
});
