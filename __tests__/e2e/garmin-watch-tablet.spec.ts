import { test, expect, type Locator, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { assertNoHorizontalOverflow } from "./mobile-harness";
import { waitForAnimationFrames } from "./helpers/settle";

// Monkey C Mayhem on the iPad (#2122, ADR 0061). These run only in the iPad
// projects in playwright.config.ts: the watch, its touch dock and the Connect
// IQ companion share the immersive cabinet without page scroll, and a run
// plays by touch alone.
const ROUTE = "/arcade/garmin-watch";
const IMMERSIVE = '[data-arcade-cabinet][data-immersive="true"]';
const NOTICE = '[data-testid="desktop-only-notice"]';
const ROOT = ".garmin-sim.garmin-touch";
const LAYOUT = `${ROOT} .garmin-layout`;
const DOCK = '[data-testid="garmin-touch-dock"]';
const BLOCKING = new Set(["critical", "serious", "moderate"]);

const dockKey = (page: Page, id: string) =>
  page.locator(`${DOCK} [data-dock-key="${id}"]`);
const face = (page: Page) =>
  page.getByRole("img", { name: /Smartwatch display simulator/ });

/** Launches the cabinet and waits for the watch's touch layout and dock. */
async function launch(page: Page) {
  const button = page.getByRole("button", { name: /Launch Cabinet/i });
  await expect(async () => {
    if ((await page.locator(IMMERSIVE).count()) > 0) return;
    await button.tap({ timeout: 5000 });
    await expect(page.locator(IMMERSIVE)).toBeVisible({ timeout: 5000 });
  }).toPass({ timeout: 180000 });
  await expect(page.locator(ROOT)).toBeVisible({ timeout: 90000 });
  await expect(page.locator(DOCK)).toBeVisible();
}

/** Taps START on the dock until the run is live. */
async function startRun(page: Page) {
  await expect(async () => {
    await dockKey(page, "start").tap({ timeout: 3000 });
    await expect(face(page)).toHaveAttribute("aria-label", /Status: playing/, {
      timeout: 3000,
    });
  }).toPass({ timeout: 30000 });
}

/** Every box matching each selector sits wholly inside the viewport. */
async function expectInsideViewport(page: Page, selectors: string[]) {
  const viewport = page.viewportSize()!;
  for (const selector of selectors) {
    const boxes = page.locator(selector);
    const count = await boxes.count();
    expect(count, `${selector} is on screen`).toBeGreaterThan(0);
    for (let i = 0; i < count; i += 1) {
      const box = await boxes.nth(i).boundingBox();
      if (!box || box.width <= 1) continue;
      expect(box.x, `${selector} ${i} left`).toBeGreaterThanOrEqual(-1);
      expect(box.y, `${selector} ${i} top`).toBeGreaterThanOrEqual(-1);
      expect(box.x + box.width, `${selector} ${i} right`).toBeLessThanOrEqual(
        viewport.width + 1
      );
      expect(box.y + box.height, `${selector} ${i} bottom`).toBeLessThanOrEqual(
        viewport.height + 1
      );
    }
  }
}

/** Controls under 44px and text under 12px in the touch layout. */
async function expectTouchSizes(page: Page) {
  const small = await page.evaluate((selector) => {
    const root = document.querySelector(selector);
    if (!root) return ["no layout root"];
    const offenders: string[] = [];
    root.querySelectorAll<HTMLElement>("button, select").forEach((control) => {
      const box = control.getBoundingClientRect();
      if (box.width <= 1 || getComputedStyle(control).visibility === "hidden")
        return;
      if (box.width < 43.5 || box.height < 43.5) {
        offenders.push(
          `${Math.round(box.width)}x${Math.round(box.height)} ${control.getAttribute("aria-label") ?? control.textContent?.trim().slice(0, 30)}`
        );
      }
    });
    root.querySelectorAll<HTMLElement>("*").forEach((node) => {
      if (node instanceof SVGElement) return;
      const own = Array.from(node.childNodes).some(
        (child) =>
          child.nodeType === Node.TEXT_NODE &&
          (child.textContent ?? "").trim().length > 0
      );
      if (!own) return;
      const style = getComputedStyle(node);
      if (style.display === "none") return;
      if (parseFloat(style.fontSize) < 12) {
        offenders.push(
          `text ${style.fontSize} ${node.textContent?.trim().slice(0, 30)}`
        );
      }
    });
    return offenders.slice(0, 10);
  }, LAYOUT);
  expect(small).toEqual([]);
}

/**
 * Holds a dock key with a finger while `whileHeld` runs, then lifts it, even
 * if `whileHeld` throws.
 */
async function holdKey(
  page: Page,
  locator: Locator,
  whileHeld: () => Promise<void>
) {
  const box = (await locator.boundingBox())!;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { x: box.x + box.width / 2, y: box.y + box.height / 2, id: 1 },
    ],
  });
  try {
    await whileHeld();
  } finally {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
  }
}

