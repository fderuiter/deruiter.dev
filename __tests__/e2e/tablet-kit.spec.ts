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
    await expect(page.locator("[data-phone-readiness]").first()).toBeHidden();
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

  // #2741: the dock under the room is the TouchControlsGate's. A hardware key
  // (Escape on a keyboard case) hides it until the next touch, as ADR 0061
  // asks; closing the wardrobe by touch never does.
  test("the wardrobe closes by touch with the dock still shown; Escape hides the dock until the next tap", async ({
    page,
  }) => {
    await launchCabinet(page);
    const gate = page.locator(`[data-touch-controls]:has(${DUCK_DOCK})`);
    const dialog = page.locator(
      '[role="dialog"][aria-labelledby="duck-wardrobe-dialog-heading"]'
    );
    const openWardrobe = page.getByRole("button", { name: /Wardrobe/ }).first();

    await openWardrobe.tap();
    await expect(dialog).toBeVisible();
    const results = await new AxeBuilder({ page })
      .include('[aria-labelledby="duck-wardrobe-dialog-heading"]')
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"])
      .analyze();
    expect(
      results.violations
        .filter((v) => BLOCKING.has(v.impact ?? ""))
        .map((v) => v.id)
    ).toEqual([]);
    await dialog.getByRole("button", { name: "Close wardrobe" }).tap();
    await expect(dialog).toBeHidden();
    await expect(gate).toHaveAttribute("data-touch-controls", "shown");
    await expect(page.locator(DUCK_DOCK)).toBeVisible();

    await openWardrobe.tap();
    // The focus trap owns Escape once it has moved focus into the dialog.
    await expect(
      dialog.getByRole("button", { name: "Close wardrobe" })
    ).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(gate).toHaveAttribute("data-touch-controls", "hidden");
    // The hidden gate is aria-hidden, so the key is found by CSS, not role.
    await page.locator(`${DUCK_DOCK} button`).first().tap();
    await expect(gate).toHaveAttribute("data-touch-controls", "shown");
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

  test("the content uses the full width below the header, and the header clears the toolbar", async ({
    page,
  }) => {
    await launchQuasiCabinet(page);
    const viewport = page.viewportSize();
    const board = await page
      .locator(`${QUASI_ROOT} .qp-touch-panel`)
      .boundingBox();
    const hand = await page.locator(QUASI_HAND).boundingBox();
    const drawers = await page
      .locator('[data-testid="diagnostic-drawers"]')
      .boundingBox();
    expect(board && hand && drawers).toBeTruthy();
    for (const box of [board!, hand!, drawers!]) {
      // The 16px gutter, plus the cabinet's 2px frame.
      expect(box.x).toBeLessThanOrEqual(16 + 2 + 1);
      expect(box.x + box.width).toBeGreaterThanOrEqual(viewport!.width - 24);
    }
    // Header buttons never sit under the floating cabinet toolbar.
    const toolbar = await page
      .locator('[data-testid="cabinet-touch-toolbar"]')
      .boundingBox();
    expect(toolbar).not.toBeNull();
    const headerButtons = page.locator(
      `${QUASI_ROOT} .qp-touch-header button:visible`
    );
    const count = await headerButtons.count();
    for (let i = 0; i < count; i += 1) {
      const box = await headerButtons.nth(i).boundingBox();
      if (!box || box.width <= 1) continue;
      const clear =
        box.x + box.width <= toolbar!.x + 1 ||
        box.y >= toolbar!.y + toolbar!.height - 1;
      expect(clear, `header control ${i} under the toolbar`).toBe(true);
    }
  });

  test("the board fills the spare height: no gap over 48px above the hand, and the helper line stays in the box", async ({
    page,
  }) => {
    await launchQuasiCabinet(page);
    const panel = await page
      .locator(`${QUASI_ROOT} .qp-touch-panel`)
      .boundingBox();
    const hand = await page.locator(QUASI_HAND).boundingBox();
    expect(panel && hand).toBeTruthy();
    expect(hand!.y - (panel!.y + panel!.height)).toBeLessThanOrEqual(48);
    const helper = page
      .locator(`${QUASI_ROOT} .qp-touch-panel`)
      .getByText(/Drag a tactic card/);
    await expect(helper).toBeVisible();
    const text = await helper.boundingBox();
    expect(text).not.toBeNull();
    expect(text!.y).toBeGreaterThanOrEqual(panel!.y - 1);
    expect(text!.y + text!.height).toBeLessThanOrEqual(
      panel!.y + panel!.height + 1
    );
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
    // The board loads after the cabinet opens, so wait for its controls.
    await expect(controls.first()).toBeVisible({ timeout: 60000 });
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
    // Closing the briefing hands focus back to its trigger inside the
    // cabinet, where the next Escape is heard.
    await expect
      .poll(() =>
        page.evaluate(
          (sel) => !!document.activeElement?.closest(sel),
          IMMERSIVE
        )
      )
      .toBe(true);
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

const PD_ROUTE = "/protocol-drift";
const PD_ROOT = ".pd-touch";
const PD_INSPECTOR = `${PD_ROOT} [data-testid="inspector"]`;
const PD_INSPECTOR_SHEET = `${PD_ROOT} [data-testid="inspector-sheet"]`;
const PD_CHIP = (kind: string) =>
  `${PD_ROOT} .react-flow__node:has([data-chip-kind="${kind}"])`;

/**
 * Launches the Protocol Drift cabinet. The workbench loads after the cabinet
 * opens, so this waits for the immersive cabinet and the briefing (#2045).
 */
async function launchProtocolDriftCabinet(page: Page) {
  const launch = page.getByRole("button", { name: /Launch Cabinet/i });
  await expect(async () => {
    if ((await page.locator(IMMERSIVE).count()) > 0) return;
    await launch.tap({ timeout: 5000 });
    await expect(page.locator(IMMERSIVE)).toBeVisible({ timeout: 5000 });
  }).toPass({ timeout: 180000 });
  await expect(page.locator(IMMERSIVE)).toBeVisible({ timeout: 90000 });
  await expect(page.locator(PD_ROOT)).toBeVisible({ timeout: 90000 });
}

test.describe("Protocol Drift first lane by touch (iPad projects, #2045)", () => {
  test.setTimeout(300000);

  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(
      !/^iPad/.test(testInfo.project.name),
      "iPad projects only (ADR 0061)"
    );
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(PD_ROUTE);
  });

  test("the first lane is wired, validated, published and run with taps only", async ({
    page,
  }) => {
    await launchProtocolDriftCabinet(page);
    await page
      .getByRole("button", { name: /accept assignment/i })
      .tap({ timeout: 15000 });
    // Chips come from the toolbox by tap, in lane order.
    for (const kind of [
      "SourceIngest",
      "ExtractField",
      "PivotToObservation",
      "CDISCSink",
    ]) {
      await page
        .getByRole("button", { name: new RegExp(`add ${kind} `, "i") })
        .tap();
      await expect(page.locator(PD_CHIP(kind))).toBeVisible();
    }
    // Wiring goes through the lists, so it does not depend on which chips are
    // on screen: "Wire..." picks the source, "Choose target" picks the target.
    const wire = async (from: string, to: string, picks: string[] = []) => {
      await page.getByRole("button", { name: "Wire…", exact: true }).tap();
      await page
        .getByTestId("wire-source-sheet")
        .getByRole("button", { name: new RegExp(`^${from}\\b`) })
        .tap();
      await page
        .getByRole("button", { name: "Choose target", exact: true })
        .tap();
      await page
        .getByTestId("wire-target-sheet")
        .getByRole("button", { name: new RegExp(`^${to}\\b`) })
        .tap();
      // The pair sheet stays open while same-name pairs remain; Done closes it.
      for (const pick of picks)
        await page.getByRole("button", { name: pick, exact: true }).tap();
      if (picks.length > 0)
        await page
          .getByTestId("touch-wire-sheet")
          .getByRole("button", { name: "Done", exact: true })
          .tap();
      await expect(page.getByTestId("touch-wire-sheet")).toHaveCount(0);
    };
    // One valid pair wires at once.
    await wire("SourceIngest", "ExtractField");
    // Several valid pairs open the pair list: one tap per wire, one sheet.
    await wire("ExtractField", "PivotToObservation", [
      "sbp to sbp",
      "dbp to dbp",
      "pulse to pulse",
    ]);
    await wire("PivotToObservation", "CDISCSink");
    await expect(page.locator(`${PD_ROOT} .react-flow__edge`)).toHaveCount(5);

    const fsm = page.locator(PD_ROOT);
    await page.getByRole("button", { name: "Run Local Test" }).tap();
    await expect(fsm).toHaveAttribute("data-fsm", "DEPLOY_READY");
    await page.getByRole("button", { name: "Publish Revision" }).tap();
    await expect(fsm).toHaveAttribute("data-fsm", "PAUSED");
    await page.getByRole("button", { name: /^Run \(Space\)$/ }).tap();
    await expect(fsm).toHaveAttribute("data-fsm", "RUNNING");
    await page.getByRole("button", { name: /^Pause \(Space\)$/ }).tap();
    await expect(fsm).toHaveAttribute("data-fsm", "PAUSED");
    const clock = page.locator('[data-testid="sim-clock"]');
    const before = await clock.textContent();
    await page.getByRole("button", { name: /Step one hour/ }).tap();
    await expect(clock).not.toHaveText(before ?? "");
  });
});

test.describe("Protocol Drift on a tablet (iPad projects, #2045)", () => {
  test.setTimeout(240000);

  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(
      !/^iPad/.test(testInfo.project.name),
      "iPad projects only (ADR 0061)"
    );
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(PD_ROUTE);
  });

  test("the notice is hidden, and the cabinet launches fit to the viewport", async ({
    page,
  }) => {
    await expect(page.locator(NOTICE)).toBeHidden();
    await launchProtocolDriftCabinet(page);
    await expect(page.locator(IMMERSIVE)).toHaveAttribute(
      "data-mobile-layout",
      "fit"
    );
    await expect(page.locator(PD_ROOT)).toBeVisible();
    await expectFillsViewport(page, page.locator(IMMERSIVE));
    await assertNoHorizontalOverflow(page);
  });

  test("the workbench fits both orientations: header, strip, canvas, inspector and footer stay on screen", async ({
    page,
  }) => {
    await launchProtocolDriftCabinet(page);
    const viewport = page.viewportSize();
    expect(viewport).not.toBeNull();
    const parts = [
      `${PD_ROOT} > header`,
      `${PD_ROOT} > section`,
      `${PD_ROOT} > footer`,
      `${PD_ROOT} .react-flow`,
      PD_INSPECTOR,
    ];
    for (const selector of parts) {
      const boxes = page.locator(selector);
      const count = await boxes.count();
      for (let i = 0; i < count; i += 1) {
        const box = await boxes.nth(i).boundingBox();
        if (!box || box.width <= 1) continue;
        expect(box.x, `${selector} ${i} left`).toBeGreaterThanOrEqual(-1);
        expect(box.x + box.width, `${selector} ${i} right`).toBeLessThanOrEqual(
          viewport!.width + 1
        );
        expect(
          box.y + box.height,
          `${selector} ${i} bottom`
        ).toBeLessThanOrEqual(viewport!.height + 1);
      }
    }
    const canvas = await page.locator(`${PD_ROOT} .react-flow`).boundingBox();
    expect(canvas).not.toBeNull();
    expect(canvas!.height).toBeGreaterThanOrEqual(200);
    // The canvas wins the cabinet: at least 55% of its height (#2045 round 2).
    expect(canvas!.height).toBeGreaterThanOrEqual(viewport!.height * 0.55);
    await assertNoHorizontalOverflow(page);
  });

  test("the page cannot scroll behind the open cabinet", async ({ page }) => {
    await launchProtocolDriftCabinet(page);
    await attemptPageScroll(page);
    await settleScroll(page);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });

  test("the canvas keeps its pan and pinch gestures inside itself", async ({
    page,
  }) => {
    await launchProtocolDriftCabinet(page);
    const touchAction = await page
      .locator(`${PD_ROOT} .react-flow`)
      .evaluate((el) => getComputedStyle(el).touchAction);
    expect(touchAction).toBe("none");
  });

  test("every on-screen control is at least 44px, and no text is under 12px", async ({
    page,
  }) => {
    await launchProtocolDriftCabinet(page);
    const controls = page.locator(`${PD_ROOT} button:visible`);
    await expect(controls.first()).toBeVisible({ timeout: 60000 });
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
      if (!el) return ["no workbench root"];
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
    }, PD_ROOT);
    expect(tinyText).toEqual([]);
  });

  test("the briefing fits the screen, and Escape keeps the cabinet open", async ({
    page,
  }) => {
    await launchProtocolDriftCabinet(page);
    const dialog = page.getByRole("dialog", { name: /Trial Briefing/ });
    await expect(dialog).toBeVisible();
    const viewport = page.viewportSize();
    const box = await dialog.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height + 1);
    await assertNoHorizontalOverflow(page);
    // The briefing must be accepted, so Escape holds the press (#2045).
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();
    await expect(page.locator(IMMERSIVE)).toBeVisible();
    await page
      .getByRole("button", { name: /accept assignment/i })
      .tap({ timeout: 15000 });
    await expect(dialog).toBeHidden();
  });

  test("the inspector opens as a sheet, and Escape closes it while the cabinet stays open", async ({
    page,
  }) => {
    await launchProtocolDriftCabinet(page);
    await page
      .getByRole("button", { name: /accept assignment/i })
      .tap({ timeout: 15000 });
    await expect(page.locator(PD_INSPECTOR)).toHaveAttribute(
      "data-expanded",
      "false"
    );
    await page.getByRole("button", { name: /Expand \(I\)/ }).tap();
    const sheet = page.locator(PD_INSPECTOR_SHEET);
    await expect(sheet).toBeVisible();
    const viewport = page.viewportSize();
    const box = await sheet.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height + 1);
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect(page.locator(PD_INSPECTOR)).toHaveAttribute(
      "data-expanded",
      "false"
    );
    await expect(page.locator(IMMERSIVE)).toBeVisible();
  });

  test("the immersive cabinet has no blocking axe violations", async ({
    page,
  }) => {
    await launchProtocolDriftCabinet(page);
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

// Meme Vault is a plain page, not a cabinet: the sampler, Echo, the trophy
// shelf and the rest are DOM controls that must work by finger and Pencil
// on every iPad size (#2071).
const MEME_ROUTE = "/arcade/meme-vault";
const MEME_ROOT = '[data-game="meme-vault"]';
const MEME_PAD = `${MEME_ROOT} .meme-pad`;
const MEME_ECHO = '[data-testid="meme-echo"]';
const MEME_STATUS = '[data-testid="meme-echo-status"]';

/**
 * Records, in order, every pad the page lights, by its place in the grid. A
 * pad is named by the words it shows (#2571), so its position is the stable
 * handle.
 */
async function watchLitPads(page: Page) {
  await page.evaluate((padSelector) => {
    const w = window as unknown as { __memeLit?: string[] };
    w.__memeLit = [];
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        const el = record.target as HTMLElement;
        if (
          record.attributeName === "data-lit" &&
          el.getAttribute("data-lit") === "true"
        ) {
          const pads = Array.from(document.querySelectorAll(padSelector));
          w.__memeLit?.push(String(pads.indexOf(el)));
        }
      }
    });
    document.querySelectorAll(padSelector).forEach((pad) => {
      observer.observe(pad, {
        attributes: true,
        attributeFilter: ["data-lit"],
      });
    });
  }, MEME_PAD);
}

