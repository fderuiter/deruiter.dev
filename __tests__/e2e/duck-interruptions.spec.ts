import { test, expect } from "@playwright/test";

// Regression & E2E coverage for DUCK-01 (#602):
// Suspend gameplay during manual pause and reading interruptions (Scrapbook / Wardrobe).
// Verified across desktop Chromium and Mobile Chrome.

async function gotoDuck(page: import("@playwright/test").Page) {
  // Pre-seed Clerk cookies to skip external dev-browser redirect in local testing
  await page.context().addCookies([
    { name: "__client_uat", value: "0", domain: "localhost", path: "/" },
    {
      name: "__clerk_db_jwt",
      value: "test-dev-browser-placeholder",
      domain: "localhost",
      path: "/",
    },
  ]);
  await page.goto("/arcade/working-with-duck");
  await page.waitForLoadState("domcontentloaded");
}

async function launchAndStartDuck(page: import("@playwright/test").Page) {
  await gotoDuck(page);

  // 1. Launch PlayCabinet with hydration-safe polling
  await expect(async () => {
    const launchBtn = page.getByRole("button", { name: /Launch Cabinet/i });
    if (await launchBtn.isVisible()) {
      await launchBtn.click({ force: true });
    }
    // The attract screen is the title (#1516): Launch starts Sprint 1.
    const progressMeter = page.locator('[aria-label="Work Progress"]');
    await expect(progressMeter).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 20000 });

  // 3. Wait until simulation is actively advancing
  await expect(async () => {
    const meter = page.locator('[aria-label="Work Progress"]');
    const val = Number(await meter.getAttribute("aria-valuenow"));
    expect(val).toBeGreaterThan(0);
  }).toPass({ timeout: 10000 });
}

