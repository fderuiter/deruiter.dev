import { test, expect } from "@playwright/test";
import path from "node:path";
import { assertNoHorizontalOverflow, captureMatrix } from "./mobile-harness";

// The immersive touch cabinet (ADR 0061) runs on coarse-pointer projects only.
// Trial & Error is the ungated cabinet game; Meme Vault does not use a cabinet.
const CABINET_ROUTE = "/arcade/trial-and-error";
const SHOT_DIR = path.join(process.cwd(), "test-results", "mobile-kit");

test.describe("Mobile arcade kit: immersive touch cabinet", () => {
  // A cold game chunk on a dev server can take most of a minute to compile.
  test.setTimeout(120000);
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

    // Tap until the cabinet goes immersive. A tap can land before React has
    // attached its handler, so retry; the button leaves the DOM once warm-up
    // starts, which is what stops the retries. The timeout covers a cold game
    // chunk compiling on a dev server.
    const launch = page.getByRole("button", { name: /Launch Cabinet/i });
    const immersive = page.locator(
      '[data-arcade-cabinet][data-immersive="true"]'
    );
    await expect(async () => {
      if ((await launch.count()) > 0) {
        await launch.tap({ timeout: 2000 });
      }
      await expect(immersive).toBeVisible({ timeout: 3000 });
    }).toPass({ timeout: 90000 });

    const cabinet = page.locator(
      '[data-arcade-cabinet][data-immersive="true"]'
    );
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

    // The stage is the one place that takes touch-action none.
    const stageTouch = await cabinet
      .locator(".arcade-cabinet-stage")
      .evaluate((el) => getComputedStyle(el).touchAction);
    expect(stageTouch).toBe("none");

    await captureMatrix(page, "trial-and-error-immersive", SHOT_DIR);

    // Exit through the cabinet's Power control.
    await page
      .locator(
        '[data-immersive="true"] button[title="Reset / Power Off Cabinet"]'
      )
      .tap();
    await expect(page.locator('[data-immersive="true"]')).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /Launch Cabinet/i })
    ).toBeVisible();

    const restoredOverflow = await page.evaluate(
      () => document.body.style.overflow
    );
    expect(restoredOverflow).not.toBe("hidden");
    await assertNoHorizontalOverflow(page);
  });
});