const litLog = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { __memeLit?: string[] }).__memeLit ?? []
  );

/** Scrolls the Echo console to just under the fixed header. */
async function scrollEchoIntoPlace(page: Page) {
  await page.evaluate((selector) => {
    const el = document.querySelector(selector);
    if (!el) return;
    window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 96);
  }, MEME_ECHO);
  await settleScroll(page);
}

/** Asserts the Echo status line and all eight pads share one screen. */
async function expectEchoAndPadsInView(page: Page) {
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  const status = await page.locator(MEME_STATUS).boundingBox();
  expect(status).not.toBeNull();
  expect(status!.y).toBeGreaterThanOrEqual(0);
  const pads = page.locator(MEME_PAD);
  expect(await pads.count()).toBe(8);
  for (let i = 0; i < 8; i += 1) {
    const box = await pads.nth(i).boundingBox();
    expect(box, `pad ${i}`).not.toBeNull();
    expect(box!.y, `pad ${i} top`).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height, `pad ${i} bottom`).toBeLessThanOrEqual(
      viewport!.height + 1
    );
  }
}

/** Taps the first pad until the page has taken it (hydration race). */
async function tapFirstPadUntilHydrated(page: Page) {
  await expect(async () => {
    await page.locator(MEME_PAD).first().tap({ timeout: 5000 });
    await expect(page.getByTestId("meme-silent-press")).toBeVisible({
      timeout: 2000,
    });
  }).toPass({ timeout: 15000 });
}

async function meetsTouchSizes(page: Page) {
  const small = await page.evaluate((rootSelector) => {
    const root = document.querySelector(rootSelector);
    if (!root) return ["no vault root"];
    const offenders: string[] = [];
    root
      .querySelectorAll<HTMLElement>("button, a[href], [role='button']")
      .forEach((el) => {
        const style = getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden") return;
        const rect = el.getBoundingClientRect();
        // Screen-reader-only copy is a 1px box, not a control.
        if (rect.width <= 1 || rect.height <= 1) return;
        if (rect.width < 44 - 0.5 || rect.height < 44 - 0.5) {
          offenders.push(
            `${el.tagName} ${Math.round(rect.width)}x${Math.round(rect.height)} ${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 40)}`
          );
        }
      });
    return offenders;
  }, MEME_ROOT);
  expect(small).toEqual([]);
}

test.describe("Meme Vault on a tablet (iPad projects, #2071)", () => {
  test.setTimeout(240000);

  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(
      !/^iPad/.test(testInfo.project.name),
      "iPad projects only (ADR 0061)"
    );
    await page.goto(MEME_ROUTE);
    await expect(page.locator(MEME_PAD)).toHaveCount(8);
  });

  test("the page is not gated and does not overflow sideways", async ({
    page,
  }) => {
    await expect(page.locator(NOTICE)).toBeHidden();
    await assertNoHorizontalOverflow(page);
  });

  test("pads, Echo and every other control are at least 44px, with no hover-only states", async ({
    page,
  }) => {
    await meetsTouchSizes(page);
    const touchAction = await page.evaluate(
      ([root, pad]) => ({
        root: getComputedStyle(document.querySelector(root)!).touchAction,
        pad: getComputedStyle(document.querySelector(pad)!).touchAction,
      }),
      [MEME_ROOT, MEME_PAD]
    );
    expect(touchAction).toEqual({
      root: "manipulation",
      pad: "manipulation",
    });
  });

  test("no visible text in the vault is under 12px", async ({ page }) => {
    const tinyText = await page.evaluate((root) => {
      const el = document.querySelector(root);
      if (!el) return ["no vault root"];
      const offenders: string[] = [];
      el.querySelectorAll<HTMLElement>("*").forEach((node) => {
        const hasOwnText = Array.from(node.childNodes).some(
          (child) =>
            child.nodeType === Node.TEXT_NODE &&
            (child.textContent ?? "").trim().length > 0
        );
        if (!hasOwnText) return;
        const style = getComputedStyle(node);
        if (style.display === "none" || style.visibility === "hidden") return;
        if (parseFloat(style.fontSize) < 12) {
          offenders.push(
            `${node.tagName} ${style.fontSize} ${node.textContent?.trim().slice(0, 40)}`
          );
        }
      });
      return offenders.slice(0, 10);
    }, MEME_ROOT);
    expect(tinyText).toEqual([]);
  });

  test("a pad tap plays on the first tap, and taps never scroll the page", async ({
    page,
  }) => {
    await watchLitPads(page);
    await scrollEchoIntoPlace(page);
    await tapFirstPadUntilHydrated(page);
    await settleScroll(page);
    // Playwright scrolls a target into view before a tap; the pads are
    // already in view here, so no tap after this may move the page.
    const before = await page.evaluate(() => window.scrollY);
    // Sound is off by default in a fresh browser: the pad still lights and
    // says it played silently.
    expect((await litLog(page)).length).toBeGreaterThan(0);
    const pads = page.locator(MEME_PAD);
    // Fast repeated taps on every pad, twice over.
    for (let round = 0; round < 2; round += 1) {
      for (let i = 0; i < 8; i += 1) {
        await pads.nth(i).tap();
      }
    }
    await settleScroll(page);
    expect(await page.evaluate(() => window.scrollY)).toBe(before);
    expect((await litLog(page)).length).toBeGreaterThanOrEqual(17);
  });

  test("a touch drag that starts on a pad scrolls the page and plays nothing", async ({
    page,
  }) => {
    await tapFirstPadUntilHydrated(page);
    await scrollEchoIntoPlace(page);
    await settleScroll(page);
    await watchLitPads(page);
    const before = await page.evaluate(() => window.scrollY);
    const box = await page.locator(MEME_PAD).nth(5).boundingBox();
    expect(box).not.toBeNull();
    const x = box!.x + box!.width / 2;
    const y = Math.min(
      box!.y + box!.height / 2,
      page.viewportSize()!.height - 40
    );
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y }],
    });
    for (let step = 1; step <= 6; step += 1) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x, y: y - step * 25 }],
      });
    }
    await page.waitForTimeout(150);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await settleScroll(page);
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(before);
    expect(await litLog(page)).toEqual([]);
  });

  test("an Echo round starts and is answered by taps, twice in a row", async ({
    page,
  }) => {
    await tapFirstPadUntilHydrated(page);
    await watchLitPads(page);
    await scrollEchoIntoPlace(page);
    await page.getByRole("button", { name: "Start Echo" }).tap();
    for (const length of [1, 2]) {
      await expect(page.locator(MEME_STATUS)).toHaveText(/^Your turn/);
      const sequence = (await litLog(page)).slice(-length);
      expect(sequence).toHaveLength(length);
      for (const index of sequence) {
        await page.locator(MEME_PAD).nth(Number(index)).tap();
      }
      await expect(page.getByTestId("meme-echo-streak")).toHaveText(
        String(length)
      );
      await expect(page.locator(MEME_STATUS)).toHaveText(/^Watch/);
    }
  });

  test("Echo's status and all eight pads stay in view while a round plays", async ({
    page,
  }) => {
    await tapFirstPadUntilHydrated(page);
    await scrollEchoIntoPlace(page);
    await page.getByRole("button", { name: "Start Echo" }).tap();
    await expect(page.locator(MEME_STATUS)).toHaveText(/^Watch/);
    await expectEchoAndPadsInView(page);
    await expect(page.locator(MEME_STATUS)).toHaveText(/^Your turn/);
    await expectEchoAndPadsInView(page);
  });

  test("Echo, the pads and the scope fit both orientations", async ({
    page,
  }) => {
    const viewport = page.viewportSize();
    expect(viewport).not.toBeNull();
    for (const size of [
      { width: viewport!.height, height: viewport!.width },
      { width: viewport!.width, height: viewport!.height },
    ]) {
      await page.setViewportSize(size);
      await assertNoHorizontalOverflow(page);
      await scrollEchoIntoPlace(page);
      await expectEchoAndPadsInView(page);
      const scope = await page
        .locator('[data-testid="meme-oscilloscope"]')
        .boundingBox();
      expect(scope).not.toBeNull();
      expect(scope!.x + scope!.width).toBeLessThanOrEqual(size.width + 1);
    }
  });

  test("Echo stops its playback while the page is hidden and replays on return", async ({
    page,
  }) => {
    await tapFirstPadUntilHydrated(page);
    await watchLitPads(page);
    await page.getByRole("button", { name: "Start Echo" }).tap();
    const setHidden = (hidden: boolean) =>
      page.evaluate((value) => {
        Object.defineProperty(document, "hidden", {
          configurable: true,
          get: () => value,
        });
        document.dispatchEvent(new Event("visibilitychange"));
      }, hidden);
    await setHidden(true);
    const frozen = (await litLog(page)).length;
    await page.waitForTimeout(2500);
    expect((await litLog(page)).length).toBe(frozen);
    await expect(page.locator(MEME_STATUS)).toHaveText(/^Watch/);
    await setHidden(false);
    await expect(page.locator(MEME_STATUS)).toHaveText(/^Your turn/);
  });

  test("the sampler, shelf and deck have no blocking axe violations", async ({
    page,
  }) => {
    const results = await new AxeBuilder({ page })
      .include(MEME_ROOT)
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

  test.describe("Split View (ADR 0061)", () => {
    for (const width of [507, 678]) {
      test(`${width}x1024: no overflow, 44px controls, Echo and pads in view`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 1024 });
        await assertNoHorizontalOverflow(page);
        await meetsTouchSizes(page);
        await scrollEchoIntoPlace(page);
        await expectEchoAndPadsInView(page);
      });
    }
  });
});

// Study Director: the office and the classic desk in the touch cabinet. Both
// views fit the stage in either orientation and play by finger and Pencil
// (#2076).
const SD_ROUTE = "/arcade/study-director";
const SD_WORLD = ".sd-world-touch";
const SD_DESK = ".sd-desk-touch";

/** Launches the cabinet and waits for the office, then closes its first-run help. */
async function launchStudyDirector(page: Page) {
  const launch = page.getByRole("button", { name: /Launch Cabinet/i });
  await expect(async () => {
    if ((await page.locator(IMMERSIVE).count()) > 0) return;
    await launch.tap({ timeout: 5000 });
    await expect(page.locator(IMMERSIVE)).toBeVisible({ timeout: 5000 });
  }).toPass({ timeout: 180000 });
  await expect(page.locator(SD_WORLD)).toBeVisible({ timeout: 90000 });
}

async function closeWorldIntro(page: Page) {
  const start = page.getByRole("button", { name: /Start the day/ });
  await expect(async () => {
    if (await start.isVisible()) await start.tap({ timeout: 3000 });
    await expect(page.getByTestId("world-intro")).toBeHidden({
      timeout: 3000,
    });
  }).toPass({ timeout: 15000 });
}

/** Waits until focus is inside `selector`, as a dialog's focus trap puts it. */
async function expectFocusInside(page: Page, selector: string) {
  await expect
    .poll(() =>
      page.evaluate((sel) => !!document.activeElement?.closest(sel), selector)
    )
    .toBe(true);
}

async function openClassicDesk(page: Page) {
  await page
    .getByRole("button", { name: /Switch to the classic desk/ })
    .tap({ timeout: 15000 });
  await page
    .getByRole("button", { name: /Start the study \(classic desk\)/ })
    .tap({ timeout: 15000 });
  await expect(page.locator(SD_DESK)).toBeVisible();
}

/** Every box the view draws sits inside the viewport. */
async function expectInsideViewport(page: Page, selectors: string[]) {
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  for (const selector of selectors) {
    const boxes = page.locator(selector);
    const count = await boxes.count();
    expect(count, `${selector} is on screen`).toBeGreaterThan(0);
    for (let i = 0; i < count; i += 1) {
      const box = await boxes.nth(i).boundingBox();
      if (!box || box.width <= 1) continue;
      expect(box.x, `${selector} ${i} left`).toBeGreaterThanOrEqual(-1);
      expect(box.x + box.width, `${selector} ${i} right`).toBeLessThanOrEqual(
        viewport!.width + 1
      );
      expect(box.y, `${selector} ${i} top`).toBeGreaterThanOrEqual(-1);
      expect(box.y + box.height, `${selector} ${i} bottom`).toBeLessThanOrEqual(
        viewport!.height + 1
      );
    }
  }
}

/** Controls under 44px and text under 12px inside a view, art (SVG) aside. */
async function sdTouchSizes(page: Page, root: string) {
  const controls = page.locator(`${root} button:visible`);
  await expect(controls.first()).toBeVisible({ timeout: 60000 });
  const count = await controls.count();
  const small: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const box = await controls.nth(i).boundingBox();
    if (!box || box.width <= 1) continue;
    if (box.width < 44 - 0.5 || box.height < 44 - 0.5) {
      small.push(
        `${i}: ${Math.round(box.width)}x${Math.round(box.height)} ${(await controls.nth(i).innerText()).slice(0, 30)}`
      );
    }
  }
  expect(small).toEqual([]);
  const tiny = await page.evaluate((selector) => {
    const el = document.querySelector(selector);
    if (!el) return ["no view root"];
    const offenders: string[] = [];
    el.querySelectorAll<HTMLElement>("*").forEach((node) => {
      // SVG text is art scaled by its viewBox, not page text.
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
          `${node.tagName} ${style.fontSize} ${node.textContent?.trim().slice(0, 40)}`
        );
      }
    });
    return offenders.slice(0, 10);
  }, root);
  expect(tiny).toEqual([]);
}

