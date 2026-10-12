import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import path from "node:path";
import { assertNoHorizontalOverflow, captureMatrix } from "./mobile-harness";

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

    // The cabinet publishes the toolbar's width, so a game HUD can pad for it.
    const inset = await page
      .locator(IMMERSIVE)
      .evaluate((el) =>
        getComputedStyle(el).getPropertyValue("--cabinet-toolbar-inset").trim()
      );
    expect(inset).toMatch(/px$/);
  });

  test("a press inside the immersive cabinet reaches its control", async ({
    page,
  }) => {
    await launchCabinet(page);

    await page
      .locator(`${IMMERSIVE} button[title="Pre-Game Setup Wizard"]`)
      .tap();
    const skip = page.getByRole("button", { name: "Skip Setup" });
    await expect(skip).toBeVisible();

    await skip.tap();
    await expect(skip).toHaveCount(0);
    await expect(page.locator(IMMERSIVE)).toBeVisible();
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
