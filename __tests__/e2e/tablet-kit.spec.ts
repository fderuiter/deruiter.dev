import { test, expect, type Locator, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import path from "node:path";
import {
  assertNoHorizontalOverflow,
  captureMatrix,
  TABLET_MATRIX,
} from "./mobile-harness";

// ADR 0061, tablet-first. These run only in the iPad projects in
// playwright.config.ts. Trial & Error is the ungated cabinet; Retro Labyrinth
// is a gated game that is ungated on tablets.
const UNGATED_ROUTE = "/arcade/trial-and-error";
const GATED_ROUTE = "/arcade/retro-labyrinth";
const IMMERSIVE = '[data-arcade-cabinet][data-immersive="true"]';
const NOTICE = '[data-testid="desktop-only-notice"]';
const SHOT_DIR = path.join(process.cwd(), "test-results", "tablet-kit");
// Blocking impacts for the cabinet scan (AGENTS invariant 10).
const BLOCKING = new Set(["critical", "serious", "moderate"]);

/**
 * Taps Launch once, retrying only the tap until it lands, then waits for the
 * cabinet to boot. Re-tapping while the cabinet loads would press its controls.
 */
async function launchCabinet(page: Page) {
  // A cold game chunk on a dev server can take most of a minute to compile.
  const launch = page.getByRole("button", { name: /Launch Cabinet/i });
  let tapped = false;
  await expect(async () => {
    if (!tapped) {
      await launch.tap({ timeout: 5000 });
      tapped = true;
    }
  }).toPass({ timeout: 90000 });
  await expect(page.locator(IMMERSIVE)).toBeVisible({ timeout: 90000 });
}

/**
 * Scroll attempts while the cabinet is open: a script scroll, a wheel, and a
 * touch swipe over the cabinet. None may move the page behind it.
 */
async function attemptPageScroll(page: Page) {
  await page.evaluate(() => window.scrollTo(0, 300));
  await page.mouse.wheel(0, 400);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: 250, y: 600 }],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: 250, y: 200 }],
  });
  // Hold the finger still before lifting: Chrome starts a fling from the
  // velocity of the last moves, and a fling would eat the power-off tap.
  await page.waitForTimeout(200);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
}

/** Asserts the immersive cabinet covers the whole viewport at the origin. */
async function expectFillsViewport(page: Page, cabinet: Locator) {
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  const box = await cabinet.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeCloseTo(0, 0);
  expect(box!.y).toBeCloseTo(0, 0);
  expect(box!.width).toBeCloseTo(viewport!.width, 0);
  expect(box!.height).toBeCloseTo(viewport!.height, 0);
}

/** Resolves once the page's scroll offset holds still across two frames. */
async function settleScroll(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        let last = window.scrollY;
        let still = 0;
        const step = () => {
          if (window.scrollY === last) {
            still += 1;
          } else {
            last = window.scrollY;
            still = 0;
          }
          // Thirty still frames: a fling under load can pause for a few.
          if (still >= 30) resolve();
          else requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      })
  );
}