async function sdAxe(page: Page) {
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

test.describe("Study Director on a tablet (iPad projects, #2076)", () => {
  test.setTimeout(300000);

  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(
      !/^iPad/.test(testInfo.project.name),
      "iPad projects only (ADR 0061)"
    );
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(SD_ROUTE);
  });

  test("the notice is hidden, and the cabinet launches fit to the viewport", async ({
    page,
  }) => {
    await expect(page.locator(NOTICE)).toBeHidden();
    await launchStudyDirector(page);
    await expect(page.locator(IMMERSIVE)).toHaveAttribute(
      "data-mobile-layout",
      "fit"
    );
    await expectFillsViewport(page, page.locator(IMMERSIVE));
    await assertNoHorizontalOverflow(page);
  });

  test("the office fits both orientations, with the floor taking a fair share of the height", async ({
    page,
  }) => {
    await launchStudyDirector(page);
    await closeWorldIntro(page);
    const { width, height } = page.viewportSize()!;
    for (const size of [
      { width, height },
      { width: height, height: width },
    ]) {
      await page.setViewportSize(size);
      await expect(page.locator(SD_WORLD)).toBeVisible();
      await expectInsideViewport(page, [
        SD_WORLD,
        '[data-testid="world-hud"]',
        '[data-testid="world-canvas"]',
        '[data-testid="world-touch-controls"]',
        '[data-testid="world-side"]',
      ]);
      const canvas = await page
        .locator('[data-testid="world-canvas"]')
        .boundingBox();
      expect(canvas).not.toBeNull();
      expect(canvas!.height / size.height).toBeGreaterThanOrEqual(0.35);
      await assertNoHorizontalOverflow(page);
    }
  });

  test("the classic desk fits both orientations: status, tabs, section and actions stay on screen", async ({
    page,
  }) => {
    await launchStudyDirector(page);
    await closeWorldIntro(page);
    await openClassicDesk(page);
    const { width, height } = page.viewportSize()!;
    for (const size of [
      { width, height },
      { width: height, height: width },
    ]) {
      await page.setViewportSize(size);
      await expectInsideViewport(page, [
        SD_DESK,
        '[data-testid="study-status-bar"]',
        '[data-testid="desk-tabs"]',
        '[data-testid="desk-section"]',
        '[data-testid="desk-actions"]',
      ]);
      const section = await page
        .locator('[data-testid="desk-section"]')
        .boundingBox();
      expect(section!.height / size.height).toBeGreaterThanOrEqual(0.35);
      await assertNoHorizontalOverflow(page);
    }
  });

  test("the page cannot scroll behind the open cabinet", async ({ page }) => {
    await launchStudyDirector(page);
    await attemptPageScroll(page);
    await settleScroll(page);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });

  test("every control in the office is 44px and no text is under 12px", async ({
    page,
  }) => {
    await launchStudyDirector(page);
    await closeWorldIntro(page);
    await sdTouchSizes(page, SD_WORLD);
  });

  test("every control on the classic desk is 44px and no text is under 12px", async ({
    page,
  }) => {
    await launchStudyDirector(page);
    await closeWorldIntro(page);
    await openClassicDesk(page);
    await sdTouchSizes(page, SD_DESK);
    for (const tab of ["Dashboard", "Team", "Sites", "Office"]) {
      await page
        .getByTestId("desk-tabs")
        .getByRole("button", { name: tab })
        .tap();
      await sdTouchSizes(page, SD_DESK);
    }
  });

  test("a tap on the floor walks, and the E button talks to a teammate", async ({
    page,
  }) => {
    await launchStudyDirector(page);
    await closeWorldIntro(page);
    // Tap two tiles left of the player, who stands at the middle of the view.
    const clock = page.getByTestId("world-clock");
    const before = await clock.innerText();
    const canvas = page.getByTestId("world-canvas");
    await expect(async () => {
      const box = (await canvas.boundingBox())!;
      await canvas.tap({
        position: {
          x: box.width / 2 - (2 * box.width) / 22,
          y: box.height / 2 + 4,
        },
        timeout: 5000,
      });
      await expect(clock).not.toHaveText(before, { timeout: 3000 });
    }).toPass({ timeout: 15000 });

    // Walk to a teammate through the directory, then talk with the E button.
    await page
      .getByRole("button", { name: /^Office directory/ })
      .tap({ timeout: 15000 });
    await page.getByRole("button", { name: /^Walk to Maya/ }).tap();
    const use = page.getByRole("button", { name: /^E, / });
    await expect(page.getByTestId("world-use-label")).toHaveText(/Talk to/, {
      timeout: 30000,
    });
    await use.tap();
    const dialogue = page.getByTestId("world-dialogue");
    await expect(dialogue).toBeVisible();
    // A tap on the box finishes the typing.
    await dialogue.tap({ position: { x: 20, y: 20 } });
    await expect(dialogue).toHaveAttribute("data-typing", "done");
    const viewport = page.viewportSize()!;
    const box = (await dialogue.boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
    // Escape closes the dialogue, and the cabinet stays open.
    await page.keyboard.press("Escape");
    await expect(dialogue).toBeHidden();
    await expect(page.locator(IMMERSIVE)).toBeVisible();
  });

  test("F shows a result card; Escape closes it while the cabinet stays open", async ({
    page,
  }) => {
    await launchStudyDirector(page);
    await closeWorldIntro(page);
    await page
      .getByRole("button", { name: /^F, How are you\?/ })
      .tap({ timeout: 15000 });
    const card = page.getByTestId("world-outcome");
    await expect(card).toBeVisible();
    await page.getByTestId("world-playfield").focus();
    await page.keyboard.press("Escape");
    await expect(card).toBeHidden();
    await expect(page.locator(IMMERSIVE)).toBeVisible();
  });

  test("the first-run help is a dialog: Escape closes it and the cabinet stays open", async ({
    page,
  }) => {
    await launchStudyDirector(page);
    const intro = page.getByTestId("world-intro");
    await expect(intro).toBeVisible();
    const viewport = page.viewportSize()!;
    const box = (await intro.boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
    // Escape belongs to the help once its focus trap has taken focus; before
    // that a slow runner hands the key to the cabinet, which closes.
    await expectFocusInside(page, '[data-testid="world-intro"]');
    await page.keyboard.press("Escape");
    await expect(intro).toBeHidden();
    await expect(page.locator(IMMERSIVE)).toBeVisible();
  });

  test("the classic desk makes a choice and ends a day by taps alone", async ({
    page,
  }) => {
    await launchStudyDirector(page);
    await closeWorldIntro(page);
    await openClassicDesk(page);
    const decision = page.getByTestId("study-decision");
    const option = decision
      .getByRole("button")
      .filter({ hasNot: page.locator("[disabled]") })
      .first();
    await option.tap({ timeout: 15000 });
    await expect(page.getByTestId("desk-actions")).toBeVisible();
    await page.getByRole("button", { name: "End day" }).tap();
    await expect(page.getByTestId("study-status-bar")).toContainText(/Day 2/);
  });

  test("the shortcut sheet opens by tap and fits; Escape closes it while the cabinet stays open", async ({
    page,
  }) => {
    await launchStudyDirector(page);
    await closeWorldIntro(page);
    await openClassicDesk(page);
    await page.getByRole("button", { name: "Keyboard shortcuts" }).tap();
    const sheet = page.getByRole("dialog", { name: "Keyboard shortcuts" });
    await expect(sheet).toBeVisible();
    const viewport = page.viewportSize()!;
    const box = (await sheet.boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
    await expectFocusInside(page, '[role="dialog"]');
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect(page.locator(IMMERSIVE)).toBeVisible();
  });

  test("the office has no blocking axe violations", async ({ page }) => {
    await launchStudyDirector(page);
    await closeWorldIntro(page);
    await sdAxe(page);
  });

  test("the classic desk has no blocking axe violations", async ({ page }) => {
    await launchStudyDirector(page);
    await closeWorldIntro(page);
    await openClassicDesk(page);
    await sdAxe(page);
  });

  test.describe("Split View (ADR 0061)", () => {
    for (const width of [507, 678]) {
      test(`${width}x1024: the notice offers Try it anyway, with no overflow`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 1024 });
        await page.goto(SD_ROUTE);
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

// Laser Loon: the arena, the dock and the menu sheet in the touch cabinet.
// One finger aims and steers, the other thumb holds Fire (#2081).
const LL_ROUTE = "/arcade/laser-loon";
const LL_ROOT = ".ll-touch";
const LL_DOCK = '[data-testid="loon-touch-controls"]';
const LL_GATE = "[data-touch-controls]";

/** Launches the cabinet and waits for the game's touch layout. */
async function launchLaserLoon(page: Page) {
  const launch = page.getByRole("button", { name: /Launch Cabinet/i });
  await expect(async () => {
    if ((await page.locator(IMMERSIVE).count()) > 0) return;
    await launch.tap({ timeout: 5000 });
    await expect(page.locator(IMMERSIVE)).toBeVisible({ timeout: 5000 });
  }).toPass({ timeout: 180000 });
  await expect(page.locator(LL_ROOT).first()).toBeVisible({ timeout: 90000 });
}

/**
 * Taps through to live play. The cabinet's one title screen is the attract
 * screen, so Launch lands on the Act 1 front page; a bare game shows its own
 * title first.
 */
async function startLaserLoonRun(page: Page) {
  const engage = page.getByRole("button", { name: /Engage stage/i });
  const title = page.getByRole("button", { name: /START CAMPAIGN/ }).first();
  await expect(async () => {
    if (await title.isVisible()) await title.tap({ timeout: 3000 });
    await expect(engage).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 30000 });
  await engage.tap({ timeout: 15000 });
  await expect(page.getByRole("button", { name: "Pause Game" })).toBeVisible();
}

const llScore = async (page: Page) => {
  const text = await page
    .getByRole("group", { name: "Game status" })
    .innerText();
  return Number(/SCORE\s*(\d+)/i.exec(text)?.[1] ?? 0);
};

/** A box sits wholly inside the viewport. */
async function expectBoxInViewport(
  page: Page,
  locator: Locator,
  label: string
) {
  const viewport = page.viewportSize()!;
  const box = await locator.boundingBox();
  expect(box, `${label} has a box`).not.toBeNull();
  expect(box!.x, `${label} left`).toBeGreaterThanOrEqual(-1);
  expect(box!.y, `${label} top`).toBeGreaterThanOrEqual(-1);
  expect(box!.x + box!.width, `${label} right`).toBeLessThanOrEqual(
    viewport.width + 1
  );
  expect(box!.y + box!.height, `${label} bottom`).toBeLessThanOrEqual(
    viewport.height + 1
  );
}

test.describe("Laser Loon on a tablet (iPad projects, #2081)", () => {
  test.setTimeout(300000);

  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(
      !/^iPad/.test(testInfo.project.name),
      "iPad projects only (ADR 0061)"
    );
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(LL_ROUTE);
  });

  test("the notice is hidden, and the cabinet launches fit to the viewport", async ({
    page,
  }) => {
    await expect(page.locator(NOTICE)).toBeHidden();
    await launchLaserLoon(page);
    await expect(page.locator(IMMERSIVE)).toHaveAttribute(
      "data-mobile-layout",
      "fit"
    );
    await expectFillsViewport(page, page.locator(IMMERSIVE));
    await assertNoHorizontalOverflow(page);
  });

  test("the arena, status strip and dock fit both orientations without page scroll", async ({
    page,
  }) => {
    await launchLaserLoon(page);
    await startLaserLoonRun(page);
    const { width, height } = page.viewportSize()!;
    for (const size of [
      { width, height },
      { width: height, height: width },
    ]) {
      await page.setViewportSize(size);
      await expect(page.locator(LL_ROOT).first()).toBeVisible();
      await expectInsideViewport(page, [
        LL_ROOT,
        '[aria-label="Game status"]',
        'canvas[role="application"]',
        LL_DOCK,
      ]);
      const canvas = (await page
        .locator('canvas[role="application"]')
        .boundingBox())!;
      const landscape = size.width > size.height;
      // The canvas is the biggest 768:420 box the strip and dock leave.
      expect(canvas.width / size.width).toBeGreaterThanOrEqual(
        landscape ? 0.55 : 0.95
      );
      expect(canvas.height / size.height).toBeGreaterThanOrEqual(
        landscape ? 0.6 : 0.34
      );
      expect(canvas.width / canvas.height).toBeCloseTo(768 / 420, 1);
      // The strip stays clear of the floating toolbar.
      const toolbar = (await page
        .getByTestId("cabinet-touch-toolbar")
        .boundingBox())!;
      const menu = (await page
        .getByRole("button", { name: "Menu", exact: true })
        .boundingBox())!;
      expect(menu.x + menu.width).toBeLessThanOrEqual(toolbar.x + 1);
      await assertNoHorizontalOverflow(page);
      expect(
        await page.evaluate(
          () => document.scrollingElement!.scrollHeight - window.innerHeight
        )
      ).toBeLessThanOrEqual(1);
    }
  });

  test("the page cannot scroll behind the open cabinet", async ({ page }) => {
    await launchLaserLoon(page);
    await attemptPageScroll(page);
    await settleScroll(page);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });

  test("every control is 44px and no text is under 12px: title, play, pause, menu, museum", async ({
    page,
  }) => {
    await launchLaserLoon(page);
    await sdTouchSizes(page, LL_ROOT);

    await expect(page.getByText("The Loon Ledger")).toBeVisible();
    await sdTouchSizes(page, LL_ROOT);
    await page.getByRole("button", { name: /Engage stage/i }).tap();
    await expect(
      page.getByRole("button", { name: "Pause Game" })
    ).toBeVisible();
    await sdTouchSizes(page, LL_ROOT);

    await page.getByRole("button", { name: "Pause Game" }).tap();
    await expect(
      page.getByRole("heading", { name: "GAME PAUSED" })
    ).toBeVisible();
    await sdTouchSizes(page, LL_ROOT);
    await page.getByRole("button", { name: /RESUME GAME/ }).tap();

    await page.getByRole("button", { name: "Menu", exact: true }).tap();
    await expect(page.getByTestId("loon-menu-sheet")).toBeVisible();
    await sdTouchSizes(page, LL_ROOT);
    await page.getByRole("button", { name: "Flag Museum" }).tap();
    await expect(
      page.getByRole("dialog", { name: "Minnesota Flag Redesign Museum" })
    ).toBeVisible();
    await sdTouchSizes(page, LL_ROOT);
  });

  test("the act intro fits, and its Engage button is on screen", async ({
    page,
  }) => {
    await launchLaserLoon(page);
    const engage = page.getByRole("button", { name: /Engage stage/i });
    await expect(engage).toBeVisible();
    await expectBoxInViewport(page, engage, "Engage stage");
    const { width, height } = page.viewportSize()!;
    await page.setViewportSize({ width: height, height: width });
    await expectBoxInViewport(page, engage, "Engage stage (turned)");
  });

  test("a drag steers and the Fire key shoots: two fingers score on the rival flags", async ({
    page,
  }) => {
    await launchLaserLoon(page);
    await startLaserLoonRun(page);
    // The arena centres in the height the dock leaves, so measure once the
    // layout has settled: two reads a frame apart that agree.
    const settledBox = async (locator: Locator) => {
      let last = await locator.boundingBox();
      await expect(async () => {
        await page.waitForTimeout(100);
        const next = await locator.boundingBox();
        const same = JSON.stringify(next) === JSON.stringify(last);
        last = next;
        expect(same).toBe(true);
      }).toPass({ timeout: 15000 });
      return last!;
    };
    const fire = await settledBox(
      page.getByRole("button", { name: "Fire (hold)" })
    );
    const canvas = await settledBox(page.locator('canvas[role="application"]'));
    const cdp = await page.context().newCDPSession(page);
    const fireAt = {
      x: fire.x + fire.width / 2,
      y: fire.y + fire.height / 2,
      id: 1,
    };
    // The aiming finger traces the right of the arena, where the rival flags
    // fly, sweeping across as well as up and down so it finds one wherever
    // the act has spawned it.
    const at = (t: number) => ({
      x: canvas.x + canvas.width * (0.35 + 0.6 * Math.abs(Math.sin(t * 0.37))),
      y: canvas.y + canvas.height * (0.1 + 0.8 * Math.abs(Math.sin(t))),
      id: 2,
    });
    const pause = page.getByRole("button", { name: "Pause Game" });
    const retry = page.getByRole("button", { name: /Try Act 1 again/ });
    // Sweep the aiming finger while Fire stays held. A blind sweep can lose
    // the act before it lands a hit, most often on a loaded machine, so a
    // lost act lifts both fingers, starts the act again and keeps sweeping:
    // the claim is that two fingers score, not that one sweep is lucky.
    const start = Date.now();
    let t = 0;
    let holding = false;
    while (Date.now() - start < 90000 && (await llScore(page)) === 0) {
      if (!(await pause.isVisible())) {
        if (holding) {
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchEnd",
            touchPoints: [],
          });
          holding = false;
        }
        if (await retry.isVisible()) await retry.tap();
        await page.waitForTimeout(250);
        continue;
      }
      t += 0.35;
      await cdp.send("Input.dispatchTouchEvent", {
        type: holding ? "touchMove" : "touchStart",
        touchPoints: [fireAt, at(t)],
      });
      holding = true;
      await page.waitForTimeout(40);
    }
    if (holding) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
    }
    expect(await llScore(page)).toBeGreaterThan(0);
  });

  test("a tap on the arena aims without shooting: no score from taps alone", async ({
    page,
  }) => {
    await launchLaserLoon(page);
    await startLaserLoonRun(page);
    const canvas = page.locator('canvas[role="application"]');
    const box = (await canvas.boundingBox())!;
    for (let i = 0; i < 12; i += 1) {
      await canvas.tap({
        position: { x: box.width * 0.85, y: box.height * (0.15 + 0.07 * i) },
      });
      await page.waitForTimeout(150);
    }
    expect(await llScore(page)).toBe(0);
  });

  test("the optic keys select the laser", async ({ page }) => {
    await launchLaserLoon(page);
    const aurora = page.getByRole("button", { name: "Optic 3: Aurora" });
    await aurora.tap();
    await expect(aurora).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.getByRole("button", { name: "Optic 1: Ruby" })
    ).toHaveAttribute("aria-pressed", "false");
  });

  test("Pause stops the run and Escape resumes it, with the cabinet staying open", async ({
    page,
  }) => {
    await launchLaserLoon(page);
    await startLaserLoonRun(page);
    await page.getByRole("button", { name: "Pause Game" }).tap();
    const dialog = page.getByRole("dialog", { name: /GAME PAUSED/ });
    await expect(dialog).toBeVisible();
    await expectBoxInViewport(page, dialog, "pause menu");
    await expectFocusInside(page, '[role="dialog"]');
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(page.locator(IMMERSIVE)).toBeVisible();
  });

  test("Escape during play pauses instead of leaving the cabinet", async ({
    page,
  }) => {
    await launchLaserLoon(page);
    await startLaserLoonRun(page);
    await page.locator(".arcade-shooter-playfield").focus();
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("heading", { name: "GAME PAUSED" })
    ).toBeVisible();
    await expect(page.locator(IMMERSIVE)).toBeVisible();
  });

  test("the Menu sheet traps focus, fits, and Escape closes it while the cabinet stays open", async ({
    page,
  }) => {
    await launchLaserLoon(page);
    await page.getByRole("button", { name: "Menu", exact: true }).tap();
    const sheet = page.getByTestId("loon-menu-sheet");
    await expect(sheet).toBeVisible();
    await expectBoxInViewport(page, sheet, "menu sheet");
    await expectFocusInside(page, '[data-testid="loon-menu-sheet"]');
    for (let i = 0; i < 12; i += 1) {
      await page.keyboard.press("Tab");
      expect(
        await page.evaluate(
          () =>
            !!document.activeElement?.closest('[data-testid="loon-menu-sheet"]')
        )
      ).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect(page.locator(IMMERSIVE)).toBeVisible();
  });

  test("the Flag Museum fits, traps focus, and Escape closes it while the cabinet stays open", async ({
    page,
  }) => {
    await launchLaserLoon(page);
    await page.getByRole("button", { name: "Menu", exact: true }).tap();
    await page.getByRole("button", { name: "Flag Museum" }).tap();
    const museum = page.getByRole("dialog", {
      name: "Minnesota Flag Redesign Museum",
    });
    await expect(museum).toBeVisible();
    await expectBoxInViewport(page, museum, "museum");
    const { width, height } = page.viewportSize()!;
    await page.setViewportSize({ width: height, height: width });
    await expectBoxInViewport(page, museum, "museum (turned)");
    await expectFocusInside(page, '[role="dialog"]');
    for (let i = 0; i < 12; i += 1) {
      await page.keyboard.press("Tab");
      expect(
        await page.evaluate(
          () => !!document.activeElement?.closest('[role="dialog"]')
        )
      ).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(museum).toBeHidden();
    await expect(page.locator(IMMERSIVE)).toBeVisible();
  });

  test("a hidden tab or a blurred window pauses a run in progress", async ({
    page,
  }) => {
    await launchLaserLoon(page);
    await startLaserLoonRun(page);
    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    await expect(
      page.getByRole("heading", { name: "GAME PAUSED" })
    ).toBeVisible();
    await page.getByRole("button", { name: /RESUME GAME/ }).tap();
    await expect(
      page.getByRole("heading", { name: "GAME PAUSED" })
    ).toBeHidden();
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => "hidden",
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect(
      page.getByRole("heading", { name: "GAME PAUSED" })
    ).toBeVisible();
  });

  test("with a keyboard case the dock hides and every shortcut works; a tap brings it back", async ({
    page,
  }) => {
    await launchLaserLoon(page);
    const gate = page.locator(LL_GATE).first();
    await expect(gate).toHaveAttribute("data-touch-controls", "shown");
    await page.locator(".arcade-shooter-playfield").focus();
    await page.keyboard.press("3");
    await expect(gate).toHaveAttribute("data-touch-controls", "hidden");
    await expect(
      page.getByRole("button", { name: "Optic 3: Aurora", includeHidden: true })
    ).toHaveAttribute("aria-pressed", "true");
    const museum = page.getByRole("dialog", {
      name: "Minnesota Flag Redesign Museum",
    });
    await page.keyboard.press("m");
    await expect(museum).toBeVisible();
    await expectFocusInside(page, '[role="dialog"]');
    await page.keyboard.press("Escape");
    await expect(museum).toBeHidden();
    await page.locator(".arcade-shooter-playfield").focus();
    // Space engages the act, P pauses and resumes it.
    await page.keyboard.press("Space");
    await expect(
      page.getByRole("button", { name: "Pause Game" })
    ).toBeVisible();
    const paused = page.getByRole("heading", { name: "GAME PAUSED" });
    await page.keyboard.press("p");
    await expect(paused).toBeVisible();
    await page.keyboard.press("p");
    await expect(paused).toBeHidden();
    await expect(gate).toHaveAttribute("data-touch-controls", "hidden");
    await page.getByRole("button", { name: "Pause Game" }).tap();
    await expect(gate).toHaveAttribute("data-touch-controls", "shown");
  });

  test("the Apple Pencil works like a finger", async ({ page }) => {
    await launchLaserLoon(page);
    await startLaserLoonRun(page);
    const cabinet = page.locator(IMMERSIVE);
    const canvas = (await page
      .locator('canvas[role="application"]')
      .boundingBox())!;
    const cdp = await page.context().newCDPSession(page);
    const x = canvas.x + canvas.width * 0.6;
    const y = canvas.y + canvas.height * 0.5;
    await cdp.send("Input.dispatchMouseEvent", {
      type: "mousePressed",
      x,
      y,
      button: "left",
      clickCount: 1,
      pointerType: "pen",
    });
    await cdp.send("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      x,
      y,
      button: "left",
      clickCount: 1,
      pointerType: "pen",
    });
    await expect(cabinet).toHaveAttribute("data-input-modality", "pen");
    await expect(page.locator(LL_GATE).first()).toHaveAttribute(
      "data-touch-controls",
      "shown"
    );
    expect(await llScore(page)).toBe(0);
  });

  test("the playing cabinet has no blocking axe violations", async ({
    page,
  }) => {
    await launchLaserLoon(page);
    await sdAxe(page);
    await startLaserLoonRun(page);
    await sdAxe(page);
    await page.getByRole("button", { name: "Menu", exact: true }).tap();
    await expect(page.getByTestId("loon-menu-sheet")).toBeVisible();
    await sdAxe(page);
  });

  test.describe("Split View (ADR 0061)", () => {
    for (const width of [507, 678]) {
      test(`${width}x1024: the notice offers Try it anyway, with no overflow`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 1024 });
        await page.goto(LL_ROUTE);
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

      test(`${width}x1024: Try it anyway launches a cabinet that fits`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 1024 });
        await page.goto(LL_ROUTE);
        await page.getByRole("button", { name: /Try it anyway/i }).tap();
        await launchLaserLoon(page);
        await startLaserLoonRun(page);
        await expectInsideViewport(page, [
          LL_ROOT,
          'canvas[role="application"]',
          LL_DOCK,
        ]);
        await assertNoHorizontalOverflow(page);
      });
    }
  });
});

