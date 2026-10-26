import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import path from "node:path";
import {
  assertNoHorizontalOverflow,
  assertStageCoverage,
  assertTextFloor,
  assertThumbZone,
  assertTouchTargets,
  axeCabinet,
  captureMatrix,
  expectTapsOnlyFirstScore,
  interruptAndResume,
  launchCabinet as launchGame,
} from "./mobile-harness";
import {
  EDGE_KEEP_OUT_PX,
  inEdgeKeepOut,
} from "../../components/arcade/mobile/edge-keep-out";

// The immersive touch cabinet (ADR 0061) runs on coarse-pointer projects only.
// Trial & Error is the ungated cabinet game; Meme Vault does not use a cabinet.
const CABINET_ROUTE = "/arcade/trial-and-error";
const IMMERSIVE = '[data-arcade-cabinet][data-immersive="true"]';
const SHOT_DIR = path.join(process.cwd(), "test-results", "mobile-kit");
// Blocking impacts for the cabinet scan (AGENTS invariant 10).
const BLOCKING = new Set(["critical", "serious", "moderate"]);

/** Taps Launch until the cabinet is immersive. Retries only while Launch is up. */
async function launchCabinet(page: Page) {
  // A cold game chunk on a dev server can take most of a minute to compile.
  const launch = page.getByRole("button", { name: /Launch Cabinet/i });
  await expect(async () => {
    if ((await launch.count()) > 0) {
      await launch.tap({ timeout: 2000 });
    }
    await expect(page.locator(IMMERSIVE)).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 90000 });
}