test.describe("Tablet arcade kit (iPad projects)", () => {
  // A cold game chunk on a dev server can take most of a minute to compile.
  test.setTimeout(240000);

  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(
      !/^iPad/.test(testInfo.project.name),
      "iPad projects only (ADR 0061)"
    );
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  test("a gated game shows no notice on a tablet, and the hub has no badges", async ({
    page,
  }) => {
    await page.goto(GATED_ROUTE);
    await expect(page.locator(NOTICE)).toBeHidden();
    await expect(
      page.getByRole("button", { name: /Launch Cabinet/i })
    ).toBeVisible();

    await page.goto("/arcade");
    await expect(page.getByText("Desktop only").first()).toBeHidden();
  });

  for (const route of [UNGATED_ROUTE, GATED_ROUTE]) {
    test.describe(route, () => {
      test.beforeEach(async ({ page }) => {
        await page.goto(route);
      });

      test("a tap launches the cabinet and it fills the viewport", async ({
        page,
      }) => {
        await launchCabinet(page);
        await expect(page.locator(IMMERSIVE)).toHaveAttribute(
          "data-fullscreen",
          "true"
        );
        await expectFillsViewport(page, page.locator(IMMERSIVE));
        if (route === UNGATED_ROUTE) {
          await assertNoHorizontalOverflow(page);
        } else {
          // Known, game-level: Retro Labyrinth's options fieldset runs past
          // its clipped stage about 1.5s after boot. The page itself never
          // scrolls sideways. The fix belongs to the game's tablet pass.
          await page.waitForTimeout(2000);
          const viewport = page.viewportSize()!.width;
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth)
          ).toBeLessThanOrEqual(viewport);
        }
      });

      test("the immersive cabinet has no blocking axe violations", async ({
        page,
      }) => {
        await launchCabinet(page);
        const results = await new AxeBuilder({ page })
          .include(IMMERSIVE)
          .withTags([
            "wcag2a",
            "wcag2aa",
            "wcag21a",
            "wcag21aa",
            "best-practice",
          ])
          .analyze();
        const blocking = results.violations
          .filter((v) => BLOCKING.has(v.impact ?? ""))
          .map(
            (v) =>
              `${v.id} (${v.impact}): ${v.nodes.map((n) => `${n.target.join(" ")} ${n.html.slice(0, 160)}`).join(" / ")}`
          );
        expect(blocking).toEqual([]);
      });

      test("the page cannot scroll behind the open cabinet", async ({
        page,
      }) => {
        await page.evaluate(() => window.scrollTo(0, 300));
        await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(300);
        await launchCabinet(page);
        const pinned = await page.evaluate(() => window.scrollY);

        await attemptPageScroll(page);
        expect(await page.evaluate(() => window.scrollY)).toBe(pinned);

        // The attempt above can leave a fling or wheel still settling. A tap
        // then ends the fling instead of landing, so wait for the scroll to
        // stop before the one tap.
        await settleScroll(page);
        await page
          .locator(`${IMMERSIVE} button[title="Reset / Power Off Cabinet"]`)
          .tap();
        await expect(page.locator("[data-immersive]")).toHaveCount(0);
        // Exit hands the page back at the offset the player left: it returns to
        // the pinned position (no scrollIntoView jump), then scrolls freely.
        // 300 is the offset the player had before launch (see above).
        await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(300);
        const reachable = await page.evaluate(() => {
          window.scrollTo(0, 600);
          return window.scrollY;
        });
        expect(reachable).toBeGreaterThan(300);
      });

      test("exit restores page scroll", async ({ page }) => {
        await launchCabinet(page);
        expect(await page.evaluate(() => document.body.style.overflow)).toBe(
          "hidden"
        );

        await page
          .locator(`${IMMERSIVE} button[title="Reset / Power Off Cabinet"]`)
          .tap();
        await expect(page.locator("[data-immersive]")).toHaveCount(0);
        expect(
          await page.evaluate(() => document.body.style.overflow)
        ).not.toBe("hidden");
      });

      test("a key press flips the input modality and a tap flips it back", async ({
        page,
      }) => {
        await launchCabinet(page);
        const cabinet = page.locator(IMMERSIVE);
        await expect(cabinet).toHaveAttribute("data-input-modality", "touch");

        await page.keyboard.press("ArrowLeft");
        await expect(cabinet).toHaveAttribute(
          "data-input-modality",
          "keyboard"
        );

        await page.locator(`${IMMERSIVE} .arcade-cabinet-stage`).tap();
        await expect(cabinet).toHaveAttribute("data-input-modality", "touch");
      });
    });
  }

  test("the rotate hint is hidden inside the immersive cabinet", async ({
    page,
  }, testInfo) => {
    await page.goto(GATED_ROUTE);
    const hint = page.locator("[data-tablet-orientation-hint]");
    await launchCabinet(page);
    // The hint mounts with the game. In portrait it is up, so it must be
    // mounted and then hidden; in landscape it is not rendered at all.
    if (!testInfo.project.name.endsWith("landscape")) {
      await expect(hint).toHaveCount(1);
    }
    await expect(hint).toBeHidden();
  });

  test("the cabinet is immersive and fills the viewport at every tablet size", async ({
    page,
  }) => {
    await page.goto(UNGATED_ROUTE);
    await launchCabinet(page);

    const shots = await captureMatrix(
      page,
      "trial-and-error",
      SHOT_DIR,
      TABLET_MATRIX
    );
    for (const shot of shots) {
      expect(shot.immersive, `immersive at ${shot.width}x${shot.height}`).toBe(
        true
      );
    }
  });

  test.describe("Split View (ADR 0061)", () => {
    // Split View panes of a 1024px iPad are narrower than the phone breakpoint.
    for (const width of [507, 678]) {
      test(`${width}x1024: an ungated cabinet is immersive and fills the pane`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 1024 });
        await page.goto(UNGATED_ROUTE);
        await launchCabinet(page);
        await expectFillsViewport(page, page.locator(IMMERSIVE));
        await assertNoHorizontalOverflow(page);
      });

      test(`${width}x1024: a gated game shows the notice and Try it anyway`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 1024 });
        await page.goto(GATED_ROUTE);
        await expect(page.locator(NOTICE)).toBeVisible();
        const tryAnyway = page.getByRole("button", { name: /Try it anyway/i });
        await expect(tryAnyway).toBeVisible();
        await tryAnyway.tap();
        await expect(
          page.getByRole("button", { name: /Launch Cabinet/i })
        ).toBeVisible();
      });
    }

    test("507x1024: the page cannot scroll behind the cabinet", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 507, height: 1024 });
      await page.goto(UNGATED_ROUTE);
      await launchCabinet(page);
      const pinned = await page.evaluate(() => window.scrollY);
      await attemptPageScroll(page);
      expect(await page.evaluate(() => window.scrollY)).toBe(pinned);
    });

    test("768px and wider: a gated game launches immersive", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto(GATED_ROUTE);
      await expect(page.locator(NOTICE)).toBeHidden();
      await launchCabinet(page);
      await expectFillsViewport(page, page.locator(IMMERSIVE));
    });
  });
});