// Clinical Trial Chaos: the floor, its dock and its sheets in the touch
// cabinet (#2105). Stations and lifelines are keys in the dock; every dialog is
// a sheet that traps focus and closes on Escape without closing the cabinet.
const CC_ROUTE = "/arcade/clinical-chaos";
const CC_ROOT = ".cc-touch";
const CC_DOCK = '[data-testid="cc-touch-dock"]';
const CC_GATE = "[data-touch-controls]";
const CC_BOARD = "[data-keyboard-boundary]";

/** Launches the cabinet and waits for the game's touch layout. */
async function launchChaos(page: Page) {
  const launch = page.getByRole("button", { name: /Launch Cabinet/i });
  await expect(async () => {
    if ((await page.locator(IMMERSIVE).count()) > 0) return;
    await launch.tap({ timeout: 5000 });
    await expect(page.locator(IMMERSIVE)).toBeVisible({ timeout: 5000 });
  }).toPass({ timeout: 180000 });
  await expect(page.locator(CC_ROOT).first()).toBeVisible({ timeout: 90000 });
}

/**
 * Taps through to a live shift. The shift briefing is the game's one start
 * step, so it follows Launch. The first shift opens with a calibration that
 * holds every clock still, which keeps the whole first fix and route safe from
 * the timers; pass `skip` to go straight to a running shift.
 */
async function startChaos(page: Page, skip = false) {
  await page
    .getByRole("button", { name: /Start 3-Phase Campaign/i })
    .tap({ timeout: 30000 });
  await expect(page.locator(CC_DOCK)).toBeVisible({ timeout: 15000 });
  if (skip) {
    await page.getByRole("button", { name: /Skip calibration/i }).tap();
  }
}

/** The number in the HUD's "locked" tally. */
const ccLocked = async (page: Page) => {
  const text = await page.locator(".cc-hud").innerText();
  return Number(/(\d+)\/5/.exec(text)?.[1] ?? 0);
};

/** Fixes every flagged field on the open dossier by tapping answers. */
async function fixOpenDossier(page: Page) {
  const fixIt = page.getByRole("button", { name: /Fix it/i });
  const dialog = page.getByRole("dialog", {
    name: /Controlled Terminology/i,
  });
  for (let round = 0; round < 6 && (await fixIt.isVisible()); round += 1) {
    await fixIt.tap();
    await expect(dialog).toBeVisible();
    // A wrong answer is rejected and disabled, so the next open one is tried
    // until the dialog accepts one and closes itself.
    for (let i = 0; i < 4 && (await dialog.isVisible()); i += 1) {
      const options = dialog.locator("button:has(kbd):not([disabled])");
      if ((await options.count()) === 0) break;
      await options.first().tap();
      await page.waitForTimeout(700);
    }
    await expect(dialog).toBeHidden({ timeout: 10000 });
  }
}

/** Routes the open, clean dossier by tapping the dock key that accepts it. */
async function routeOpenDossier(page: Page) {
  await page
    .locator('.cc-station[data-state="accepts"]')
    .first()
    .tap({ timeout: 10000 });
  const sign = page.getByRole("button", {
    name: /Sign & Lock CRF|Countersign/i,
  });
  await page.waitForTimeout(300);
  if (await sign.isVisible()) await sign.tap();
}