test.describe("Monkey C Mayhem on a tablet (iPad projects, #2122)", () => {
  test.setTimeout(300000);

  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(
      !/^iPad/.test(testInfo.project.name),
      "iPad projects only (ADR 0061)"
    );
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(ROUTE);
  });

  test("the notice is hidden, and the cabinet launches fit to the viewport", async ({
    page,
  }) => {
    await expect(page.locator(NOTICE)).toBeHidden();
    await launch(page);
    await expect(page.locator(IMMERSIVE)).toHaveAttribute(
      "data-mobile-layout",
      "fit"
    );
    const viewport = page.viewportSize()!;
    const box = (await page.locator(IMMERSIVE).boundingBox())!;
    expect(box.width).toBeCloseTo(viewport.width, 0);
    expect(box.height).toBeCloseTo(viewport.height, 0);
    await assertNoHorizontalOverflow(page);
  });

  test("the watch, dock and companion fit both orientations without page scroll", async ({
    page,
  }) => {
    await launch(page);
    await startRun(page);
    const { width, height } = page.viewportSize()!;
    for (const size of [
      { width, height },
      { width: height, height: width },
    ]) {
      await page.setViewportSize(size);
      await expect(page.locator(ROOT)).toBeVisible();
      await expectInsideViewport(page, [
        `${ROOT} .garmin-watch-frame`,
        `${ROOT} [data-pusher]`,
        DOCK,
        `${ROOT} .garmin-companion`,
      ]);
      // The watch is the biggest thing on the screen.
      const frame = (await page
        .locator(`${ROOT} .garmin-watch-frame`)
        .boundingBox())!;
      expect(frame.height / size.height).toBeGreaterThanOrEqual(
        size.width > size.height ? 0.7 : 0.45
      );
      // The companion stays clear of the floating toolbar.
      const toolbar = (await page
        .getByTestId("cabinet-touch-toolbar")
        .boundingBox())!;
      const companion = (await page
        .locator(`${ROOT} .garmin-companion`)
        .boundingBox())!;
      const overlaps =
        companion.x < toolbar.x + toolbar.width &&
        companion.x + companion.width > toolbar.x &&
        companion.y < toolbar.y + toolbar.height &&
        companion.y + companion.height > toolbar.y;
      expect(overlaps).toBe(false);
      await assertNoHorizontalOverflow(page);
      expect(
        await page.evaluate(
          () => document.scrollingElement!.scrollHeight - window.innerHeight
        )
      ).toBeLessThanOrEqual(1);
    }
  });

  test("every control is 44px and no text is under 12px: idle, running, paused", async ({
    page,
  }) => {
    await launch(page);
    await expectTouchSizes(page);
    await startRun(page);
    await expectTouchSizes(page);
    await dockKey(page, "start").tap();
    await expect(face(page)).toHaveAttribute("aria-label", /Status: paused/);
    await expectTouchSizes(page);
  });

  test("a run plays by touch: holding Sprint and Jump keeps the run going and scoring", async ({
    page,
  }) => {
    await launch(page);
    await startRun(page);
    const scoreOf = async () =>
      Number(
        /Score: (\d+)/.exec(
          (await face(page).getAttribute("aria-label")) ?? ""
        )?.[1] ?? 0
      );
    const before = await scoreOf();
    // Sprint until the run scores, then a held jump (about 300 ms of frames).
    await holdKey(page, dockKey(page, "sprint"), () =>
      expect.poll(scoreOf).toBeGreaterThan(before)
    );
    await holdKey(page, dockKey(page, "jump"), () =>
      waitForAnimationFrames(page, 18)
    );
    expect(await scoreOf()).toBeGreaterThan(before);
    await expect(face(page)).toHaveAttribute("aria-label", /Status: playing/);
  });

  test("Escape pauses a run and resumes it without leaving the cabinet", async ({
    page,
  }) => {
    await launch(page);
    await startRun(page);
    await page.keyboard.press("Escape");
    await expect(face(page)).toHaveAttribute("aria-label", /Status: paused/);
    await expect(page.locator(IMMERSIVE)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(face(page)).toHaveAttribute("aria-label", /Status: playing/);
    await expect(page.locator(IMMERSIVE)).toBeVisible();
  });

  test("hiding the app pauses a run in progress", async ({ page }) => {
    await launch(page);
    await startRun(page);
    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    await expect(face(page)).toHaveAttribute("aria-label", /Status: paused/);
  });

  test("a keyboard case hides the dock and the arrow keys still play", async ({
    page,
  }) => {
    await launch(page);
    await startRun(page);
    await page.keyboard.down("ArrowRight");
    await expect(page.locator("[data-touch-controls]")).toHaveAttribute(
      "data-touch-controls",
      "hidden"
    );
    await page.keyboard.up("ArrowRight");
    await page.keyboard.press("p");
    await expect(face(page)).toHaveAttribute("aria-label", /Status: paused/);
  });

  test("Apple Pencil drives the dock like a finger", async ({ page }) => {
    await launch(page);
    const start = (await dockKey(page, "start").boundingBox())!;
    await page.evaluate(
      ({ x, y }) => {
        const target = document.elementFromPoint(x, y)!;
        const init = {
          bubbles: true,
          pointerType: "pen",
          pointerId: 9,
          clientX: x,
          clientY: y,
        };
        target.dispatchEvent(new PointerEvent("pointerdown", init));
        target.dispatchEvent(new PointerEvent("pointerup", init));
        (target.closest("button") as HTMLButtonElement).click();
      },
      { x: start.x + start.width / 2, y: start.y + start.height / 2 }
    );
    await expect(face(page)).toHaveAttribute("aria-label", /Status: playing/);
    await expect(page.locator("[data-touch-controls]")).toHaveAttribute(
      "data-touch-controls",
      "shown"
    );
  });

  test("the Training Plan map and gear bag work from the dock", async ({
    page,
  }) => {
    await launch(page);
    await page.getByRole("radio", { name: "Training Plan" }).tap();
    await expect(page.locator(DOCK)).toHaveAttribute("data-mode", "plan");
    await expect(face(page)).toHaveAttribute("aria-label", /Morning Report/);
    await dockKey(page, "start").tap();
    await expect(face(page)).toHaveAttribute("aria-label", /Training Plan map/);
    await dockKey(page, "action").tap();
    const bag = page.getByRole("dialog", { name: /Gear bag/ });
    await expect(bag).toBeVisible();
    await expectInsideViewport(page, ['[role="dialog"]']);
    await page.keyboard.press("Escape");
    await expect(bag).toBeHidden();
    await expect(page.locator(IMMERSIVE)).toBeVisible();
    await dockKey(page, "back").tap();
    await expect(face(page)).toHaveAttribute("aria-label", /Morning Report/);
  });

  test("the cabinet has no blocking axe violations while a run is paused", async ({
    page,
  }) => {
    await launch(page);
    await startRun(page);
    await dockKey(page, "start").tap();
    const results = await new AxeBuilder({ page })
      .include(IMMERSIVE)
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"])
      .analyze();
    const blocking = results.violations
      .filter((v) => BLOCKING.has(v.impact ?? ""))
      .map((v) => `${v.id} (${v.impact}): ${v.nodes.length}`);
    expect(blocking).toEqual([]);
  });

  test.describe("Split View (ADR 0061)", () => {
    for (const width of [507, 678]) {
      test(`${width}x1024: the notice offers Try it anyway, with no overflow`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 1024 });
        await page.goto(ROUTE);
        await expect(page.locator(NOTICE).first()).toBeVisible();
        await assertNoHorizontalOverflow(page);
        const tryAnyway = page.getByRole("button", { name: /Try it anyway/i });
        await expect(tryAnyway).toBeVisible();
        await tryAnyway.tap();
        await expect(
          page.getByRole("button", { name: /Launch Cabinet/i })
        ).toBeVisible();
        await assertNoHorizontalOverflow(page);
      });
    }
  });
});