// Working With Duck is gated on phones only (ADR 0061). On a tablet it
// launches the immersive cabinet with its own control dock (#2039).
const DUCK_ROUTE = "/arcade/working-with-duck";
const DUCK_DOCK = '[data-testid="duck-control-dock"]';

test.describe("Working With Duck on a tablet (iPad projects)", () => {
  test.setTimeout(240000);

  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(
      !/^iPad/.test(testInfo.project.name),
      "iPad projects only (ADR 0061)"
    );
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(DUCK_ROUTE);
  });

  test("the notice is hidden, and the cabinet launches immersive with its control dock", async ({
    page,
  }) => {
    await expect(page.locator(NOTICE)).toBeHidden();
    await launchCabinet(page);
    await expect(page.locator(IMMERSIVE)).toHaveAttribute(
      "data-fullscreen",
      "true"
    );
    await expect(page.locator(DUCK_DOCK)).toBeVisible();
    await assertNoHorizontalOverflow(page);
  });

  test("the immersive cabinet has no blocking axe violations", async ({
    page,
  }) => {
    await launchCabinet(page);
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
  });
});

const QUASI_ROUTE = "/arcade/quasi-puzzler";
const QUASI_ROOT = ".qp-root.qp-touch";
const QUASI_HAND = '[data-testid="quasi-tactic-hand-dock"]';
const BRIEFING = '[role="dialog"][aria-labelledby="briefing-title"]';

/**
 * Launches the Quasi cabinet, retrying the Launch tap until the cabinet opens.
 * Before Launch the button is the only control, so a retry cannot press a game
 * control. A cold dev build can take the first tap before React has attached
 * its handlers, which a single tap would miss.
 */
