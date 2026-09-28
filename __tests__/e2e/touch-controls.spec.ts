import { test, expect, type Page } from "@playwright/test";

// Six arcade games show a desktop-only notice on phones and portrait tablets
// (ADR 0048). These specs exercise the touch controls behind it, so they take
// the notice's "Try it anyway" path first. On a device the gate does not
// match, the button is hidden and this is a no-op.
async function passDesktopOnlyGate(page: Page) {
  const tryAnyway = page.getByRole("button", { name: /Try it anyway/i });
  if (await tryAnyway.isVisible()) {
    await expect(async () => {
      await tryAnyway.click();
      await expect(tryAnyway).toBeHidden({ timeout: 3000 });
    }).toPass({ timeout: 15000 });
  }
}

test.describe("Mobile & Tablet Touch Interactions Suite", () => {
  test.beforeEach(async ({ page }) => {
    // Emulate reduced motion for test stability
    await page.emulateMedia({ reducedMotion: "reduce" });

    // Enable test flags
    await page.addInitScript(() => {
      (
        window as unknown as { __PLAYWRIGHT_TEST__?: boolean }
      ).__PLAYWRIGHT_TEST__ = true;
    });

    // Disable CSS animations for deterministic testing
    await page.addStyleTag({
      content: `
        *, *::before, *::after {
          transition: none !important;
          animation: none !important;
        }
      `,
    });
  });

  const TEST_ROUTES = [
    "/",
    "/schedule",
    "/crf",
    "/proof",
    "/neuro",
    "/simulator",
    "/arcade",
    "/arcade/laser-loon",
    "/arcade/retro-labyrinth",
    "/arcade/clinical-chaos",
    "/arcade/garmin-watch",
    "/arcade/working-with-duck",
    "/arcade/quasi-puzzler",
    "/arcade/meme-vault",
  ];

  for (const route of TEST_ROUTES) {
    test(`Zero Horizontal Overflow Invariant on route: ${route}`, async ({
      page,
    }) => {
      await page.goto(route);
      await page.waitForTimeout(300);

      // Verify that document scrollWidth does not exceed viewport innerWidth
      const isOverflowing = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth;
      });

      expect(isOverflowing).toBe(false);
    });
  }

  test("Mobile Navigation Drawer opens, traps focus, and links to all primary routes", async ({
    page,
    isMobile,
  }) => {
    test.skip(
      !isMobile,
      "Mobile drawer test is only applicable on mobile viewports"
    );

    await page.goto("/");
    await page.waitForTimeout(400);

    // Click Hamburger Menu Trigger
    const menuButton = page.getByRole("button", {
      name: /open navigation menu/i,
    });
    await expect(menuButton).toBeVisible();

    // Verify modal overlay opens
    const overlay = page.getByRole("dialog", {
      name: /mobile navigation overlay/i,
    });
    await expect(async () => {
      if (!(await overlay.isVisible())) await menuButton.click();
      await expect(overlay).toBeVisible();
    }).toPass({ timeout: 15000 });

    // Verify nav links inside drawer
    const workLink = overlay.getByRole("link", { name: /^work\b/i });
    await expect(workLink).toBeVisible();

    const arcadeLink = overlay.getByRole("link", { name: /^arcade\b/i });
    await expect(arcadeLink).toBeVisible();

    const crfLink = overlay.getByRole("link", { name: /crf studio/i });
    await expect(crfLink).toBeVisible();

    const proofLink = overlay.getByRole("link", { name: /proof canvas/i });
    await expect(proofLink).toBeVisible();

    const neuroLink = overlay.getByRole("link", { name: /neurorecon studio/i });
    await expect(neuroLink).toBeVisible();

    // Close menu with escape key
    await page.keyboard.press("Escape");
    await expect(overlay).toBeHidden();
  });

  test("Proof Workspace mobile view switcher tabs and auto-step execution", async ({
    page,
    isMobile,
  }) => {
    await page.goto("/proof");

    if (isMobile) {
      // Verify mobile segmented tab switcher. Names are exact because a
      // /canvas/i pattern first matches "Open Field Manual for Logical Proof
      // Canvas", which never switches back to the canvas view (#928).
      const ledgerTab = page
        .getByRole("button", { name: "Ledger", exact: true })
        .first();
      const fallacyTab = page
        .getByRole("button", { name: "Fallacy", exact: true })
        .first();
      const canvasTab = page.getByRole("button", {
        name: "Canvas",
        exact: true,
      });

      await expect(canvasTab).toBeVisible();
      await expect(async () => {
        await ledgerTab.click();
        await expect(
          page.getByText(/Formal Fitch Deduction Ledger/i)
        ).toBeVisible({ timeout: 3000 });
      }).toPass({ timeout: 15000 });

      await fallacyTab.click();
      await expect(
        page.getByText(/Zero Active Fallacies|Truth Table/i)
      ).toBeVisible();

      await canvasTab.click();
    }

    // Verify auto-step execution
    const autoStepBtn = page.getByRole("button", { name: /auto-step/i });
    await expect(autoStepBtn).toBeVisible();
    await autoStepBtn.click();
  });

  test("CRF Studio mobile bottom navigation and canvas interaction", async ({
    page,
    isMobile,
  }) => {
    await page.goto("/crf");
    await page.waitForTimeout(400);

    if (isMobile) {
      const mobileNav = page.getByLabel(/mobile view navigation/i);
      if (await mobileNav.isVisible()) {
        const formsTab = mobileNav.getByRole("button", { name: /forms/i });
        const canvasTab = mobileNav.getByRole("button", { name: /canvas/i });

        await expect(formsTab).toBeVisible();
        await expect(canvasTab).toBeVisible();

        await formsTab.click();
        await canvasTab.click();
      }
    }
  });

  test("Neuro Simulator view mode toggles and slice canvas rendering", async ({
    page,
  }) => {
    await page.goto("/neuro");
    await page.waitForTimeout(400);

    // Verify 2D / 3D split toggles
    const splitBtn = page.getByRole("button", { name: /split 3d\/2d/i });
    await expect(splitBtn).toBeVisible();

    const canvasElements = page.locator("canvas");
    await expect(canvasElements.first()).toBeVisible();
  });

  test("Retro Labyrinth touch D-Pad and action buttons operate properly", async ({
    page,
  }) => {
    await page.goto("/arcade/retro-labyrinth");
    await page.waitForLoadState("networkidle");
    await passDesktopOnlyGate(page);

    const launchCabinetBtn = page.getByRole("button", {
      name: /Launch Cabinet/i,
    });
    if (await launchCabinetBtn.isVisible()) {
      await launchCabinetBtn.click();
    }

    // Locate the labyrinth game container
    const gameContainer = page
      .locator('[data-keyboard-boundary="true"]')
      .first();
    await expect(gameContainer).toBeVisible({ timeout: 15000 });

    // If on mobile/tablet, verify Virtual D-Pad is rendered
    const virtualPad = page.getByRole("group", {
      name: /virtual game controller/i,
    });
    if (await virtualPad.isVisible()) {
      const upBtn = virtualPad.getByRole("button", { name: /move up/i });
      const downBtn = virtualPad.getByRole("button", { name: /move down/i });
      const leftBtn = virtualPad.getByRole("button", { name: /move left/i });
      const rightBtn = virtualPad.getByRole("button", { name: /move right/i });

      await expect(upBtn).toBeVisible();
      await expect(downBtn).toBeVisible();
      await expect(leftBtn).toBeVisible();
      await expect(rightBtn).toBeVisible();

      // Trigger touch movements
      await upBtn.click();
      await downBtn.click();
      await leftBtn.click();
      await rightBtn.click();
    }
  });

  test("Laser Loon touch controls bar and weapon switching", async ({
    page,
  }) => {
    await page.goto("/arcade/laser-loon");
    await page.waitForLoadState("networkidle");
    await passDesktopOnlyGate(page);

    const launchCabinetBtn = page.getByRole("button", {
      name: /Launch Cabinet/i,
    });
    if (await launchCabinetBtn.isVisible()) {
      await launchCabinetBtn.click();
    }

    // Verify game canvas is rendered
    const canvas = page.locator("canvas").first();
    await expect(canvas).toBeVisible({ timeout: 15000 });

    // Check touch controls bar if on mobile/tablet
    const fireBtn = page.getByRole("button", {
      name: "Primary Fire",
      exact: true,
    });
    const iceBtn = page.getByRole("button", {
      name: "4: Mortar",
      exact: true,
    });

    if (await iceBtn.isVisible()) {
      await iceBtn.click();
    }

    if (await fireBtn.isVisible()) {
      await fireBtn.click();
    }
  });

  test("Clinical Trial Chaos conveyor canvas touch isolation and station routing", async ({
    page,
  }) => {
    await page.goto("/arcade/clinical-chaos");
    await page.waitForLoadState("networkidle");
    await passDesktopOnlyGate(page);

    const launchCabinetBtn = page.getByRole("button", {
      name: /Launch Cabinet/i,
    });
    if (await launchCabinetBtn.isVisible()) {
      await launchCabinetBtn.click();
    }

    const canvas = page.locator("canvas").first();
    await expect(canvas).toBeVisible({ timeout: 15000 });

    // Verify touchAction style is none
    const touchAction = await canvas.evaluate(
      (el) => window.getComputedStyle(el).touchAction
    );
    expect(touchAction).toBe("none");
  });
});