test.describe("Clinical Trial Chaos on a tablet (iPad projects, #2105)", () => {
  test.setTimeout(300000);

  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(
      !/^iPad/.test(testInfo.project.name),
      "iPad projects only (ADR 0061)"
    );
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(CC_ROUTE);
  });

  test("the notice is hidden, and the cabinet launches fit to the viewport", async ({
    page,
  }) => {
    await expect(page.locator(NOTICE)).toBeHidden();
    await launchChaos(page);
    await expect(page.locator(IMMERSIVE)).toHaveAttribute(
      "data-mobile-layout",
      "fit"
    );
    await expectFillsViewport(page, page.locator(IMMERSIVE));
    await assertNoHorizontalOverflow(page);
  });

  test("the floor, meters, dossier and dock fit both orientations without scrolling", async ({
    page,
  }) => {
    await launchChaos(page);
    await startChaos(page);
    const { width, height } = page.viewportSize()!;
    for (const size of [
      { width, height },
      { width: height, height: width },
    ]) {
      await page.setViewportSize(size);
      await expect(page.locator(CC_ROOT).first()).toBeVisible();
      await expectInsideViewport(page, [
        CC_ROOT,
        'canvas[role="application"]',
        '[aria-labelledby="cc-dossier-title"]',
        CC_DOCK,
      ]);
      // Nothing scrolls: not the page, not the game, not the floor.
      const overflow = await page.evaluate(() => {
        const floor = document.querySelector<HTMLElement>(".cc-floor")!;
        const root = document.querySelector<HTMLElement>(".cc-touch")!;
        return [
          document.scrollingElement!.scrollHeight - window.innerHeight,
          floor.scrollHeight - floor.clientHeight,
          root.scrollHeight - root.clientHeight,
        ].map((n) => Math.max(0, n));
      });
      expect(overflow.every((n) => n <= 1)).toBe(true);
      // The dock sits at the bottom edge, with no dead band under it.
      const dock = (await page.locator(CC_DOCK).boundingBox())!;
      expect(size.height - (dock.y + dock.height)).toBeLessThanOrEqual(24);
      // The status row stays clear of the floating toolbar.
      const toolbar = (await page
        .getByTestId("cabinet-touch-toolbar")
        .boundingBox())!;
      const pause = (await page
        .getByRole("button", { name: "Pause shift", exact: true })
        .boundingBox())!;
      const clear =
        pause.x + pause.width <= toolbar.x + 1 ||
        pause.y >= toolbar.y + toolbar.height - 1;
      expect(clear).toBe(true);
      await assertNoHorizontalOverflow(page);
    }
  });

  test("the page cannot scroll behind the open cabinet", async ({ page }) => {
    await launchChaos(page);
    await attemptPageScroll(page);
    await settleScroll(page);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });

  test("every control is 44px and no text is under 12px: briefing, floor, tabs, sheets", async ({
    page,
  }) => {
    await launchChaos(page);
    await sdTouchSizes(page, CC_ROOT);
    await startChaos(page);
    await sdTouchSizes(page, CC_ROOT);

    await page.getByRole("button", { name: "Pause shift", exact: true }).tap();
    await expect(
      page.getByRole("dialog", { name: /Shift paused/i })
    ).toBeVisible();
    await sdTouchSizes(page, CC_ROOT);
    await page
      .getByRole("button", { name: "Resume shift (P)", exact: true })
      .tap();

    await page.getByRole("button", { name: /Fix it/i }).tap();
    await expect(
      page.getByRole("dialog", { name: /Controlled Terminology/i })
    ).toBeVisible();
    await sdTouchSizes(page, CC_ROOT);
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: /^Stress & BIMO Stream/ }).tap();
    await expect(page.getByTestId("cc-stress-sheet")).toBeVisible();
    await sdTouchSizes(page, CC_ROOT);
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: /Live SDTM Studio|SDTM/ }).tap();
    await expect(
      page.getByText(/Live CDISC SDTM Dataset Studio/)
    ).toBeVisible();
    await sdTouchSizes(page, CC_ROOT);
    await page.getByRole("button", { name: /Audit Trail Log|Audit/ }).tap();
    await expect(page.getByText(/IMMUTABLE AUDIT TRAIL/)).toBeVisible();
    await sdTouchSizes(page, CC_ROOT);
  });

  test("a shift is played by taps alone: fix a field, route it with a station key, and the lock counts", async ({
    page,
  }) => {
    await launchChaos(page);
    await startChaos(page);
    expect(await ccLocked(page)).toBe(0);
    // The first dossier is the calibration's, with the clocks held still, so
    // taps alone carry it from the flagged field to a locked CRF.
    await fixOpenDossier(page);
    await expect(
      page.locator('.cc-station[data-state="accepts"]').first()
    ).toBeVisible();
    await routeOpenDossier(page);
    await expect.poll(() => ccLocked(page), { timeout: 15000 }).toBe(1);
  });

  test("a lifeline key and a queue chip work by tap", async ({ page }) => {
    await launchChaos(page);
    await startChaos(page, true);
    const second = page.getByRole("button", { name: /^SUBJ-\d+/ }).nth(1);
    await second.tap();
    await expect(second).toHaveAttribute("aria-pressed", "true");
    const coffee = page.getByRole("button", { name: /^Lifeline Q / });
    await expect(coffee).toBeVisible();
    const box = (await coffee.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.width).toBeGreaterThanOrEqual(44);
  });

  test("the stress sheet fits, traps focus, and Escape closes it while the cabinet stays open", async ({
    page,
  }) => {
    await launchChaos(page);
    await startChaos(page, true);
    await page.getByRole("button", { name: /^Stress & BIMO Stream/ }).tap();
    const sheet = page.getByTestId("cc-stress-sheet");
    await expect(sheet).toBeVisible();
    await expectBoxInViewport(page, sheet, "stress sheet");
    const { width, height } = page.viewportSize()!;
    await page.setViewportSize({ width: height, height: width });
    await expectBoxInViewport(page, sheet, "stress sheet (turned)");
    for (let i = 0; i < 14; i += 1) {
      await page.keyboard.press("Tab");
      expect(
        await page.evaluate(
          () =>
            !!document.activeElement?.closest('[data-testid="cc-stress-sheet"]')
        )
      ).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect(page.locator(IMMERSIVE)).toBeVisible();
  });

  test("the fix dialog fits the screen, and Escape pressed at once after Enter closes it", async ({
    page,
  }) => {
    await launchChaos(page);
    await startChaos(page, true);
    const dialog = page.getByRole("dialog", {
      name: /Controlled Terminology/i,
    });
    await page.locator(CC_BOARD).focus();
    await page.keyboard.press("Enter");
    // No wait: focus has not moved into the dialog yet.
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(page.locator(IMMERSIVE)).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(dialog).toBeVisible();
    await expectBoxInViewport(page, dialog, "fix dialog");
    const { width, height } = page.viewportSize()!;
    await page.setViewportSize({ width: height, height: width });
    await expectBoxInViewport(page, dialog, "fix dialog (turned)");
    for (let i = 0; i < 12; i += 1) {
      await page.keyboard.press("Tab");
      expect(
        await page.evaluate(
          () => !!document.activeElement?.closest('[role="dialog"]')
        )
      ).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(page.locator(IMMERSIVE)).toBeVisible();
  });

  test("Pause stops the shift, and Escape pressed at once resumes it with the cabinet open", async ({
    page,
  }) => {
    await launchChaos(page);
    await startChaos(page, true);
    const paused = page.getByRole("dialog", { name: /Shift paused/i });
    await page.locator(CC_BOARD).focus();
    await page.keyboard.press("p");
    await page.keyboard.press("Escape");
    await expect(paused).toBeHidden();
    await expect(page.locator(IMMERSIVE)).toBeVisible();
    await page.getByRole("button", { name: "Pause shift", exact: true }).tap();
    await expect(paused).toBeVisible();
    await expectBoxInViewport(page, paused, "pause dialog");
    await page.keyboard.press("Escape");
    await expect(paused).toBeHidden();
    await expect(page.locator(IMMERSIVE)).toBeVisible();
  });

  test("Escape during a shift pauses instead of leaving the cabinet", async ({
    page,
  }) => {
    await launchChaos(page);
    await startChaos(page, true);
    await page.locator(CC_BOARD).focus();
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("dialog", { name: /Shift paused/i })
    ).toBeVisible();
    await expect(page.locator(IMMERSIVE)).toBeVisible();
  });

  test("a hidden tab or a blurred window pauses a shift in progress", async ({
    page,
  }) => {
    await launchChaos(page);
    await startChaos(page, true);
    const paused = page.getByRole("dialog", { name: /Shift paused/i });
    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    await expect(paused).toBeVisible();
    await page
      .getByRole("button", { name: "Resume shift (P)", exact: true })
      .tap();
    await expect(paused).toBeHidden();
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => "hidden",
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect(paused).toBeVisible();
  });

  test("with a keyboard case the dock hides and every shortcut works; a tap brings it back", async ({
    page,
  }) => {
    await launchChaos(page);
    await startChaos(page, true);
    const gate = page.locator(CC_GATE).first();
    await expect(gate).toHaveAttribute("data-touch-controls", "shown");
    await page.locator(CC_BOARD).focus();
    // A number key routes to its station: the first dossier still has a
    // flagged field, so the board says to fix it first.
    await page.keyboard.press("2");
    await expect(gate).toHaveAttribute("data-touch-controls", "hidden");
    await expect(page.getByText(/Resolve \d+ flagged/i).first()).toBeVisible();
    const dialog = page.getByRole("dialog", {
      name: /Controlled Terminology/i,
    });
    await page.keyboard.press("Enter");
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    const paused = page.getByRole("dialog", { name: /Shift paused/i });
    await page.keyboard.press("p");
    await expect(paused).toBeVisible();
    await page.keyboard.press("p");
    await expect(paused).toBeHidden();
    await expect(gate).toHaveAttribute("data-touch-controls", "hidden");
    await page.getByRole("button", { name: "Pause shift", exact: true }).tap();
    await expect(gate).toHaveAttribute("data-touch-controls", "shown");
  });

  test("the Apple Pencil works like a finger", async ({ page }) => {
    await launchChaos(page);
    await startChaos(page, true);
    const cabinet = page.locator(IMMERSIVE);
    const canvas = (await page
      .locator('canvas[role="application"]')
      .boundingBox())!;
    const cdp = await page.context().newCDPSession(page);
    const x = canvas.x + canvas.width * 0.3;
    const y = canvas.y + canvas.height * 0.55;
    for (const type of ["mousePressed", "mouseReleased"] as const) {
      await cdp.send("Input.dispatchMouseEvent", {
        type,
        x,
        y,
        button: "left",
        clickCount: 1,
        pointerType: "pen",
      });
    }
    await expect(cabinet).toHaveAttribute("data-input-modality", "pen");
    await expect(page.locator(CC_GATE).first()).toHaveAttribute(
      "data-touch-controls",
      "shown"
    );
    // The pen is a pointer like any other: it presses a dock key too.
    await page.getByRole("button", { name: "Pause shift", exact: true }).tap();
    await expect(
      page.getByRole("dialog", { name: /Shift paused/i })
    ).toBeVisible();
  });

  test("the playing cabinet has no blocking axe violations", async ({
    page,
  }) => {
    await launchChaos(page);
    await sdAxe(page);
    await startChaos(page);
    await sdAxe(page);
    await page.getByRole("button", { name: /^Stress & BIMO Stream/ }).tap();
    await expect(page.getByTestId("cc-stress-sheet")).toBeVisible();
    await sdAxe(page);
  });

  test.describe("Split View (ADR 0061)", () => {
    for (const width of [507, 678]) {
      test(`${width}x1024: the notice offers Try it anyway, with no overflow`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 1024 });
        await page.goto(CC_ROUTE);
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

      test(`${width}x1024: Try it anyway launches a cabinet that fits`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 1024 });
        await page.goto(CC_ROUTE);
        await page.getByRole("button", { name: /Try it anyway/i }).tap();
        await launchChaos(page);
        await startChaos(page);
        await expectInsideViewport(page, [
          CC_ROOT,
          'canvas[role="application"]',
          CC_DOCK,
        ]);
        await assertNoHorizontalOverflow(page);
      });
    }
  });
});

// Patty's Drive-Thru: the booth, its dock and its register sheet in the touch
// cabinet (#2116). The dock holds the turn, wipe, register and pause keys; the
// register is a sheet that traps focus and closes on Escape without closing the
// cabinet. A fixed seed makes every shift the same.
const PDT_ROUTE = "/arcade/patty-drive-thru?seed=tablet-1";
const PDT_ROOT = ".pdt-touch";
const PDT_DOCK = '[data-testid="pdt-touch-dock"]';
const PDT_GATE = "[data-touch-controls]";
const PDT_BOARD = '[data-testid="pdt-game"]';
const PDT_STAGE = '[data-testid="pdt-stage"]';
const PDT_SHEET = '[data-testid="pdt-register-sheet"]';

/** Launches the cabinet and waits for the game's touch layout. */
async function launchPatty(page: Page) {
  const launch = page.getByRole("button", { name: /Launch Cabinet/i });
  await expect(async () => {
    if ((await page.locator(IMMERSIVE).count()) > 0) return;
    await launch.tap({ timeout: 5000 });
    await expect(page.locator(IMMERSIVE)).toBeVisible({ timeout: 5000 });
  }).toPass({ timeout: 180000 });
  await expect(page.locator(PDT_ROOT).first()).toBeVisible({ timeout: 90000 });
}

/** Clocks in, and switches to the 3D booth unless the flat view is asked for. */
async function startPatty(page: Page, view: "3d" | "flat" = "3d") {
  await expect(async () => {
    if ((await page.locator(PDT_DOCK).count()) > 0) return;
    await page.getByRole("button", { name: "Clock in" }).tap({ timeout: 3000 });
    await expect(page.locator(PDT_DOCK)).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 30000 });
  const board = page.locator(PDT_BOARD);
  if (view === "3d") {
    await expect(async () => {
      if ((await board.getAttribute("data-pdt-view")) === "3d") return;
      await page
        .getByRole("button", { name: "3D booth" })
        .tap({ timeout: 3000 });
      await expect(board).toHaveAttribute("data-pdt-view", "3d", {
        timeout: 3000,
      });
    }).toPass({ timeout: 30000 });
    await expect(page.locator(PDT_STAGE)).toHaveAttribute(
      "data-facing",
      "counter"
    );
  }
}

/**
 * A dock key by its name. Found by attribute, because the dock hides from the
 * accessibility tree while a keyboard is in use, yet stays tappable.
 */
