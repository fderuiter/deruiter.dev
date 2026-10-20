import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { assertNoHorizontalOverflow } from "./mobile-harness";
import { waitForAnimationFrames } from "./helpers/settle";

// ADR 0061, tablet-first: For Better or Bulk on every iPad project (#2123).
// These run only in the iPad projects in playwright.config.ts.
const ROUTE = "/arcade/for-better-or-bulk";
const IMMERSIVE = '[data-arcade-cabinet][data-immersive="true"]';
const NOTICE = '[data-testid="desktop-only-notice"]';
const ROOT = '[data-testid="fbb-game"]';
const DOCK = '[data-testid="fbb-touch-dock"]';
const CANVAS = '[data-testid="fbb-canvas"]';
const STRIP = '[data-testid="fbb-strip"]';
const PANEL = '[data-testid="fbb-panel"]';
// Blocking impacts for the cabinet scan (AGENTS invariant 10).
const BLOCKING = new Set(["critical", "serious", "moderate"]);

/** Taps Launch until the cabinet opens, then waits for the plan screen. */
async function launch(page: Page) {
  const button = page.getByRole("button", { name: /Launch Cabinet/i });
  await expect(async () => {
    if ((await page.locator(IMMERSIVE).count()) > 0) return;
    await button.tap({ timeout: 5000 });
    await expect(page.locator(IMMERSIVE)).toBeVisible({ timeout: 5000 });
  }).toPass({ timeout: 180000 });
  await expect(page.getByRole("button", { name: "Start setup" })).toBeVisible({
    timeout: 90000,
  });
}

/** Picks one player or two on the plan, then starts the day. */
async function startDay(page: Page, mode: "solo" | "coop" = "solo") {
  if (mode === "coop") {
    await page.getByRole("radio", { name: /Two players, one iPad/ }).tap();
  }
  await expect(async () => {
    if ((await page.locator(DOCK).count()) > 0) return;
    await page
      .getByRole("button", { name: "Start setup" })
      .tap({ timeout: 3000 });
    await expect(page.locator(DOCK)).toBeAttached({ timeout: 3000 });
  }).toPass({ timeout: 30000 });
  await expect(page.locator(ROOT)).toHaveAttribute("data-fbb-phase", "playing");
}

async function expectInsideViewport(page: Page, selectors: string[]) {
  const viewport = page.viewportSize()!;
  for (const selector of selectors) {
    const box = await page.locator(selector).first().boundingBox();
    expect(box, `${selector} has a box`).not.toBeNull();
    expect(box!.x, `${selector} left`).toBeGreaterThanOrEqual(-1);
    expect(box!.y, `${selector} top`).toBeGreaterThanOrEqual(-1);
    expect(box!.x + box!.width, `${selector} right`).toBeLessThanOrEqual(
      viewport.width + 1
    );
    expect(box!.y + box!.height, `${selector} bottom`).toBeLessThanOrEqual(
      viewport.height + 1
    );
  }
}

/** Controls under 44px and text under 12px inside the game, art aside. */
async function expectTouchSizes(page: Page) {
  const controls = page.locator(`${ROOT} button:visible`);
  await expect(controls.first()).toBeVisible({ timeout: 60000 });
  const count = await controls.count();
  const small: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const box = await controls.nth(i).boundingBox();
    if (!box || box.width <= 1) continue;
    if (box.width < 43.5 || box.height < 43.5) {
      small.push(
        `${i}: ${Math.round(box.width)}x${Math.round(box.height)} ${(await controls.nth(i).innerText()).slice(0, 30)}`
      );
    }
  }
  expect(small).toEqual([]);
  const tiny = await page.evaluate((selector) => {
    const root = document.querySelector(selector);
    if (!root) return ["no game root"];
    const offenders: string[] = [];
    root.querySelectorAll<HTMLElement>("*").forEach((node) => {
      if (node instanceof SVGElement) return;
      const own = Array.from(node.childNodes).some(
        (child) =>
          child.nodeType === Node.TEXT_NODE &&
          (child.textContent ?? "").trim().length > 0
      );
      if (!own) return;
      const style = getComputedStyle(node);
      if (style.display === "none" || node.closest(".sr-only")) return;
      if (parseFloat(style.fontSize) < 12) {
        offenders.push(
          `${node.tagName} ${style.fontSize} ${node.textContent?.trim().slice(0, 40)}`
        );
      }
    });
    return offenders.slice(0, 10);
  }, ROOT);
  expect(tiny).toEqual([]);
}

