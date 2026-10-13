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
        await assertNoHorizontalOverflow(page);
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