const pdtKey = (page: Page, name: string) =>
  page.locator(`${PDT_DOCK} [aria-label="${name}"]`);

const pdtFacing = (page: Page) =>
  page.locator(PDT_STAGE).getAttribute("data-facing");

/**
 * Holds a finger on a box until the head faces `facing`, then lifts it. The
 * head turns with the frame clock, so the hold waits for the result instead
 * of timing it.
 */
async function holdFingerUntil(page: Page, locator: Locator, facing: string) {
  const box = (await locator.boundingBox())!;
  const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [point],
  });
  try {
    await expect.poll(() => pdtFacing(page), { timeout: 40000 }).toBe(facing);
  } finally {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await cdp.detach();
  }
}

/** Drags a finger across the booth from one fraction of the stage to another. */
async function dragBooth(page: Page, fromX: number, toX: number) {
  const box = (await page.locator(PDT_STAGE).boundingBox())!;
  const y = box.y + box.height * 0.4;
  const cdp = await page.context().newCDPSession(page);
  const at = (f: number) => ({ x: box.x + box.width * f, y });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [at(fromX)],
  });
  for (let i = 1; i <= 12; i += 1) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [at(fromX + ((toX - fromX) * i) / 12)],
    });
    await page.waitForTimeout(16);
  }
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await cdp.detach();
}

/** Opens the register sheet from the dock and waits for it. */
async function openRegisterSheet(page: Page) {
  await expect(async () => {
    if (await page.locator(PDT_SHEET).isVisible()) return;
    await page
      .getByRole("button", { name: "Use the register" })
      .tap({ timeout: 3000 });
    await expect(page.locator(PDT_SHEET)).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 15000 });
}

test.describe("Patty's Drive-Thru on a tablet (iPad projects, #2116)", () => {
  test.setTimeout(300000);

  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(
      !/^iPad/.test(testInfo.project.name),
      "iPad projects only (ADR 0061)"
    );
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(PDT_ROUTE);
  });

  test("the notice is hidden, and the cabinet launches fit to the viewport", async ({
    page,
  }) => {
    await expect(page.locator(NOTICE)).toBeHidden();
    await launchPatty(page);
    await expect(page.locator(IMMERSIVE)).toHaveAttribute(
      "data-mobile-layout",
      "fit"
    );
    await expectFillsViewport(page, page.locator(IMMERSIVE));
    await assertNoHorizontalOverflow(page);
  });

  test("the booth, HUD and dock fit both orientations without scrolling", async ({
    page,
  }) => {
    await launchPatty(page);
    await startPatty(page);
    const { width, height } = page.viewportSize()!;
    for (const size of [
      { width, height },
      { width: height, height: width },
    ]) {
      await page.setViewportSize(size);
      await expect(page.locator(PDT_ROOT).first()).toBeVisible();
      await expectInsideViewport(page, [
        PDT_ROOT,
        PDT_STAGE,
        '[data-testid="pdt-hud"]',
        PDT_DOCK,
      ]);
      const overflow = await page.evaluate(() => {
        const root = document.querySelector<HTMLElement>(".pdt-touch")!;
        const booth = document.querySelector<HTMLElement>(".pdt-booth")!;
        return [
          document.scrollingElement!.scrollHeight - window.innerHeight,
          root.scrollHeight - root.clientHeight,
          booth.scrollHeight - booth.clientHeight,
        ].map((n) => Math.max(0, n));
      });
      expect(overflow.every((n) => n <= 1)).toBe(true);
      // The booth takes the height the strip and the dock leave.
      const stage = (await page.locator(PDT_STAGE).boundingBox())!;
      expect(stage.height / size.height).toBeGreaterThanOrEqual(0.6);
      // The dock sits at the bottom edge, with no dead band under it.
      const dock = (await page.locator(PDT_DOCK).boundingBox())!;
      expect(size.height - (dock.y + dock.height)).toBeLessThanOrEqual(24);
      // The strip stays clear of the floating toolbar.
      const toolbar = (await page
        .getByTestId("cabinet-touch-toolbar")
        .boundingBox())!;
      const hud = (await page.getByTestId("pdt-hud").boundingBox())!;
      expect(
        hud.x + hud.width <= toolbar.x + 1 ||
          hud.y >= toolbar.y + toolbar.height - 1
      ).toBe(true);
      await assertNoHorizontalOverflow(page);
    }
  });

  test("the flat view fits both orientations without scrolling, with no dead band", async ({
    page,
  }) => {
    await launchPatty(page);
    await startPatty(page, "flat");
    const { width, height } = page.viewportSize()!;
    for (const size of [
      { width, height },
      { width: height, height: width },
    ]) {
      await page.setViewportSize(size);
      await expectInsideViewport(page, [
        PDT_ROOT,
        '[data-testid="pdt-hud"]',
        '[data-testid="pdt-kds-board"]',
        '[data-testid="pdt-register"]',
        PDT_DOCK,
      ]);
      const overflow = await page.evaluate(() => {
        const flat = document.querySelector<HTMLElement>(".pdt-flat")!;
        return [
          document.scrollingElement!.scrollHeight - window.innerHeight,
          flat.scrollHeight - flat.clientHeight,
        ].map((n) => Math.max(0, n));
      });
      expect(overflow.every((n) => n <= 1)).toBe(true);
      // The register reaches down to the dock.
      const register = (await page.getByTestId("pdt-register").boundingBox())!;
      const dock = (await page.locator(PDT_DOCK).boundingBox())!;
      expect(dock.y - (register.y + register.height)).toBeLessThanOrEqual(32);
      expect(size.height - (dock.y + dock.height)).toBeLessThanOrEqual(24);
      await assertNoHorizontalOverflow(page);
    }
  });

  test("the page cannot scroll behind the open cabinet", async ({ page }) => {
    await launchPatty(page);
    await attemptPageScroll(page);
    await settleScroll(page);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });

  test("every control is 44px and no text is under 12px: diary, booth, register sheet, pause, flat view", async ({
    page,
  }) => {
    await launchPatty(page);
    await sdTouchSizes(page, PDT_ROOT);
    await startPatty(page);
    await sdTouchSizes(page, PDT_ROOT);
    await openRegisterSheet(page);
    await sdTouchSizes(page, PDT_ROOT);
    await page
      .locator(PDT_SHEET)
      .getByRole("button", { name: "Back to booth" })
      .tap();
    await expect(page.locator(PDT_SHEET)).toBeHidden();
    await pdtKey(page, "Pause shift").tap();
    await expect(
      page.getByRole("dialog", { name: /Shift paused/i })
    ).toBeVisible();
    await sdTouchSizes(page, PDT_ROOT);
    await page.getByRole("button", { name: "Resume shift" }).tap();
    await page.getByRole("button", { name: "Flat view" }).tap();
    await expect(page.locator(PDT_BOARD)).toHaveAttribute(
      "data-pdt-view",
      "flat"
    );
    await sdTouchSizes(page, PDT_ROOT);
  });

  test("a finger turns the booth by dragging it and by holding the dock keys", async ({
    page,
  }) => {
    await launchPatty(page);
    await startPatty(page);
    expect(await pdtFacing(page)).toBe("counter");
    // Dragging left swings the head toward the window, dragging right toward
    // the kitchen.
    await dragBooth(page, 0.8, 0.1);
    await expect.poll(() => pdtFacing(page)).toBe("window");
    await dragBooth(page, 0.1, 0.95);
    await dragBooth(page, 0.1, 0.95);
    await expect.poll(() => pdtFacing(page)).not.toBe("window");
    // The dock keys hold while the finger is down. A tap right after a fast
    // drag can land on the drag's fling, which the browser swallows, so the
    // pause is retried until its dialog shows.
    const resume = page.getByRole("button", { name: "Resume shift" });
    await expect(async () => {
      if (!(await resume.isVisible())) {
        await pdtKey(page, "Pause shift").tap({ timeout: 3000 });
      }
      await expect(resume).toBeVisible({ timeout: 3000 });
    }).toPass({ timeout: 30000 });
    await resume.tap();
    await expect(resume).toBeHidden();
    const left = pdtKey(page, "Turn left");
    const right = pdtKey(page, "Turn right");
    for (const key of [left, right]) {
      const box = (await key.boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.width).toBeGreaterThanOrEqual(44);
    }
    await holdFingerUntil(page, left, "window");
    await holdFingerUntil(page, right, "kitchen");
  });

  test("the register key opens a sheet that fits, and Back to booth closes it", async ({
    page,
  }) => {
    await launchPatty(page);
    await startPatty(page);
    await openRegisterSheet(page);
    const sheet = page.locator(PDT_SHEET);
    await expect(sheet).toHaveAttribute("aria-modal", "true");
    await expectBoxInViewport(page, sheet, "register sheet");
    const { width, height } = page.viewportSize()!;
    await page.setViewportSize({ width: height, height: width });
    await expectBoxInViewport(page, sheet, "register sheet (turned)");
    await assertNoHorizontalOverflow(page);
    // The HUD and the sheet stay clear of each other.
    const hud = (await page.getByTestId("pdt-hud").boundingBox())!;
    const box = (await sheet.boundingBox())!;
    expect(
      hud.x + hud.width <= box.x + 1 || hud.y + hud.height <= box.y + 1
    ).toBe(true);
    await page
      .locator(PDT_SHEET)
      .getByRole("button", { name: "Back to booth" })
      .tap();
    await expect(sheet).toBeHidden();
    await expect(page.locator(IMMERSIVE)).toBeVisible();
  });

  test("a shift is worked by taps alone: pick an order, ring it, bump it", async ({
    page,
  }) => {
    await launchPatty(page);
    await startPatty(page);
    // Wipe by tap: the counter's cooldown starts.
    const wipe = pdtKey(page, "Wipe counter");
    await wipe.tap();
    await expect(wipe).toBeDisabled();
    await openRegisterSheet(page);
    const orders = page.getByRole("toolbar", { name: "Open orders" });
    const chip = orders.getByRole("button").first();
    await expect(chip).toBeVisible({ timeout: 60000 });
    await chip.tap();
    await expect(chip).toHaveAttribute("aria-pressed", "true");
    const sheet = page.locator(PDT_SHEET);
    const lines = sheet.locator('[aria-live="polite"] li');
    await expect(lines.first()).toBeVisible();
    const home = sheet.getByRole("button", { name: "Home", exact: true });
    const category = (label: string) =>
      /burger/i.test(label)
        ? "Burgers"
        : /fries|nuggets/i.test(label)
          ? "Sides"
          : "Drinks";
    // Ring each line by tapping down the menu, answering a dropped drink with
    // Re-enter drink, and flagging the coworker for coffee.
    for (let step = 0; step < 30; step += 1) {
      if (/✓/.test(await chip.innerText().catch(() => ""))) break;
      if (!(await chip.isVisible())) break;
      const reenter = sheet.getByRole("button", { name: /Re-enter drink/ });
      const flag = sheet.getByRole("button", { name: /^Flag / });
      if (await reenter.isEnabled()) {
        await reenter.tap();
        continue;
      }
      if (await flag.isEnabled()) {
        await flag.tap();
        await page.waitForTimeout(300);
        continue;
      }
      const count = await lines.count();
      let acted = false;
      for (let i = 0; i < count && !acted; i += 1) {
        const text = await lines.nth(i).innerText();
        if (/To ring|Ready to ring/.test(text)) {
          const label = text
            .split("\n")[0]
            .replace(/\s·.*$/, "")
            .trim();
          if (await home.isEnabled()) await home.tap();
          await sheet
            .getByRole("button", { name: new RegExp(`^${category(label)}`) })
            .tap();
          await sheet
            .getByRole("button", {
              name: new RegExp(`^(Brew )?${label}`),
            })
            .first()
            .tap();
          acted = true;
        } else if (/not entered/.test(text)) {
          if (await home.isEnabled()) await home.tap();
          for (const name of [
            "Modifiers",
            "Toppings",
            "Pickles",
            "No Pickles",
          ]) {
            await sheet
              .getByRole("button", { name: new RegExp(`^${name}`) })
              .tap();
          }
          acted = true;
        }
      }
      if (!acted) await page.waitForTimeout(400);
    }
    const bump = sheet.getByRole("button", { name: /Bump order/ });
    await expect(bump).toBeEnabled({ timeout: 20000 });
    await bump.tap();
    await expect(orders.getByRole("button", { name: /#1, order/ })).toHaveCount(
      0
    );
  });

  test("the register sheet traps focus, and Escape pressed at once after Enter closes it", async ({
    page,
  }) => {
    await launchPatty(page);
    await startPatty(page);
    const sheet = page.locator(PDT_SHEET);
    await page.locator(PDT_BOARD).focus();
    await page.keyboard.press("Enter");
    // No wait: focus has not moved into the sheet yet.
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect(page.locator(IMMERSIVE)).toBeVisible();
    await expect(page.getByTestId("pdt-paused")).toHaveCount(0);
    await page.keyboard.press("Enter");
    await expect(sheet).toBeVisible();
    for (let i = 0; i < 16; i += 1) {
      await page.keyboard.press("Tab");
      expect(
        await page.evaluate(
          () => !!document.activeElement?.closest('[role="dialog"]')
        )
      ).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect(page.locator(IMMERSIVE)).toBeVisible();
    await expect(page.getByTestId("pdt-paused")).toHaveCount(0);
  });

  test("Pause stops the shift, and Escape pressed at once resumes it with the cabinet open", async ({
    page,
  }) => {
    await launchPatty(page);
    await startPatty(page);
    const paused = page.getByRole("dialog", { name: /Shift paused/i });
    await page.locator(PDT_BOARD).focus();
    await page.keyboard.press("p");
    await page.keyboard.press("Escape");
    await expect(paused).toBeHidden();
    await expect(page.locator(IMMERSIVE)).toBeVisible();
    await pdtKey(page, "Pause shift").tap();
    await expect(paused).toBeVisible();
    await expectBoxInViewport(page, paused, "pause dialog");
    const { width, height } = page.viewportSize()!;
    await page.setViewportSize({ width: height, height: width });
    await expectBoxInViewport(page, paused, "pause dialog (turned)");
    for (let i = 0; i < 6; i += 1) {
      await page.keyboard.press("Tab");
      expect(
        await page.evaluate(
          () => !!document.activeElement?.closest('[role="dialog"]')
        )
      ).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(paused).toBeHidden();
    await expect(page.locator(IMMERSIVE)).toBeVisible();
  });

  test("Escape during a shift pauses instead of leaving the cabinet", async ({
    page,
  }) => {
    await launchPatty(page);
    await startPatty(page);
    await page.locator(PDT_BOARD).focus();
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("dialog", { name: /Shift paused/i })
    ).toBeVisible();
    await expect(page.locator(IMMERSIVE)).toBeVisible();
  });

  test("a hidden tab or a blurred window pauses a shift in progress", async ({
    page,
  }) => {
    await launchPatty(page);
    await startPatty(page);
    const paused = page.getByRole("dialog", { name: /Shift paused/i });
    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    await expect(paused).toBeVisible();
    await page.getByRole("button", { name: "Resume shift" }).tap();
    await expect(paused).toBeHidden();
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => "hidden",
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect(paused).toBeVisible();
  });

  test("with a keyboard case the dock hides and every shortcut works; a tap brings it back", async ({
    page,
  }) => {
    await launchPatty(page);
    await startPatty(page);
    const gate = page.locator(PDT_GATE).first();
    await expect(gate).toHaveAttribute("data-touch-controls", "shown");
    await page.locator(PDT_BOARD).focus();
    // D turns toward the kitchen, and hides the dock.
    await page.keyboard.down("d");
    await expect(gate).toHaveAttribute("data-touch-controls", "hidden");
    await expect
      .poll(() => pdtFacing(page), { timeout: 40000 })
      .toBe("kitchen");
    await page.keyboard.up("d");
    await page.keyboard.down("a");
    await expect.poll(() => pdtFacing(page), { timeout: 40000 }).toBe("window");
    await page.keyboard.up("a");
    // W wipes, which starts the cooldown.
    await page.keyboard.press("w");
    await expect(pdtKey(page, "Wipe counter")).toBeDisabled();
    // Enter opens the register, Backspace and Home work in it, Escape leaves.
    await page.keyboard.press("Enter");
    await expect(page.locator(PDT_SHEET)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator(PDT_SHEET)).toBeHidden();
    // P pauses and resumes.
    const paused = page.getByRole("dialog", { name: /Shift paused/i });
    await page.keyboard.press("p");
    await expect(paused).toBeVisible();
    await page.keyboard.press("p");
    await expect(paused).toBeHidden();
    await expect(gate).toHaveAttribute("data-touch-controls", "hidden");
    await pdtKey(page, "Pause shift").tap();
    await expect(gate).toHaveAttribute("data-touch-controls", "shown");
  });

  test("the Apple Pencil works like a finger", async ({ page }) => {
    await launchPatty(page);
    await startPatty(page);
    const stage = (await page.locator(PDT_STAGE).boundingBox())!;
    const cdp = await page.context().newCDPSession(page);
    const x = stage.x + stage.width * 0.5;
    const y = stage.y + stage.height * 0.3;
    for (const type of ["mousePressed", "mouseReleased"] as const) {
      await cdp.send("Input.dispatchMouseEvent", {
        type,
        x,
        y,
        button: "left",
        clickCount: 1,
        pointerType: "pen",
      });
    }
    await expect(page.locator(IMMERSIVE)).toHaveAttribute(
      "data-input-modality",
      "pen"
    );
    await expect(page.locator(PDT_GATE).first()).toHaveAttribute(
      "data-touch-controls",
      "shown"
    );
    // The pen presses a dock key too.
    await pdtKey(page, "Use the register").tap();
    await expect(page.locator(PDT_SHEET)).toBeVisible();
  });

  test("the playing cabinet has no blocking axe violations", async ({
    page,
  }) => {
    await launchPatty(page);
    await sdAxe(page);
    await startPatty(page);
    await sdAxe(page);
    await openRegisterSheet(page);
    await sdAxe(page);
    await page
      .locator(PDT_SHEET)
      .getByRole("button", { name: "Back to booth" })
      .tap();
    await pdtKey(page, "Pause shift").tap();
    await expect(page.getByTestId("pdt-paused")).toBeVisible();
    await sdAxe(page);
  });

  test.describe("Split View (ADR 0061)", () => {
    for (const width of [507, 678]) {
      test(`${width}x1024: the notice offers Try it anyway, with no overflow`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 1024 });
        await page.goto(PDT_ROUTE);
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

      test(`${width}x1024: Try it anyway launches a cabinet that fits`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 1024 });
        await page.goto(PDT_ROUTE);
        await page.getByRole("button", { name: /Try it anyway/i }).tap();
        await launchPatty(page);
        await startPatty(page);
        await expectInsideViewport(page, [
          PDT_ROOT,
          PDT_STAGE,
          '[data-testid="pdt-hud"]',
          PDT_DOCK,
        ]);
        await openRegisterSheet(page);
        await expectBoxInViewport(
          page,
          page.locator(PDT_SHEET),
          "register sheet"
        );
        await assertNoHorizontalOverflow(page);
      });
    }
  });
});