test.describe("Working With Duck - Interruption Suspension E2E (#602)", () => {
  test("suspends simulation during manual pause and resumes without burst", async ({
    page,
  }) => {
    await launchAndStartDuck(page);

    const progressMeter = page.locator('[aria-label="Work Progress"]');
    const pauseBtn = page
      .locator('button[title*="Pause Sprint"]:visible')
      .first();
    await expect(pauseBtn).toBeVisible({ timeout: 5000 });

    // Click pause button
    await pauseBtn.click();

    // Verify pause overlay is displayed
    const pauseOverlay = page.getByTestId("duck-pause-overlay");
    await expect(pauseOverlay).toBeVisible({ timeout: 5000 });

    const pausedProgress = Number(
      await progressMeter.getAttribute("aria-valuenow")
    );

    // Wait 1.5 seconds: progress must remain completely unchanged
    await page.waitForTimeout(1500);
    const progressAfterWait = Number(
      await progressMeter.getAttribute("aria-valuenow")
    );
    expect(progressAfterWait).toBe(pausedProgress);

    // Click Resume Sprint button on the overlay
    const resumeBtn = pauseOverlay.getByRole("button", {
      name: /Resume Sprint/i,
    });
    await expect(resumeBtn).toBeVisible();
    await resumeBtn.click();

    // Overlay must disappear
    await expect(pauseOverlay).toBeHidden({ timeout: 5000 });

    // Progress must resume advancing
    await expect(async () => {
      const currentProgress = Number(
        await progressMeter.getAttribute("aria-valuenow")
      );
      expect(currentProgress).toBeGreaterThan(pausedProgress);
    }).toPass({ timeout: 10000 });
  });

  test("suspends simulation while scrapbook reading modal is open and resumes upon dismissal", async ({
    page,
  }) => {
    await launchAndStartDuck(page);

    const progressMeter = page.locator('[aria-label="Work Progress"]');
    const scrapbookBtn = page
      .locator('button[title*="Scrapbook"]:visible')
      .first();
    await expect(scrapbookBtn).toBeVisible({ timeout: 5000 });

    // Open scrapbook
    await scrapbookBtn.click();

    // Verify scrapbook dialog is open
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await expect(dialog.getByText("Duck's Polaroid Scrapbook")).toBeVisible();

    const pausedProgress = Number(
      await progressMeter.getAttribute("aria-valuenow")
    );

    // Wait 1.5 seconds: simulation must be frozen
    await page.waitForTimeout(1500);
    const progressAfterWait = Number(
      await progressMeter.getAttribute("aria-valuenow")
    );
    expect(progressAfterWait).toBe(pausedProgress);

    // Dismiss dialog using Escape key
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden({ timeout: 5000 });

    // Progress must resume advancing
    await expect(async () => {
      const currentProgress = Number(
        await progressMeter.getAttribute("aria-valuenow")
      );
      expect(currentProgress).toBeGreaterThan(pausedProgress);
    }).toPass({ timeout: 10000 });
  });

  test("preserves manual pause when scrapbook is opened and dismissed", async ({
    page,
  }) => {
    await launchAndStartDuck(page);

    const progressMeter = page.locator('[aria-label="Work Progress"]');

    // 1. Manually pause
    const pauseBtn = page
      .locator('button[title*="Pause Sprint"]:visible')
      .first();
    await pauseBtn.click();
    const pauseOverlay = page.getByTestId("duck-pause-overlay");
    await expect(pauseOverlay).toBeVisible({ timeout: 5000 });

    // 2. Open scrapbook
    const scrapbookBtn = page
      .locator('button[title*="Scrapbook"]:visible')
      .first();
    await scrapbookBtn.click();
    const scrapbookDialog = page.locator(
      '[aria-labelledby="duck-scrapbook-dialog-heading"]'
    );
    await expect(scrapbookDialog).toBeVisible({ timeout: 5000 });

    const pausedProgress = Number(
      await progressMeter.getAttribute("aria-valuenow")
    );

    // 3. Dismiss scrapbook with Escape: manual pause must persist!
    await page.keyboard.press("Escape");
    await expect(scrapbookDialog).toBeHidden({ timeout: 5000 });

    // Pause overlay MUST still be present
    await expect(pauseOverlay).toBeVisible({ timeout: 5000 });

    // Progress must stay frozen
    await page.waitForTimeout(1500);
    const progressAfterDismiss = Number(
      await progressMeter.getAttribute("aria-valuenow")
    );
    expect(progressAfterDismiss).toBe(pausedProgress);

    // 4. Resume manual pause
    const resumeBtn = pauseOverlay.getByRole("button", {
      name: /Resume Sprint/i,
    });
    await resumeBtn.click();
    await expect(pauseOverlay).toBeHidden({ timeout: 5000 });

    // Now progress resumes
    await expect(async () => {
      const currentProgress = Number(
        await progressMeter.getAttribute("aria-valuenow")
      );
      expect(currentProgress).toBeGreaterThan(pausedProgress);
    }).toPass({ timeout: 10000 });
  });

  test("suspends simulation while wardrobe modal is open and resumes upon dismissal", async ({
    page,
  }) => {
    await launchAndStartDuck(page);

    const progressMeter = page.locator('[aria-label="Work Progress"]');
    const wardrobeBtn = page
      .locator('button[title*="Wardrobe"]:visible')
      .first();
    await expect(wardrobeBtn).toBeVisible({ timeout: 5000 });

    // Open wardrobe
    await wardrobeBtn.click();

    // Verify wardrobe dialog is open
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await expect(dialog.getByText("Duck's Wardrobe")).toBeVisible();

    const pausedProgress = Number(
      await progressMeter.getAttribute("aria-valuenow")
    );

    // Wait 1.5 seconds: simulation must be frozen
    await page.waitForTimeout(1500);
    const progressAfterWait = Number(
      await progressMeter.getAttribute("aria-valuenow")
    );
    expect(progressAfterWait).toBe(pausedProgress);

    // Dismiss dialog using Escape key
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden({ timeout: 5000 });

    // Progress must resume advancing
    await expect(async () => {
      const currentProgress = Number(
        await progressMeter.getAttribute("aria-valuenow")
      );
      expect(currentProgress).toBeGreaterThan(pausedProgress);
    }).toPass({ timeout: 10000 });
  });

  test("ensures header pause button does not invert to Resume while reading overlay is open", async ({
    page,
  }) => {
    await launchAndStartDuck(page);

    // Open scrapbook
    const scrapbookBtn = page
      .locator('button[title*="Scrapbook"]:visible')
      .first();
    await scrapbookBtn.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Header pause button must NOT display Resume Sprint while reading
    const resumeBtn = page.locator('button[title*="Resume Sprint"]:visible');
    await expect(resumeBtn).toHaveCount(0);

    // Dismiss dialog
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden({ timeout: 5000 });

    // Now header button is back to active Pause Sprint
    const pauseBtn = page
      .locator('button[title*="Pause Sprint"]:visible')
      .first();
    await expect(pauseBtn).toBeVisible();
  });

  test("suspends simulation while Field Manual is opened via hotkey and resumes upon dismissal (DUCK-02)", async ({
    page,
  }) => {
    await launchAndStartDuck(page);

    const progressMeter = page.locator('[aria-label="Work Progress"]');

    // Open Field Manual with 'h' shortcut
    await page.keyboard.press("h");

    const manualDialog = page.locator('[aria-labelledby="manual-title"]');
    await expect(manualDialog).toBeVisible({ timeout: 5000 });
    await expect(
      manualDialog.getByRole("heading", { name: /Working With Duck/i })
    ).toBeVisible();

    const pausedProgress = Number(
      await progressMeter.getAttribute("aria-valuenow")
    );

    // Wait 1.5 seconds: simulation must remain suspended
    await page.waitForTimeout(1500);
    const progressAfterWait = Number(
      await progressMeter.getAttribute("aria-valuenow")
    );
    expect(progressAfterWait).toBe(pausedProgress);

    // Dismiss with 'h' shortcut
    await page.keyboard.press("h");
    await expect(manualDialog).toBeHidden({ timeout: 5000 });

    // Progress must resume advancing
    await expect(async () => {
      const currentProgress = Number(
        await progressMeter.getAttribute("aria-valuenow")
      );
      expect(currentProgress).toBeGreaterThan(pausedProgress);
    }).toPass({ timeout: 10000 });
  });

  test("preserves active manual pause when Field Manual is toggled via keyboard shortcut (DUCK-02)", async ({
    page,
  }) => {
    await launchAndStartDuck(page);

    const progressMeter = page.locator('[aria-label="Work Progress"]');

    // 1. Manually pause via button
    const pauseBtn = page
      .locator('button[title*="Pause Sprint"]:visible')
      .first();
    await pauseBtn.click();
    const pauseOverlay = page.getByTestId("duck-pause-overlay");
    await expect(pauseOverlay).toBeVisible({ timeout: 5000 });

    const pausedProgress = Number(
      await progressMeter.getAttribute("aria-valuenow")
    );

    // 2. Open Field Manual via 'h' shortcut
    await page.keyboard.press("h");
    const manualDialog = page.locator('[aria-labelledby="manual-title"]');
    await expect(manualDialog).toBeVisible({ timeout: 5000 });

    // Wait 1.5 seconds: progress remains unchanged
    await page.waitForTimeout(1500);
    expect(Number(await progressMeter.getAttribute("aria-valuenow"))).toBe(
      pausedProgress
    );

    // 3. Dismiss Field Manual with Escape
    await page.keyboard.press("Escape");
    await expect(manualDialog).toBeHidden({ timeout: 5000 });

    // Pause overlay must still be visible and simulation frozen
    await expect(pauseOverlay).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(1500);
    expect(Number(await progressMeter.getAttribute("aria-valuenow"))).toBe(
      pausedProgress
    );

    // 4. Resume manual pause
    const resumeBtn = pauseOverlay.getByRole("button", {
      name: /Resume Sprint/i,
    });
    await resumeBtn.click();
    await expect(pauseOverlay).toBeHidden({ timeout: 5000 });

    // Progress resumes
    await expect(async () => {
      const currentProgress = Number(
        await progressMeter.getAttribute("aria-valuenow")
      );
      expect(currentProgress).toBeGreaterThan(pausedProgress);
    }).toPass({ timeout: 10000 });
  });

  test("suspends simulation on 1440x500 short desktop when Field Manual is opened via hotkey and resumes upon dismissal (DUCK-03)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 500 });
    await launchAndStartDuck(page);

    const progressMeter = page.locator('[aria-label="Work Progress"]');

    // Open Field Manual with '?' shortcut
    await page.keyboard.press("?");

    const manualDialog = page.locator('[aria-labelledby="manual-title"]');
    await expect(manualDialog).toBeVisible({ timeout: 5000 });
    await expect(
      manualDialog.getByRole("heading", { name: /Working With Duck/i })
    ).toBeVisible();

    const pausedProgress = Number(
      await progressMeter.getAttribute("aria-valuenow")
    );

    // Wait 1.5 seconds: simulation must remain suspended
    await page.waitForTimeout(1500);
    const progressAfterWait = Number(
      await progressMeter.getAttribute("aria-valuenow")
    );
    expect(progressAfterWait).toBe(pausedProgress);

    // Dismiss with Escape
    await page.keyboard.press("Escape");
    await expect(manualDialog).toBeHidden({ timeout: 5000 });

    // Progress must resume advancing
    await expect(async () => {
      const currentProgress = Number(
        await progressMeter.getAttribute("aria-valuenow")
      );
      expect(currentProgress).toBeGreaterThan(pausedProgress);
    }).toPass({ timeout: 10000 });
  });

  test("coordinates Field Manual hotkey ownership across responsive viewport transitions (DUCK-03)", async ({
    page,
  }) => {
    // Start at desktop size 1280x800
    await page.setViewportSize({ width: 1280, height: 800 });
    await launchAndStartDuck(page);

    // 1. Open and close on desktop
    await page.keyboard.press("h");
    const manualDialog = page.locator('[aria-labelledby="manual-title"]');
    await expect(manualDialog).toBeVisible({ timeout: 5000 });
    await page.keyboard.press("h");
    await expect(manualDialog).toBeHidden({ timeout: 5000 });

    // 2. Transition viewport down to phone size 375x667
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(300);

    // Open on phone size: visible mobile control must capture shortcut
    await page.keyboard.press("h");
    await expect(manualDialog).toBeVisible({ timeout: 5000 });
    await page.keyboard.press("Escape");
    await expect(manualDialog).toBeHidden({ timeout: 5000 });
  });
});