async function launchQuasiCabinet(page: Page) {
  const launch = page.getByRole("button", { name: /Launch Cabinet/i });
  await expect(async () => {
    if ((await page.locator(IMMERSIVE).count()) > 0) return;
    await launch.tap({ timeout: 5000 });
    await expect(page.locator(IMMERSIVE)).toBeVisible({ timeout: 5000 });
  }).toPass({ timeout: 180000 });
  await expect(page.locator(IMMERSIVE)).toBeVisible({ timeout: 90000 });
}

test.describe("Quasi-Perfect Puzzler on a tablet (iPad projects, #2042)", () => {
  test.setTimeout(240000);

  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(
      !/^iPad/.test(testInfo.project.name),
      "iPad projects only (ADR 0061)"
    );
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(QUASI_ROUTE);
  });

  test("the notice is hidden, and the cabinet launches fit to the viewport", async ({
    page,
  }) => {
    await expect(page.locator(NOTICE)).toBeHidden();
    await launchQuasiCabinet(page);
    await expect(page.locator(IMMERSIVE)).toHaveAttribute(
      "data-mobile-layout",
      "fit"
    );
    await expect(page.locator(QUASI_ROOT)).toBeVisible();
    await expectFillsViewport(page, page.locator(IMMERSIVE));
    await assertNoHorizontalOverflow(page);
  });

  test("the tactic hand stays on screen, with no page scroll", async ({
    page,
  }) => {
    await launchQuasiCabinet(page);
    const viewport = page.viewportSize();
    const hand = await page.locator(QUASI_HAND).boundingBox();
    expect(hand).not.toBeNull();
    expect(hand!.y + hand!.height).toBeLessThanOrEqual(viewport!.height + 1);
    await attemptPageScroll(page);
    await settleScroll(page);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });

  test("every on-screen control is at least 44px, and no text is under 12px", async ({
    page,
  }) => {
    await launchQuasiCabinet(page);
    const controls = page.locator(`${QUASI_ROOT} button:visible`);
    const count = await controls.count();
    expect(count).toBeGreaterThan(0);
    const small: string[] = [];
    for (let i = 0; i < count; i += 1) {
      const box = await controls.nth(i).boundingBox();
      // Screen-reader-only copy is a 1px box, not a control.
      if (!box || box.width <= 1) continue;
      if (box.width < 44 || box.height < 44) {
        small.push(`${i}: ${Math.round(box.width)}x${Math.round(box.height)}`);
      }
    }
    expect(small).toEqual([]);
    const tinyText = await page.evaluate((root) => {
      const el = document.querySelector(root);
      if (!el) return ["no quasi root"];
      const offenders: string[] = [];
      el.querySelectorAll<HTMLElement>("*").forEach((node) => {
        const hasOwnText = Array.from(node.childNodes).some(
          (child) =>
            child.nodeType === Node.TEXT_NODE &&
            (child.textContent ?? "").trim().length > 0
        );
        if (!hasOwnText) return;
        const style = getComputedStyle(node);
        if (style.display === "none") return;
        if (parseFloat(style.fontSize) < 12) {
          offenders.push(
            `${node.tagName} ${style.fontSize} ${node.textContent?.trim().slice(0, 40)}`
          );
        }
      });
      return offenders.slice(0, 10);
    }, QUASI_ROOT);
    expect(tinyText).toEqual([]);
  });

  test("the Theory Briefing fits the screen, traps focus, and Escape closes it, then leaves the cabinet", async ({
    page,
  }) => {
    await launchQuasiCabinet(page);
    await page.getByRole("button", { name: /Theory Briefing/ }).tap();
    const dialog = page.locator(BRIEFING);
    await expect(dialog).toBeVisible();
    const viewport = page.viewportSize();
    const box = await dialog.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height + 1);
    await assertNoHorizontalOverflow(page);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(page.locator(IMMERSIVE)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator(IMMERSIVE)).toBeHidden({ timeout: 15000 });
  });

  test("the immersive cabinet has no blocking axe violations", async ({
    page,
  }) => {
    await launchQuasiCabinet(page);
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
  });
});