async function expectNoBlockingAxe(page: Page) {
  const results = await new AxeBuilder({ page })
    .include(IMMERSIVE)
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"])
    .analyze();
  const blocking = results.violations
    .filter((v) => BLOCKING.has(v.impact ?? ""))
    .map(
      (v) =>
        `${v.id} (${v.impact}): ${v.nodes.map((n) => `${n.target.join(" ")} ${n.html.slice(0, 160)}`).join(" / ")}`
    );
  expect(blocking).toEqual([]);
}

/** The day fits the screen: nothing scrolls, the venue is large, the dock is at the bottom. */
async function expectDayFits(page: Page) {
  const size = page.viewportSize()!;
  await expectInsideViewport(page, [ROOT, STRIP, CANVAS, PANEL, DOCK]);
  const overflow = await page.evaluate(() => {
    const root = document.querySelector<HTMLElement>(".fbb-touch")!;
    return [
      document.scrollingElement!.scrollHeight - window.innerHeight,
      root.scrollHeight - root.clientHeight,
    ].map((n) => Math.max(0, n));
  });
  expect(overflow.every((n) => n <= 1)).toBe(true);
  const canvas = (await page.locator(CANVAS).boundingBox())!;
  // The venue keeps its 5:3 shape and takes most of the width it is given.
  expect(Math.abs(canvas.width / canvas.height - 5 / 3)).toBeLessThan(0.02);
  const share = size.width > size.height ? 0.55 : 0.9;
  expect(canvas.width / size.width).toBeGreaterThanOrEqual(share);
  const dock = (await page.locator(DOCK).boundingBox())!;
  expect(size.height - (dock.y + dock.height)).toBeLessThanOrEqual(24);
  expect(dock.y).toBeGreaterThanOrEqual(canvas.y + canvas.height - 1);
  // The strip stays clear of the floating toolbar.
  const toolbar = (await page
    .getByTestId("cabinet-touch-toolbar")
    .boundingBox())!;
  const strip = (await page.locator(STRIP).boundingBox())!;
  expect(
    strip.x + strip.width <= toolbar.x + 1 ||
      strip.y >= toolbar.y + toolbar.height - 1
  ).toBe(true);
  await assertNoHorizontalOverflow(page);
}

/**
 * Holds one finger on a point through CDP while `whileHeld` runs, then lifts
 * it, even if `whileHeld` throws.
 */
async function holdTouch(
  page: Page,
  x: number,
  y: number,
  whileHeld: () => Promise<void>
) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y, id: 1 }],
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