test.describe("Mobile arcade kit: immersive touch cabinet", () => {
  // A cold game chunk on a dev server can take most of a minute to compile.
  test.setTimeout(150000);

  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(!testInfo.project.use.hasTouch, "touch projects only");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(CABINET_ROUTE);
  });

  test("launch fills the viewport, has no overflow, and exit restores the page", async ({
    page,
  }) => {
    const viewport = page.viewportSize();
    expect(viewport).not.toBeNull();

    await launchCabinet(page);

    const cabinet = page.locator(IMMERSIVE);
    await expect(cabinet).toHaveAttribute("data-fullscreen", "true");
    const box = await cabinet.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeCloseTo(0, 0);
    expect(box!.y).toBeCloseTo(0, 0);
    expect(box!.width).toBeCloseTo(viewport!.width, 0);
    expect(box!.height).toBeCloseTo(viewport!.height, 0);

    // The page underneath is scroll-locked while the cabinet is open.
    const lockedOverflow = await page.evaluate(
      () => document.body.style.overflow
    );
    expect(lockedOverflow).toBe("hidden");

    await assertNoHorizontalOverflow(page);

    // Trial & Error has not had its mobile pass, so it keeps the scroll
    // layout: the cabinet pans but nothing in it zooms.
    expect(await cabinet.getAttribute("data-mobile-layout")).toBe("scroll");
    const rootTouch = await cabinet.evaluate(
      (el) => getComputedStyle(el).touchAction
    );
    expect(rootTouch).toBe("pan-x pan-y");

    // Captures are named by state. The cabinet latches immersive at launch, so
    // it stays immersive when the viewport grows past the phone breakpoint
    // (ADR 0061).
    const shots = await captureMatrix(page, "trial-and-error", SHOT_DIR);
    for (const shot of shots) {
      expect(shot.immersive, `immersive at ${shot.width}px`).toBe(true);
    }

    // Exit through the cabinet's Power control.
    await page
      .locator(`${IMMERSIVE} button[title="Reset / Power Off Cabinet"]`)
      .tap();
    await expect(page.locator("[data-immersive]")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /Launch Cabinet/i })
    ).toBeVisible();

    const restoredOverflow = await page.evaluate(
      () => document.body.style.overflow
    );
    expect(restoredOverflow).not.toBe("hidden");
    await assertNoHorizontalOverflow(page);
  });

  test("the touch toolbar is one row of icon keys, top-right, inside the safe area", async ({
    page,
  }) => {
    await launchCabinet(page);
    const viewport = page.viewportSize()!;
    const toolbar = page.getByTestId("cabinet-touch-toolbar");
    await expect(toolbar).toBeVisible();

    const box = await toolbar.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
    expect(box!.y).toBeLessThan(viewport.height / 3);

    // Icon-only keys at the touch floor, each with an accessible name.
    const keys = toolbar.locator("button");
    const count = await keys.count();
    expect(count).toBeGreaterThanOrEqual(2);
    for (let i = 0; i < count; i++) {
      const key = keys.nth(i);
      await expect(key).toHaveAttribute("aria-label", /.+/);
      expect((await key.textContent())?.trim()).toBe("");
      const keyBox = await key.boundingBox();
      expect(keyBox!.width).toBeGreaterThanOrEqual(43.5);
      expect(keyBox!.height).toBeGreaterThanOrEqual(43.5);
    }

    // Nothing the player can press sits under the toolbar at the top of the
    // stage. Trial & Error runs the scroll layout here, so this is its top-right.
    const overlaps = await page.evaluate(() => {
      const bar = document
        .querySelector('[data-testid="cabinet-touch-toolbar"]')
        ?.getBoundingClientRect();
      if (!bar) return ["no toolbar"];
      const hits: string[] = [];
      const controls = document.querySelectorAll<HTMLElement>(
        '[data-arcade-cabinet] button, [data-arcade-cabinet] a[href], [data-arcade-cabinet] [role="button"], [data-arcade-cabinet] [role="tab"]'
      );
      for (const el of Array.from(controls)) {
        if (el.closest('[data-testid="cabinet-touch-toolbar"]')) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (
          r.right > bar.left &&
          r.left < bar.right &&
          r.bottom > bar.top &&
          r.top < bar.bottom
        ) {
          hits.push(
            el.getAttribute("aria-label") || el.textContent || el.tagName
          );
        }
      }
      return hits;
    });
    expect(overlaps, "controls under the touch toolbar").toEqual([]);

    // The cabinet publishes the toolbar's width, so a game HUD can pad for it.
    // The inset is a calc() with the safe area in it, so read it through a
    // probe that resolves it to pixels.
    const inset = await page.locator(IMMERSIVE).evaluate((el) => {
      const probe = document.createElement("div");
      probe.style.paddingRight = "var(--cabinet-toolbar-inset)";
      el.appendChild(probe);
      const px = parseFloat(getComputedStyle(probe).paddingRight);
      probe.remove();
      return px;
    });
    const bar = await page.getByTestId("cabinet-touch-toolbar").boundingBox();
    expect(bar).not.toBeNull();
    expect(inset).toBeGreaterThanOrEqual(bar!.width);
  });

  test("a press inside the immersive cabinet reaches its control", async ({
    page,
  }) => {
    await launchCabinet(page);

    await page.locator(`${IMMERSIVE} button[title="Setup"]`).tap();
    await page
      .locator(`${IMMERSIVE} button[title="Pre-Game Setup Wizard"]`)
      .tap();
    const skip = page.getByRole("button", { name: "Skip Setup" });
    await expect(skip).toBeVisible();

    await skip.tap();
    await expect(skip).toHaveCount(0);
    await expect(page.locator(IMMERSIVE)).toBeVisible();
  });

  test("Setup opens one Setup sheet with the device settings, clean under axe (#2923)", async ({
    page,
  }) => {
    await launchCabinet(page);
    const setupKey = page.locator(`${IMMERSIVE} button[title="Setup"]`);
    await setupKey.tap();
    const sheet = page.getByRole("dialog", { name: "Setup" });
    await expect(sheet).toBeVisible();
    await expect(
      sheet.getByRole("group", { name: "Dominant hand" })
    ).toBeVisible();
    // A phone window is narrower than a tablet or desktop view needs.
    const layout = sheet.getByRole("group", { name: "Layout" });
    await expect(layout.getByRole("button", { name: "Phone" })).toBeEnabled();
    await expect(
      layout.getByRole("button", { name: "Desktop" })
    ).toBeDisabled();

    const results = await new AxeBuilder({ page })
      .include('[data-testid="cabinet-setup-sheet"]')
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(
      results.violations
        .filter((v) => BLOCKING.has(v.impact ?? ""))
        .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)
    ).toEqual([]);

    await sheet.getByRole("button", { name: "Large" }).tap();
    await expect(sheet.getByRole("button", { name: "Large" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await page.keyboard.press("Escape");
    await expect(sheet).toHaveCount(0);
    // A tap never focuses the toolbar (its keys keep focus on the game), so
    // focus returns to where it was before Setup: inside the cabinet.
    await expect
      .poll(() =>
        page.evaluate(
          (selector) =>
            !!document.activeElement &&
            document.activeElement !== document.body &&
            !!document.querySelector(selector)?.contains(document.activeElement),
          IMMERSIVE
        )
      )
      .toBe(true);
  });

  test("a scroll-layout stage reaches all of its content at 320x568", async ({
    page,
  }) => {
    const viewport = page.viewportSize();
    test.skip(viewport?.width !== 320, "320px floor project only");

    await launchCabinet(page);

    const reach = await page
      .locator(`${IMMERSIVE} .arcade-cabinet-stage`)
      .evaluate((el) => {
        el.scrollTop = el.scrollHeight;
        return {
          bottom: el.scrollTop + el.clientHeight,
          scrollHeight: el.scrollHeight,
        };
      });
    expect(reach.bottom).toBeGreaterThanOrEqual(reach.scrollHeight - 1);
  });

  test("the immersive cabinet has no blocking axe violations", async ({
    page,
  }) => {
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

// Phone Back and browser Back (#2545): one history entry per launch, and Back
// walks the Escape ladder. Trial & Error has no views yet, so it takes the
// path every cabinet without views takes: Back closes the top sheet (Setup
// here), then pauses and says the next Back exits, then exits. Desktop runs
// it too, since browser Back there pauses first as well.
test.describe("Mobile arcade kit: phone and browser Back", () => {
  test.setTimeout(150000);

  const CABINET = "[data-arcade-cabinet]";

  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(CABINET_ROUTE);
  });

  /** Whether the launch's entry is the current one. */
  const onCabinetEntry = (page: Page) =>
    page.evaluate(
      () =>
        (window.history.state as Record<string, unknown> | null)
          ?.arcadeCabinet === "trial-and-error"
    );

  /** Launches with a click, which every project (touch or not) can send. */
  async function launchAnywhere(page: Page) {
    const launch = page.getByRole("button", { name: /Launch Cabinet/i });
    await expect(async () => {
      if ((await launch.count()) > 0) await launch.click({ timeout: 2000 });
      await expect(page.locator(CABINET)).toBeVisible({ timeout: 3000 });
    }).toPass({ timeout: 90000 });
  }

  test("Back closes Setup, then pauses, then exits, with one entry per launch", async ({
    page,
  }) => {
    const launch = page.getByRole("button", { name: /Launch Cabinet/i });
    await expect(launch).toBeVisible();
    const lengthBefore = await page.evaluate(() => window.history.length);
    expect(await onCabinetEntry(page)).toBe(false);

    await launchAnywhere(page);
    expect(await page.evaluate(() => window.history.length)).toBe(
      lengthBefore + 1
    );
    expect(await onCabinetEntry(page)).toBe(true);

    // The run: the table's act and Blind, and its chips.
    const stage = page.locator(`${CABINET} .arcade-cabinet-stage`);
    await expect(stage).toContainText(/BLIND 1 OF 3/i, { timeout: 60000 });
    const runOf = async () =>
      (await stage.innerText())
        .split("\n")
        .filter((line) => /BLIND \d OF \d|\d+ Chips/i.test(line))
        .join("|");
    const runBefore = await runOf();
    expect(runBefore).not.toBe("");

    // A sheet over the game: the cabinet's Setup sheet (#2923).
    const sheet = page.getByTestId("cabinet-setup-sheet");
    await expect(async () => {
      await page
        .locator(`${CABINET} button[title="Setup"]`)
        .first()
        .click({ timeout: 2000 });
      await expect(sheet).toBeVisible({ timeout: 3000 });
    }).toPass({ timeout: 15000 });

    // Back one: the sheet closes and the run is intact.
    await page.goBack();
    await expect(sheet).toHaveCount(0);
    await expect(page.locator(CABINET)).toBeVisible();
    expect(await onCabinetEntry(page)).toBe(true);
    expect(await runOf()).toBe(runBefore);
    expect(new URL(page.url()).pathname).toBe(CABINET_ROUTE);

    // Back two: the game pauses and the cabinet says the next Back exits.
    await page.goBack();
    await expect(page.getByTestId("cabinet-back-hint")).toHaveText(
      /Back again to exit/
    );
    await expect(page.locator(CABINET)).toBeVisible();
    expect(await onCabinetEntry(page)).toBe(true);
    expect(await runOf()).toBe(runBefore);

    // Back three: the cabinet exits to its Launch button, on the same page.
    await page.goBack();
    await expect(page.locator(CABINET)).toHaveCount(0);
    await expect(launch).toBeFocused();
    expect(await onCabinetEntry(page)).toBe(false);
    expect(new URL(page.url()).pathname).toBe(CABINET_ROUTE);
  });

  test("Exit from the cabinet's controls pops its entry", async ({ page }) => {
    await launchAnywhere(page);
    expect(await onCabinetEntry(page)).toBe(true);

    await page
      .locator(`${CABINET} button[title="Reset / Power Off Cabinet"]`)
      .first()
      .click();
    await expect(page.locator(CABINET)).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /Launch Cabinet/i })
    ).toBeFocused();
    await expect.poll(() => onCabinetEntry(page)).toBe(false);
  });

  test("a drag 30px from the left edge in landscape stays in the cabinet", async ({
    page,
  }, testInfo) => {
    test.skip(!testInfo.project.use.hasTouch, "touch projects only");
    // A portrait phone project turns to landscape for this check.
    const held = page.viewportSize()!;
    const viewport =
      held.width > held.height
        ? held
        : { width: held.height, height: held.width };
    await page.setViewportSize(viewport);
    await launchAnywhere(page);
    const startX = EDGE_KEEP_OUT_PX + 6;
    expect(inEdgeKeepOut(startX, viewport.width)).toBe(false);

    // A horizontal drag from just inside the keep-out, by touch events.
    const y = Math.round(viewport.height / 2);
    const cdp = await page
      .context()
      .newCDPSession(page)
      .catch(() => null);
    test.skip(cdp === null, "needs CDP touch input (Chromium)");
    await cdp!.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: startX, y }],
    });
    for (let step = 1; step <= 8; step++) {
      await cdp!.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: startX + step * 20, y }],
      });
    }
    await cdp!.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });

    await expect(page.locator(CABINET)).toBeVisible();
    expect(await onCabinetEntry(page)).toBe(true);
    expect(new URL(page.url()).pathname).toBe(CABINET_ROUTE);
  });
});

