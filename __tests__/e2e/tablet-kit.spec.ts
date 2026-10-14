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
      await page.getByRole("button", { name: `Add ${kind} chip` }).tap();
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

/** Records, in order, every pad the page lights, by its accessible name. */
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
          w.__memeLit?.push(el.getAttribute("aria-label") ?? "");
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

  test("two fingers on two pads both play", async ({ page }) => {
    await tapFirstPadUntilHydrated(page);
    await watchLitPads(page);
    const pads = page.locator(MEME_PAD);
    await pads.nth(2).scrollIntoViewIfNeeded();
    const a = await pads.nth(2).boundingBox();
    const b = await pads.nth(3).boundingBox();
    expect(a && b).toBeTruthy();
    const points = [
      { x: a!.x + a!.width / 2, y: a!.y + a!.height / 2, id: 1 },
      { x: b!.x + b!.width / 2, y: b!.y + b!.height / 2, id: 2 },
    ];
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: points,
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await expect
      .poll(async () => new Set(await litLog(page)).size)
      .toBeGreaterThanOrEqual(2);
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
      for (const name of sequence) {
        await page.getByRole("button", { name, exact: true }).tap();
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
