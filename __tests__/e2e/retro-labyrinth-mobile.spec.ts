import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import path from "node:path";
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
    page.getByRole("button", { name: "EMP: fire an EMP burst" })
  ).toBeVisible({ timeout: 90000 });
}

// The landscape sizes the phone layout is checked at (ADR 0061).
const LANDSCAPE_SIZES: ReadonlyArray<readonly [number, number]> = [
  [568, 320],
  [812, 375],
  [844, 390],
];
const RESULT_SIZES: ReadonlyArray<readonly [number, number]> = [
  [568, 320],
  [844, 390],
];

/** Phone controls whose text is cut off, by their visible label. */
async function clippedControls(page: Page): Promise<string[]> {
  return page.evaluate((selector) => {
    const root = document.querySelector(selector);
    if (!root) return ["no immersive cabinet"];
    const cut: string[] = [];
    root.querySelectorAll<HTMLElement>("button, span, p, h3").forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.width < 2 || !el.textContent?.trim()) return;
      const ellipsis = getComputedStyle(el).textOverflow === "ellipsis";
      const overflowing = el.scrollWidth > el.clientWidth + 1;
      if (overflowing && (el.tagName === "BUTTON" || ellipsis)) {
        cut.push(el.textContent.trim());
      }
    });
    return cut;
  }, IMMERSIVE);
}

/** Saves a screenshot as an attachment, and to LABYRINTH_SCREENS_DIR when set. */
async function shoot(page: Page, testInfo: TestInfo, name: string) {
  const body = await page.screenshot();
  await testInfo.attach(name, { body, contentType: "image/png" });
  const dir = process.env.LABYRINTH_SCREENS_DIR;
  if (dir) {
    await writeFile(path.join(dir, `${name}.png`), body);
  }
}

/**
 * Cells of the patrols still able to catch the player, read from the game's
 * React state. The maze is a canvas, so the state is the only place they are
 * named. Test-only: it walks the fiber tree from the phone HUD.
 */
async function patrolCells(
  page: Page
): Promise<Array<{ x: number; y: number }>> {
  return page.evaluate(() => {
    const hud = document.querySelector('[data-testid="labyrinth-phone-score"]');
    const key =
      hud && Object.keys(hud).find((k) => k.startsWith("__reactFiber$"));
    if (!hud || !key) return [];
    type Hook = { memoizedState: unknown; next: Hook | null };
    type Fiber = { memoizedState: Hook | null; return: Fiber | null };
    let fiber: Fiber | null = (hud as unknown as Record<string, Fiber>)[key];
    while (fiber) {
      for (let hook = fiber.memoizedState; hook; hook = hook.next) {
        const value = hook.memoizedState;
        if (
          Array.isArray(value) &&
          value.some((v) => v && typeof v === "object" && "patrolDir" in v)
        ) {
          return (value as Array<{ x: number; y: number; state: string }>)
            .filter((e) => e.state !== "stunned" && e.state !== "frozen")
            .map(({ x, y }) => ({ x, y }));
        }
      }
      fiber = fiber.return;
    }
    return [];
  });
}