// The shared view assertions (#2365) on the phone projects. Trial & Error
// stands in for the fixture game until a game ships its phone view (ADR
// 0062); a seed fixes its first deal, so the taps-only script is the same on
// every run. The view swap check waits for a game with views: Trial & Error
// mounts no `data-view`, and the harness self-tests cover the helper.
test.describe("Mobile arcade kit: shared view assertions", () => {
  test.setTimeout(150000);

  const SLUG = "trial-and-error";
  const SEED = "e2e-4";
  // A TLF Pair this seed deals into the Small Blind (#2055). Neither card
  // needs inspecting, so the pair scores without the zero-score rule.
  const DISPOSITION = "C-T14.1.2";
  const DISCONTINUED = "C-L16.1.1";
  const PLAY_HAND = /^Play Hand/;

  const card = (page: Page, id: string) =>
    page.locator(`[data-card-id="${id}"]`);
  /** The round score, without the figure spaces that pad it. */
  const roundScore = async (page: Page) =>
    Number(
      ((await page.getByTestId("round-score").textContent()) ?? "").replace(
        /\D/g,
        ""
      ) || 0
    );
  /** The run a reload must keep: the score and the cards in hand. */
  const readRun = async (page: Page) => ({
    score: await roundScore(page),
    hand: await page
      .locator("[data-card-id]")
      .evaluateAll((els) => els.map((el) => el.getAttribute("data-card-id"))),
  });

  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(!testInfo.project.use.hasTouch, "touch projects only");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await launchGame(page, SLUG, { query: `seed=${SEED}` });
    await expect(page.getByTestId("hand")).toBeVisible({ timeout: 60000 });
  });

  test("the stage covers the screen, and its controls and text meet the floors", async ({
    page,
  }) => {
    await assertStageCoverage(page, 0.75);
    await assertTouchTargets(page, 44);
    await assertTextFloor(page, 12);
    await assertNoHorizontalOverflow(page);
  });

  test("Play Hand sits where a thumb reaches it", async ({ page }) => {
    const play = page.getByRole("button", { name: PLAY_HAND });
    await play.scrollIntoViewIfNeeded();
    await assertThumbZone(page, `[data-coach="play"]`);
  });

  // A phone held sideways fits the table to the stage: Play Hand and Discard
  // are on screen without scrolling, beside the hand (#2897). Geometry, not a
  // tap, because a tap scrolls a hidden button into view first.
  test("a sideways phone shows Play Hand and Discard without scrolling", async ({
    page,
  }) => {
    const viewport = page.viewportSize();
    test.skip(
      !viewport || viewport.width <= viewport.height || viewport.height > 500,
      "short landscape only"
    );
    const stage = await page
      .locator(`${IMMERSIVE} .arcade-cabinet-stage`)
      .evaluate((el) => ({
        scrollTop: el.scrollTop,
        overflow: el.scrollHeight - el.clientHeight,
      }));
    expect(stage.scrollTop).toBe(0);
    expect(stage.overflow).toBeLessThanOrEqual(1);
    for (const name of [PLAY_HAND, /^Discard/]) {
      const box = await page.getByRole("button", { name }).boundingBox();
      expect(box).toBeTruthy();
      expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height);
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width);
    }
    const hand = await page.getByTestId("hand").boundingBox();
    expect(hand!.y).toBeLessThan(viewport!.height);
    expect(hand!.y + hand!.height).toBeGreaterThan(0);
  });

  test("the cabinet has no blocking axe violations", async ({ page }) => {
    await axeCabinet(page);
  });

  test("taps alone reach the first score, and a reload resumes it", async ({
    page,
  }) => {
    await expectTapsOnlyFirstScore(page, {
      taps: [
        (p) => card(p, DISPOSITION),
        (p) => card(p, DISCONTINUED),
        (p) => p.getByRole("button", { name: PLAY_HAND }),
      ],
      score: roundScore,
    });
    // Played cards stay in the DOM while their exit animation runs.
    for (const id of [DISPOSITION, DISCONTINUED]) {
      await expect(card(page, id)).toHaveCount(0);
    }
    await interruptAndResume(page, {
      readRun,
      relaunch: async (p) => {
        const launch = p.getByRole("button", { name: /Launch Cabinet/i });
        await expect(async () => {
          if (await launch.isVisible()) await launch.tap({ timeout: 2000 });
          await expect(p.getByTestId("resume-run")).toBeVisible({
            timeout: 3000,
          });
        }).toPass({ timeout: 90000 });
      },
      resume: (p) => p.getByRole("button", { name: "Resume run" }),
    });
  });
});