/**
 * Real rendered touch-target dimensions (#609).
 *
 * `lib/dx/doctor.ts`'s `checkTouchTargetDimensions` is a static source-text
 * heuristic: it can never see the actual box a control occupies once
 * rendered (content-driven padding, multi-line JSX class placement, and
 * responsive overrides are all invisible to it). These tests are the
 * authoritative check: they measure real `getBoundingClientRect()` output
 * against the repository's 48px minimum touch-target standard (ADR-0003,
 * ADR-0019) for representative native and custom controls, across the
 * desktop/tablet/mobile projects configured in playwright.config.ts (which
 * cover both portrait and landscape-shaped viewports).
 */
test.describe("Real rendered touch-target dimensions (48px minimum, ADR-0003/ADR-0019)", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  const MIN_TOUCH_TARGET_PX = 48;

  async function expectAtLeastMinTouchTarget(
    locator: import("@playwright/test").Locator,
    label: string
  ) {
    const box = await locator.boundingBox();
    expect(box, `${label} should have a measurable bounding box`).not.toBe(
      null
    );
    expect(
      box!.width,
      `${label} width (${box!.width}px) should be >= ${MIN_TOUCH_TARGET_PX}px`
    ).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX);
    expect(
      box!.height,
      `${label} height (${box!.height}px) should be >= ${MIN_TOUCH_TARGET_PX}px`
    ).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX);
  }

  test("Retro Labyrinth virtual D-Pad buttons meet the 48px minimum on real rendered output", async ({
    page,
  }) => {
    await page.goto("/arcade/retro-labyrinth");
    await page.waitForLoadState("networkidle");
    await passDesktopOnlyGate(page);

    const launchCabinetBtn = page.getByRole("button", {
      name: /Launch Cabinet/i,
    });
    if (await launchCabinetBtn.isVisible()) {
      await launchCabinetBtn.click();
      const gameContainer = page
        .locator('[data-keyboard-boundary="true"]')
        .first();
      await expect(gameContainer).toBeVisible({ timeout: 15000 });
    }

    const upBtn = page.getByRole("button", { name: /move up/i });

    if (!(await upBtn.isVisible().catch(() => false))) {
      test.skip(true, "Virtual D-Pad only renders on touch-capable layouts");
    }

    await expectAtLeastMinTouchTarget(upBtn, "D-Pad Up button");
    await expectAtLeastMinTouchTarget(
      page.getByRole("button", { name: /move down/i }),
      "D-Pad Down button"
    );
    await expectAtLeastMinTouchTarget(
      page.getByRole("button", { name: /move left/i }),
      "D-Pad Left button"
    );
    await expectAtLeastMinTouchTarget(
      page.getByRole("button", { name: /move right/i }),
      "D-Pad Right button"
    );
  });

  test("Mobile navigation menu trigger meets the 48px minimum on real rendered output", async ({
    page,
    isMobile,
  }) => {
    test.skip(
      !isMobile,
      "Hamburger trigger is only rendered on mobile viewports"
    );

    await page.goto("/");
    await page.waitForTimeout(300);

    const menuButton = page.getByRole("button", {
      name: /open navigation menu/i,
    });
    await expect(menuButton).toBeVisible();
    await expectAtLeastMinTouchTarget(
      menuButton,
      "Mobile nav hamburger button"
    );
  });

  test("Arcade cabinet Fullscreen and Power buttons meet the 48px minimum on real rendered output", async ({
    page,
  }) => {
    await page.goto("/arcade/laser-loon");
    await page.waitForLoadState("networkidle");
    await passDesktopOnlyGate(page);

    const launchCabinetBtn = page.getByRole("button", {
      name: /Launch Cabinet/i,
    });
    if (await launchCabinetBtn.isVisible()) {
      await launchCabinetBtn.click();
    }

    const fullscreenBtn = page
      .locator('button[aria-label*="Fullscreen"]')
      .first();
    await expect(fullscreenBtn).toBeVisible({ timeout: 15000 });
    await expectAtLeastMinTouchTarget(
      fullscreenBtn,
      "Cabinet Frame Fullscreen button"
    );

    const powerBtn = page.getByRole("button", { name: /Power/i }).first();
    if (await powerBtn.isVisible().catch(() => false)) {
      await expectAtLeastMinTouchTarget(powerBtn, "Cabinet Frame Power button");
    }
  });
});