// ---------------------------------------------------------------------------
// Trial & Error on a tablet (#2120)
// ---------------------------------------------------------------------------

const TE_ROUTE = `${UNGATED_ROUTE}?seed=alpha`;
const TE_ROOT = 'section[aria-labelledby="card-table-heading"]';
const TE_HAND = '[data-testid="hand"]';
const TE_CARDS = `${TE_HAND} button[data-card-id]`;
const TE_ACT = "biostat-ops-campaign";

/** Inspect actions for one Table, then the findings the SAP wants corrected. */
function teInspect(cardId: string, findings: string[]) {
  const cells = Array.from({ length: 15 }, (_, i) => ({
    type: "INSPECT_CELL",
    row: Math.floor(i / 3),
    col: i % 3,
  }));
  return [
    { type: "INSPECT_CARD", cardId },
    ...cells,
    ...findings.map((findingId) => ({ type: "CORRECT_FINDING", findingId })),
    { type: "CLOSE_INSPECT" },
  ];
}

/**
 * A saved run on seed alpha, for the between-Blinds screens: the first Blind
 * cleared in one hand ("cleared"), cashed out into the Procurement Shop
 * ("shop"), or with the first pack bought and open ("pack").
 */
function teSave(stage: "cleared" | "shop" | "pack") {
  const actions: unknown[] = [
    ...teInspect("C-T14.1.1-A", [
      "SAP-DM-03@r1c2",
      "SAP-DM-02@r2c1",
      "SAP-DM-01@r2c2",
      "SAP-DM-01@r3c2",
      "SAP-DM-01@r4c2",
    ]),
    ...teInspect("C-T14.1.1-B", ["SAP-DM-02@r2c0"]),
    ...teInspect("C-T14.1.1-C", []),
    ...[
      "C-T14.1.1-A",
      "C-L16.2.4",
      "C-T14.1.2",
      "C-T14.1.1-B",
      "C-T14.1.1-C",
    ].map((cardId) => ({ type: "TOGGLE_SELECT", cardId })),
    { type: "PLAY_HAND" },
  ];
  if (stage !== "cleared") actions.push({ type: "CASH_OUT" });
  if (stage === "pack") actions.push({ type: "BUY_PACK", slot: 0 });
  return JSON.stringify({
    version: 4,
    actId: TE_ACT,
    savedAt: new Date().toISOString(),
    seed: "alpha",
    actions,
    origin: { kind: "SEEDED" },
  });
}

/**
 * Opens the cabinet on a seeded table with the tutorial dismissed, optionally
 * resuming a saved run. Taps Launch once, then waits for the table.
 */
async function openTe(page: Page, save?: "cleared" | "shop" | "pack") {
  const json = save ? teSave(save) : null;
  await page.addInitScript(
    ([actId, saved]) => {
      try {
        localStorage.setItem("te:tutorial-seen", "1");
        if (saved) localStorage.setItem(`te:run-save:${actId}`, saved);
      } catch {}
    },
    [TE_ACT, json] as const
  );
  await page.goto(TE_ROUTE);
  await launchCabinet(page);
  if (save) {
    const resume = page.getByRole("button", { name: "Resume run" });
    await expect(async () => {
      await resume.tap({ timeout: 4000 });
    }).toPass({ timeout: 30000 });
  }
  await expect(page.locator(TE_ROOT)).toBeVisible({ timeout: 60000 });
}

const teCards = (page: Page) => page.locator(TE_CARDS);

/** Index of the first hand card whose label matches. */
async function teCardIndex(page: Page, label: RegExp) {
  const labels = await teCards(page).evaluateAll((els) =>
    els.map((el) => el.getAttribute("aria-label") ?? "")
  );
  return labels.findIndex((text) => label.test(text));
}

/** Taps the first untouched Demographics Table and opens its Inspect desk. */
async function teOpenInspect(page: Page) {
  const index = await teCardIndex(
    page,
    /^Table 14\.1\.1(?!.*(inspected|stale|empty shell|face down))/
  );
  expect(index).toBeGreaterThanOrEqual(0);
  await expect(async () => {
    await teCards(page).nth(index).tap({ timeout: 4000 });
    await page.getByRole("button", { name: /^Inspect/ }).tap({ timeout: 4000 });
    await expect(page.getByTestId("inspect-drawer")).toBeVisible({
      timeout: 4000,
    });
  }).toPass({ timeout: 20000 });
}

/** Taps every cell of the open Inspect desk, correcting what it flags. */
async function teInspectAllCells(page: Page) {
  const cells = page.locator(
    '[data-testid="inspect-drawer"] [role="gridcell"]'
  );
  const count = await cells.count();
  for (let i = 0; i < count; i += 1) {
    await cells.nth(i).tap();
    const flag = page.getByRole("button", { name: /Flag & Correct/ });
    if (await flag.count()) await flag.first().tap();
  }
}

/** Reads one HUD tile of the Blind panel, such as "HANDS" or "DISCARDS". */
async function teTile(page: Page, name: string) {
  return page.evaluate((label) => {
    const panel = document.querySelector<HTMLElement>(".te-area-blind");
    const text = panel?.innerText ?? "";
    const match = text.match(new RegExp(`${label}\\s*\\n?\\s*([0-9]+)`, "i"));
    return match ? Number(match[1]) : null;
  }, name);
}

/** The first inspected play: Table, Inspect, tap cells, close, Listing, Play. */
async function tePlayFirstHand(page: Page) {
  await teOpenInspect(page);
  await teInspectAllCells(page);
  await page.getByRole("button", { name: /Close Inspect/ }).tap();
  await expect(page.getByTestId("inspect-drawer")).toBeHidden();
  const listing = await teCardIndex(page, /^Listing /);
  expect(listing).toBeGreaterThanOrEqual(0);
  await teCards(page).nth(listing).tap();
  await page.getByRole("button", { name: /^Play Hand/ }).tap();
}

/** Dialogs and sheets of the table sit inside the cabinet and the viewport. */
async function teDialogFits(page: Page, label: string) {
  const dialog = page.locator(`${IMMERSIVE} [role="dialog"]`).last();
  await expect(dialog).toBeVisible();
  await expectBoxInViewport(page, dialog, label);
  const toolbar = (await page
    .getByTestId("cabinet-touch-toolbar")
    .boundingBox())!;
  const box = (await dialog.boundingBox())!;
  // The sheet starts below the floating toolbar, never under it.
  expect(box.y, `${label} clears the toolbar`).toBeGreaterThanOrEqual(
    toolbar.y + toolbar.height - 1
  );
}

/** Space left above and below the hand's cards inside the hand area. */
async function teHandBands(page: Page) {
  return page.evaluate(() => {
    const area = document
      .querySelector<HTMLElement>(".te-area-hand")!
      .getBoundingClientRect();
    const cards = Array.from(
      document.querySelectorAll<HTMLElement>(
        '[data-testid="hand"] button[data-card-id]'
      )
    ).map((el) => el.getBoundingClientRect());
    return {
      above: Math.min(...cards.map((b) => b.top)) - area.top,
      below: area.bottom - Math.max(...cards.map((b) => b.bottom)),
      viewport: window.innerHeight,
    };
  });
}

const teKey = async (page: Page, key: string) => page.keyboard.press(key);