test.describe("For Better or Bulk on a tablet (iPad projects, #2123)", () => {
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
    // The plan names the on-screen keys, not the keyboard's.
    await expect(
      page.getByText("Play both. Swap changes between Fred and Abbi.")
    ).toBeVisible();
    await assertNoHorizontalOverflow(page);
  });

  test("a solo day fits both orientations without scrolling", async ({
    page,
  }) => {
    await launch(page);
    await startDay(page);
    const { width, height } = page.viewportSize()!;
    for (const size of [
      { width, height },
      { width: height, height: width },
    ]) {
      await page.setViewportSize(size);
      await expectDayFits(page);
    }
  });

  test("a co-op day fits both orientations, with a side for each person", async ({
    page,
  }) => {
    await launch(page);
    await startDay(page, "coop");
    await expect(page.locator(DOCK)).toHaveAttribute("data-mode", "coop");
    const { width, height } = page.viewportSize()!;
    for (const size of [
      { width, height },
      { width: height, height: width },
    ]) {
      await page.setViewportSize(size);
      await expectDayFits(page);
      const fred = (await page.getByTestId("fbb-stick-fred").boundingBox())!;
      const abbi = (await page.getByTestId("fbb-stick-abbi").boundingBox())!;
      expect(fred.x + fred.width / 2).toBeLessThan(size.width / 2);
      expect(abbi.x + abbi.width / 2).toBeGreaterThan(size.width / 2);
    }
  });

  test("the page cannot scroll behind the open cabinet", async ({ page }) => {
    await launch(page);
    await startDay(page);
    await page.evaluate(() => window.scrollTo(0, 300));
    await page.mouse.wheel(0, 400);
    await holdTouch(page, 20, 300, () => waitForAnimationFrames(page, 6));
    // Give a scroll the frames it would need to land, then check it didn't.
    await waitForAnimationFrames(page, 18);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });

  test("every control is 44px and no text is under 12px: plan, day, pause, co-op", async ({
    page,
  }) => {
    await launch(page);
    await expectTouchSizes(page);
    await startDay(page);
    await expectTouchSizes(page);
    await page.locator(ROOT).getByRole("button", { name: "Pause" }).tap();
    await expect(page.getByText(/^Paused at/)).toBeVisible();
    await expectTouchSizes(page);
    await page.getByRole("button", { name: "Back to the plan" }).tap();
    await startDay(page, "coop");
    await expectTouchSizes(page);
  });

  test("a finger on the drag pad walks Abbi to the lanterns, and Use takes one", async ({
    page,
  }) => {
    await page.goto(`${ROUTE}?speed=4`);
    await launch(page);
    await startDay(page);
    const prompt = page.getByTestId("fbb-prompt-abbi");
    await expect(prompt).toContainText("Abbi has free hands.");
    const pad = (await page.getByTestId("fbb-stick-abbi").boundingBox())!;
    // A finger near the pad's left rim walks left, toward the LAMP crate.
    // Keep the finger down until Abbi reaches the crate.
    await expect(async () => {
      await holdTouch(
        page,
        pad.x + pad.width * 0.1,
        pad.y + pad.height / 2,
        () =>
          expect(prompt).toContainText(
            "Use: Take the lantern from the LAMP crate",
            { timeout: 5000 }
          )
      );
    }).toPass({ timeout: 30000 });
    await page.getByTestId("fbb-use-abbi").tap();
    await expect(prompt).toContainText("Abbi is carrying a paper lantern.");
    await expectNoBlockingAxe(page);
  });

  test("Swap plays the other person, and the keyboard case pauses with Escape and hides the dock", async ({
    page,
  }) => {
    await launch(page);
    await startDay(page);
    await expect(page.getByTestId("fbb-active")).toContainText("Abbi");
    await page.getByTestId("fbb-swap").tap();
    await expect(page.getByTestId("fbb-active")).toContainText(
      "Playing as Fred"
    );
    await expect(page.locator("[data-touch-controls]")).toHaveAttribute(
      "data-touch-controls",
      "shown"
    );
    // A key press is a keyboard case: the dock hides, and Escape pauses the
    // day rather than closing the cabinet.
    await page.locator(ROOT).focus();
    await page.keyboard.press("Escape");
    await expect(page.getByText(/^Paused at/)).toBeVisible();
    await expect(page.locator(IMMERSIVE)).toBeVisible();
    await expect(page.locator("[data-touch-controls]")).toHaveAttribute(
      "data-touch-controls",
      "hidden"
    );
    await page.keyboard.press("Escape");
    await expect(page.getByText(/^Paused at/)).toBeHidden();
    await expect(page.locator(IMMERSIVE)).toBeVisible();
    // The next touch brings the dock back.
    await page.getByTestId("fbb-swap").tap();
    await expect(page.locator("[data-touch-controls]")).toHaveAttribute(
      "data-touch-controls",
      "shown"
    );
  });

  test("backgrounding the app pauses the day", async ({ page }) => {
    await launch(page);
    await startDay(page);
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => "hidden",
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect(page.getByText(/^Paused at/)).toBeVisible();
  });

  test.describe("Split View (ADR 0061)", () => {
    for (const width of [507, 678]) {
      test(`${width}x1024: the notice offers Try it anyway, and a co-op day fits`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 1024 });
        await page.goto(ROUTE);
        await expect(page.locator(NOTICE).first()).toBeVisible();
        await assertNoHorizontalOverflow(page);
        await page.getByRole("button", { name: /Try it anyway/i }).tap();
        await launch(page);
        await startDay(page, "coop");
        await expectDayFits(page);
        await expectTouchSizes(page);
      });
    }
  });
});