/** The player's grid cell, from the accessible status subtree. */
async function playerCell(
  page: Page
): Promise<{ x: number; y: number } | null> {
  const match = /\((\d+),\s*(\d+)\)/.exec(await readPlayerGrid(page));
  return match ? { x: Number(match[1]), y: Number(match[2]) } : null;
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
        await page
          .getByRole("button", { name: "EMP: fire an EMP burst" })
          .tap();
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

  test("launching the cabinet does not scroll the page, and leaving restores the preview", async ({
    page,
  }) => {
    await turnSideways(page);
    const launch = page.getByRole("button", { name: /Launch Cabinet/i });
    await launch.scrollIntoViewIfNeeded();
    await expect(launch).toBeVisible();
    // The page must be scrolled, or the test proves nothing about the jump.
    const before = await page.evaluate(() => window.scrollY);
    expect(before).toBeGreaterThan(0);

    await launch.tap();
    await expect(page.locator(IMMERSIVE)).toBeVisible({ timeout: 90000 });
    // The cabinet pins the body while it runs, which reads as scrollY 0, and
    // the cabinet itself starts at the top of the viewport.
    expect((await page.locator(IMMERSIVE).boundingBox())?.y).toBeCloseTo(0, 0);

    await page.getByRole("button", { name: "Reset / Power Off Cabinet" }).tap();
    await expect(launch).toBeVisible();
    // Leaving brings the preview back to the top of the viewport, as the
    // cabinet intends, so the player is not left at the stale pinned offset.
    await expect
      .poll(() =>
        page
          .locator('[data-game="retro-labyrinth"]')
          .first()
          .evaluate((el) => Math.round(el.getBoundingClientRect().top))
      )
      .toBeLessThanOrEqual(1);
  });

  test("no phone label is cut off with an ellipsis at the landscape sizes", async ({
    page,
  }) => {
    await turnSideways(page);
    await launchCabinet(page);
    for (const [width, height] of LANDSCAPE_SIZES) {
      await page.setViewportSize({ width, height });
      await expect
        .poll(
          () => clippedControls(page),
          `clipped labels at ${width}x${height}`
        )
        .toEqual([]);
    }
  });

  test("a rotation mid-run pauses the room, and it resumes only on Resume", async ({
    page,
  }) => {
    await turnSideways(page);
    await launchCabinet(page);
    const paused = page.getByText("PAUSED", { exact: true });
    const prompt = page.getByTestId("rotate-device-prompt");
    await expect(paused).toHaveCount(0);

    const size = page.viewportSize()!;
    await page.setViewportSize({
      width: Math.min(size.width, size.height),
      height: Math.max(size.width, size.height),
    });
    await expect(prompt).toBeVisible();
    await expect(paused).toBeVisible();

    await turnSideways(page);
    await expect(prompt).toHaveCount(0);
    await expect(paused).toBeVisible();

    await page.getByRole("button", { name: "Resume", exact: true }).tap();
    await expect(paused).toHaveCount(0);
    const start = await readPlayerGrid(page);
    const moves = ["Move Up", "Move Right", "Move Down", "Move Left"];
    let moved = false;
    for (let i = 0; i < moves.length && !moved; i++) {
      await page.getByRole("button", { name: moves[i] }).tap();
      moved = (await readPlayerGrid(page)) !== start;
    }
    expect(
      moved,
      "a move after Resume should change the player's grid cell"
    ).toBe(true);
  });

  test("a lost run shows a result card that fits, and RETRY BREACH restarts it by touch", async ({
    page,
  }, testInfo) => {
    test.setTimeout(480000);
    await turnSideways(page);
    await launchCabinet(page);

    // Patrols only move when the player does, and a player who stands still
    // is never reached. So the run walks at the nearest patrol, one tap at a
    // time, until one of them traces the player and HP reaches zero.
    const retry = page.getByRole("button", { name: /RETRY BREACH/i });
    const moves = ["Move Up", "Move Right", "Move Down", "Move Left"];
    for (let step = 0; step < 900 && !(await retry.isVisible()); step++) {
      const from = await playerCell(page);
      const patrols = await patrolCells(page);
      const target = from && patrols[0];
      if (from && target) {
        const nearest = patrols.reduce((best, p) =>
          Math.abs(p.x - from.x) + Math.abs(p.y - from.y) <
          Math.abs(best.x - from.x) + Math.abs(best.y - from.y)
            ? p
            : best
        );
        const dx = nearest.x - from.x;
        const dy = nearest.y - from.y;
        const horizontal =
          dx !== 0 ? (dx > 0 ? "Move Right" : "Move Left") : null;
        const vertical = dy !== 0 ? (dy > 0 ? "Move Down" : "Move Up") : null;
        const ordered =
          Math.abs(dx) >= Math.abs(dy)
            ? [horizontal, vertical]
            : [vertical, horizontal];
        for (const name of ordered.filter((n): n is string => n !== null)) {
          await page
            .getByRole("button", { name })
            .tap({ timeout: 5000 })
            .catch(() => undefined);
          const now = await playerCell(page);
          if (now && (now.x !== from.x || now.y !== from.y)) break;
        }
      } else {
        await page
          .getByRole("button", { name: moves[step % 4] })
          .tap({ timeout: 5000 })
          .catch(() => undefined);
      }
      const next = page.getByRole("button", { name: /^Next Room$/ });
      if (await next.isVisible()) await next.tap({ timeout: 5000 });
    }
    await expect(retry).toBeVisible({ timeout: 15000 });

    for (const [width, height] of RESULT_SIZES) {
      await page.setViewportSize({ width, height });
      await expect(retry).toBeVisible();
      const box = await retry.boundingBox();
      expect(
        box!.height,
        `restart height at ${width}x${height}`
      ).toBeGreaterThanOrEqual(MIN_TARGET_PX);
      expect(
        box!.width,
        `restart width at ${width}x${height}`
      ).toBeGreaterThanOrEqual(MIN_TARGET_PX);
      const field = await page.locator(PLAYFIELD).boundingBox();
      expect(box!.y).toBeGreaterThanOrEqual(field!.y);
      expect(box!.y + box!.height).toBeLessThanOrEqual(
        field!.y + field!.height
      );
      await assertNoHorizontalOverflow(page);
      await shoot(page, testInfo, `result-card-${width}x${height}`);
    }

    await retry.tap();
    await expect(retry).toHaveCount(0);
    const start = await readPlayerGrid(page);
    let moved = false;
    for (let i = 0; i < moves.length && !moved; i++) {
      await page.getByRole("button", { name: moves[i] }).tap();
      moved = (await readPlayerGrid(page)) !== start;
    }
    expect(moved, "the restarted run should take a move").toBe(true);
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