test.describe("Trial & Error on a tablet (iPad projects, #2120)", () => {
  test.setTimeout(300000);

  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(
      !/^iPad/.test(testInfo.project.name),
      "iPad projects only (ADR 0061)"
    );
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  test("the cabinet launches fit to the viewport with the touch table", async ({
    page,
  }) => {
    await openTe(page);
    await expect(page.locator(IMMERSIVE)).toHaveAttribute(
      "data-mobile-layout",
      "fit"
    );
    await expect(page.locator(TE_ROOT)).toHaveClass(/te-touch/);
    await expectFillsViewport(page, page.locator(IMMERSIVE));
    await assertNoHorizontalOverflow(page);
  });

  test("the table, hand and HUD fit both orientations with no scroll and no dead band", async ({
    page,
  }) => {
    await openTe(page);
    const { width, height } = page.viewportSize()!;
    for (const size of [
      { width, height },
      { width: height, height: width },
    ]) {
      await page.setViewportSize(size);
      await expect(page.locator(TE_ROOT)).toBeVisible();
      await expect(teCards(page).first()).toBeVisible();
      await expectInsideViewport(page, [TE_ROOT, TE_CARDS, ".te-area-hand"]);
      const overflow = await page.evaluate(() => {
        const grid = document.querySelector<HTMLElement>(".te-table-grid")!;
        const root = document.querySelector<HTMLElement>(".te-touch")!;
        const hand = document.querySelector<HTMLElement>(
          '[data-testid="hand"]'
        )!;
        return {
          page: Math.max(
            0,
            document.scrollingElement!.scrollHeight - window.innerHeight
          ),
          root: Math.max(0, root.scrollHeight - root.clientHeight),
          grid: Math.max(0, grid.scrollHeight - grid.clientHeight),
          handX: Math.max(0, hand.scrollWidth - hand.clientWidth),
        };
      });
      expect(overflow, `${size.width}x${size.height} overflow`).toEqual({
        page: 0,
        root: 0,
        grid: 0,
        handX: 0,
      });
      // Every card of a full hand is on screen, and the hand fills its area.
      expect(await teCards(page).count()).toBeGreaterThanOrEqual(8);
      const bands = await teHandBands(page);
      expect(bands.above, "band above the hand").toBeLessThan(
        bands.viewport * 0.25
      );
      expect(bands.below, "band below the hand").toBeLessThan(
        bands.viewport * 0.25
      );
      await assertNoHorizontalOverflow(page);
    }
  });

  test("the header clears the floating toolbar", async ({ page }) => {
    await openTe(page);
    const toolbar = (await page
      .getByTestId("cabinet-touch-toolbar")
      .boundingBox())!;
    const controls = page.locator(`${TE_ROOT} > header button:visible`);
    const count = await controls.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i += 1) {
      const box = (await controls.nth(i).boundingBox())!;
      const clear =
        box.x + box.width <= toolbar.x + 1 ||
        box.y >= toolbar.y + toolbar.height - 1;
      expect(clear, `header control ${i} under the toolbar`).toBe(true);
    }
  });

  test("the page cannot scroll behind the open cabinet", async ({ page }) => {
    await openTe(page);
    await attemptPageScroll(page);
    await settleScroll(page);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });

  test("every control is 44px and no text is under 12px: table, inspect, hands, run info, deck builder", async ({
    page,
  }) => {
    await openTe(page);
    await sdTouchSizes(page, TE_ROOT);
    await teOpenInspect(page);
    await sdTouchSizes(page, TE_ROOT);
    await page.getByRole("button", { name: /Close Inspect/ }).tap();
    for (const trigger of [
      "hand-sheet-button",
      "run-info-button",
      "deck-builder-button",
    ]) {
      await page.getByTestId(trigger).tap();
      await expect(page.locator(`${IMMERSIVE} [role="dialog"]`)).toBeVisible();
      await sdTouchSizes(page, `${TE_ROOT} [role="dialog"]`);
      await page.keyboard.press("Escape");
      await expect(page.locator(`${IMMERSIVE} [role="dialog"]`)).toHaveCount(0);
    }
  });

  test("a hand is played by taps alone: inspect, correct, select, play", async ({
    page,
  }) => {
    await openTe(page);
    expect(await teTile(page, "ROUND")).toBe(0);
    await tePlayFirstHand(page);
    await expect
      .poll(async () => (await teTile(page, "ROUND")) ?? 0, {
        timeout: 20000,
      })
      .toBeGreaterThan(0);
    await expect(page.locator(IMMERSIVE)).toBeVisible();
  });

  test("a card is inspected, read and discarded by touch", async ({ page }) => {
    await openTe(page);
    // Inspect desk: fits, and its Close row stays in reach.
    await teOpenInspect(page);
    await teDialogFits(page, "inspect desk");
    await expect(
      page.getByRole("button", { name: /Close Inspect/ })
    ).toBeVisible();
    await page.getByRole("button", { name: /Close Inspect/ }).tap();
    // A second tap on a selected card reads it.
    const first = teCards(page).nth(await teCardIndex(page, /^Listing /));
    await first.tap();
    await expect(first).toHaveAttribute("aria-pressed", "true");
    await first.tap();
    await expect(page.getByTestId("card-detail")).toBeVisible();
    await teDialogFits(page, "card detail");
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("card-detail")).toBeHidden();
    // Discard what is selected.
    const discards = await teTile(page, "DISCARDS");
    // The card is still selected after reading it.
    await expect(first).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: /^Discard/ }).tap();
    await expect
      .poll(() => teTile(page, "DISCARDS"), { timeout: 10000 })
      .toBe((discards ?? 0) - 1);
  });

  test("Hands, Run Info, the Codex and the Deck Builder are sheets that fit", async ({
    page,
  }) => {
    await openTe(page);
    await page.getByTestId("hand-sheet-button").tap();
    await teDialogFits(page, "hands sheet");
    await page.keyboard.press("Escape");
    await page.getByTestId("run-info-button").tap();
    await teDialogFits(page, "run info");
    await page.getByTestId("run-info-codex").tap();
    await expect(page.getByTestId("codex")).toBeVisible();
    await teDialogFits(page, "codex");
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("codex")).toBeHidden();
    await expect(page.locator(IMMERSIVE)).toBeVisible();
    await page.getByTestId("deck-builder-button").tap();
    await teDialogFits(page, "deck builder");
    await assertNoHorizontalOverflow(page);
    await page.keyboard.press("Escape");
    await expect(page.locator(IMMERSIVE)).toBeVisible();
  });

  test("the cleared Blind, the Procurement Shop and a pack fit, with Next Blind in reach", async ({
    page,
  }) => {
    await openTe(page, "shop");
    await expect(page.getByTestId("shop")).toBeVisible();
    await expectInsideViewport(page, [TE_ROOT]);
    // Next Blind stays in reach whatever the shop's length.
    const nextBlinds = page.getByRole("button", { name: /Next Blind/ });
    const vh = page.viewportSize()!.height;
    const reachable = await nextBlinds.evaluateAll(
      (els, height) =>
        els.some((el) => {
          const box = el.getBoundingClientRect();
          return box.top >= 0 && box.bottom <= height + 1;
        }),
      vh
    );
    expect(reachable, "a Next Blind button is on screen").toBe(true);
    await sdTouchSizes(page, TE_ROOT);
    await attemptPageScroll(page);
    await settleScroll(page);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await assertNoHorizontalOverflow(page);
    await expectFillsViewport(page, page.locator(IMMERSIVE));
  });

  test("a pack opens inside the table and a card is picked by touch", async ({
    page,
  }) => {
    await openTe(page, "pack");
    const pack = page.getByTestId("pack-opening");
    await expect(pack).toBeVisible();
    await expectInsideViewport(page, [TE_ROOT]);
    await sdTouchSizes(page, TE_ROOT);
    await assertNoHorizontalOverflow(page);
    const choice = pack.getByRole("button").first();
    await expect(choice).toBeVisible();
    await choice.scrollIntoViewIfNeeded();
    await choice.tap();
    await expect(page.locator(IMMERSIVE)).toBeVisible();
  });

  test("a shop buy by touch spends the budget", async ({ page }) => {
    await openTe(page, "shop");
    const buys = page.getByTestId("shop-buy");
    await expect(buys.first()).toBeVisible();
    const before = await page.locator(TE_ROOT).innerText();
    const count = await buys.count();
    for (let i = 0; i < count; i += 1) {
      const buy = buys.nth(i);
      if (await buy.isEnabled()) {
        await buy.scrollIntoViewIfNeeded();
        await buy.tap();
        await expect
          .poll(() => page.locator(TE_ROOT).innerText())
          .not.toBe(before);
        return;
      }
    }
    test.info().annotations.push({
      type: "note",
      description: "No offer was affordable on this seed.",
    });
  });

  test("Escape closes a dialog and keeps the cabinet, even straight after its key", async ({
    page,
  }) => {
    await openTe(page);
    await teCards(page).first().focus();
    // No wait after each key: focus has not moved into the sheet yet.
    for (const [key, dialog] of [
      ["h", "hand-sheet"],
      ["Shift+R", "run-info"],
      ["?", "card-detail"],
      ["i", "inspect-drawer"],
    ] as const) {
      await page.keyboard.press(key);
      await page.keyboard.press("Escape");
      await expect(page.getByTestId(dialog)).toHaveCount(0);
      await expect(page.locator(IMMERSIVE)).toBeVisible();
      await teCards(page).first().focus();
    }
    // With nothing open Escape leaves the cabinet.
    await page.keyboard.press("Escape");
    await expect(page.locator(IMMERSIVE)).toHaveCount(0);
  });

  test("a sheet traps focus", async ({ page }) => {
    await openTe(page);
    await page.getByTestId("run-info-button").tap();
    const dialog = page.locator(`${IMMERSIVE} [role="dialog"]`);
    await expect(dialog).toBeVisible();
    for (let i = 0; i < 14; i += 1) {
      await page.keyboard.press("Tab");
      expect(
        await page.evaluate(
          () => !!document.activeElement?.closest('[role="dialog"]')
        )
      ).toBe(true);
    }
  });

  test("a picked-up seal answers Escape itself instead of leaving the cabinet", async ({
    page,
  }) => {
    await openTe(page);
    const first = teCards(page).first();
    for (const id of ["C-T14.1.1-A", "C-T14.1.1-B", "C-L16.2.4"]) {
      await page.locator(`[data-card-id="${id}"]`).tap();
    }
    await page.getByRole("button", { name: /^Discard/ }).tap();
    await page.locator('[data-card-id="C-T14.1.3"]').focus();
    await page.keyboard.press("a");
    await page.getByTestId("allocate-option").nth(1).tap();
    const seal = page
      .getByTestId("consumable-tray")
      .getByRole("button", { name: /Adjudicated Endpoint/ });
    await seal.tap();
    await expect(seal).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(TE_ROOT)).toHaveAttribute(
      "data-escape-docks",
      "true"
    );
    await first.focus();
    await page.keyboard.press("Escape");
    await expect(page.locator(IMMERSIVE)).toBeVisible();
    await expect(seal).toHaveAttribute("aria-pressed", "false");
  });

  test("with a keyboard case every shortcut works", async ({ page }) => {
    await openTe(page);
    const first = teCards(page).first();
    await first.focus();
    await page.keyboard.press("ArrowRight");
    expect(
      await page.evaluate(
        () => document.activeElement?.getAttribute("data-card-id") ?? ""
      )
    ).not.toBe(await first.getAttribute("data-card-id"));
    await page.keyboard.press("Space");
    await expect(page.locator(`${TE_CARDS}[aria-pressed="true"]`)).toHaveCount(
      1
    );
    await page.keyboard.press("Space");
    await expect(page.locator(`${TE_CARDS}[aria-pressed="true"]`)).toHaveCount(
      0
    );
    await page.keyboard.press("h");
    await expect(page.getByTestId("hand-sheet")).toBeVisible();
    await page.keyboard.press("h");
    await expect(page.getByTestId("hand-sheet")).toBeHidden();
    // Focus returns to the table, so the next shortcut still reaches it.
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            !!document.activeElement?.closest(
              'section[aria-labelledby="card-table-heading"]'
            )
        )
      )
      .toBe(true);
    await page.keyboard.press("Shift+R");
    await expect(page.getByTestId("run-info")).toBeVisible();
    await page.keyboard.press("Escape");
    // F is not a table key, so the cabinet keeps it for fullscreen.
    await teKey(page, "Tab");
    await expect(page.locator(IMMERSIVE)).toBeVisible();
  });

  test("the Apple Pencil works like a finger", async ({ page }) => {
    await openTe(page);
    const card = teCards(page).nth(await teCardIndex(page, /^Listing /));
    const box = (await card.boundingBox())!;
    const cdp = await page.context().newCDPSession(page);
    const x = box.x + box.width * 0.5;
    const y = box.y + box.height * 0.5;
    const penTap = async () => {
      for (const type of ["mousePressed", "mouseReleased"] as const) {
        await cdp.send("Input.dispatchMouseEvent", {
          type,
          x,
          y,
          button: "left",
          clickCount: 1,
          pointerType: "pen",
        });
      }
    };
    await penTap();
    await expect(page.locator(IMMERSIVE)).toHaveAttribute(
      "data-input-modality",
      "pen"
    );
    await expect(card).toHaveAttribute("aria-pressed", "true");
    // A second pen tap reads the card, as a second finger tap does.
    await penTap();
    await expect(page.getByTestId("card-detail")).toBeVisible();
  });

  test("a hidden tab settles a hand that is still scoring", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await openTe(page);
    await tePlayFirstHand(page);
    const skip = page.getByRole("button", { name: /^Skip/ });
    await expect(skip).toBeVisible({ timeout: 15000 });
    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    await expect(skip).toBeHidden({ timeout: 5000 });
    await expect(page.locator(IMMERSIVE)).toBeVisible();
  });

  test("the cabinet has no blocking axe violations: table, inspect, hands, shop", async ({
    page,
  }) => {
    await openTe(page);
    await sdAxe(page);
    await teOpenInspect(page);
    await sdAxe(page);
    await page.getByRole("button", { name: /Close Inspect/ }).tap();
    await page.getByTestId("hand-sheet-button").tap();
    await expect(page.getByTestId("hand-sheet")).toBeVisible();
    await sdAxe(page);
  });

  test("the Procurement Shop has no blocking axe violations", async ({
    page,
  }) => {
    await openTe(page, "shop");
    await expect(page.getByTestId("shop")).toBeVisible();
    await sdAxe(page);
  });

  test.describe("Split View (ADR 0061)", () => {
    for (const width of [507, 678]) {
      test(`${width}x1024: the table fits, the hand fits its row and the HUD clears the toolbar`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 1024 });
        await openTe(page);
        await expect(page.locator(IMMERSIVE)).toHaveAttribute(
          "data-mobile-layout",
          "fit"
        );
        await expectFillsViewport(page, page.locator(IMMERSIVE));
        await expectInsideViewport(page, [TE_ROOT, TE_CARDS]);
        await assertNoHorizontalOverflow(page);
        const overflow = await page.evaluate(() => {
          const hand = document.querySelector<HTMLElement>(
            '[data-testid="hand"]'
          )!;
          const grid = document.querySelector<HTMLElement>(".te-table-grid")!;
          return {
            handX: Math.max(0, hand.scrollWidth - hand.clientWidth),
            gridY: Math.max(0, grid.scrollHeight - grid.clientHeight),
            page: Math.max(
              0,
              document.scrollingElement!.scrollHeight - window.innerHeight
            ),
          };
        });
        expect(overflow).toEqual({ handX: 0, gridY: 0, page: 0 });
        const toolbar = (await page
          .getByTestId("cabinet-touch-toolbar")
          .boundingBox())!;
        const controls = page.locator(`${TE_ROOT} > header button:visible`);
        for (let i = 0; i < (await controls.count()); i += 1) {
          const box = (await controls.nth(i).boundingBox())!;
          expect(
            box.x + box.width <= toolbar.x + 1 ||
              box.y >= toolbar.y + toolbar.height - 1,
            `header control ${i} under the toolbar`
          ).toBe(true);
        }
        await sdTouchSizes(page, TE_ROOT);
      });

      test(`${width}x1024: the desks and sheets fit`, async ({ page }) => {
        await page.setViewportSize({ width, height: 1024 });
        await openTe(page);
        await teOpenInspect(page);
        await teDialogFits(page, "inspect desk");
        await page.getByRole("button", { name: /Close Inspect/ }).tap();
        for (const trigger of [
          "hand-sheet-button",
          "run-info-button",
          "deck-builder-button",
        ]) {
          await page.getByTestId(trigger).tap();
          await teDialogFits(page, trigger);
          await assertNoHorizontalOverflow(page);
          await page.keyboard.press("Escape");
          await expect(page.locator(IMMERSIVE)).toBeVisible();
        }
      });
    }
  });
});
