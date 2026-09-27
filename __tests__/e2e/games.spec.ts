import { test, expect } from "@playwright/test";

test.describe("Arcade Games & Simulators Suite", () => {
  test("Arcade Hub (/arcade) loads all arcade/puzzle games successfully", async ({
    page,
  }) => {
    await page.goto("/arcade");
    await page.waitForLoadState("networkidle");

    // 1. Quasi-Perfect Puzzler
    await expect(
      page.getByRole("heading", { name: /Quasi-Perfect Puzzler/i }).first()
    ).toBeVisible();

    // 2. Laser Loon: Bug Hunter
    await expect(
      page.getByRole("heading", { name: /Laser Loon/i }).first()
    ).toBeVisible();

    // 3. Garmin Watch Simulator
    await expect(
      page.getByRole("heading", { name: /Garmin/i }).first()
    ).toBeVisible();

    // 4. Clinical Trial Chaos
    await expect(
      page.getByRole("heading", { name: /Clinical Trial Chaos/i }).first()
    ).toBeVisible();

    // 5. Retro Labyrinth
    await expect(
      page.getByRole("heading", { name: /Retro Labyrinth/i }).first()
    ).toBeVisible();

    // 6. Working With Duck
    await expect(
      page.getByRole("heading", { name: /Working With Duck/i }).first()
    ).toBeVisible();

    // 7. Trial & Error: Biostat Ops
    await expect(
      page.getByRole("heading", { name: /Trial & Error/i }).first()
    ).toBeVisible();
    await expect(
      page.locator('main a[href="/arcade/trial-and-error"]').first()
    ).toBeVisible();
  });

  test("Laser Loon dedicated game starts and switches weapon modes", async ({
    page,
  }) => {
    await page.goto("/arcade/laser-loon", { waitUntil: "domcontentloaded" });

    // 1. Launch Cabinet with hydration retry
    await expect(async () => {
      const launchBtn = page.getByRole("button", { name: /Launch Cabinet/i });
      if (await launchBtn.isVisible()) {
        await launchBtn.click({ force: true });
      }
      await expect(page.locator("canvas").first()).toBeVisible({
        timeout: 2000,
      });
    }).toPass({ timeout: 20000 });

    const laserCanvas = page.locator("canvas").first();
    await expect(laserCanvas).toBeVisible({ timeout: 15000 });

    // 2. Expand the "Game modes, weapons & audio" disclosure with hydration
    // retry: the <summary> toggles natively, but React only attaches its own
    // listeners once hydrated, so a click that lands early can be a no-op.
    const optionsDisclosure = page.locator("details.arcade-shooter-options");
    const disclosureSummary = page.getByText("Game modes, weapons & audio", {
      exact: true,
    });
    await expect(async () => {
      await disclosureSummary.click({ force: true });
      await expect(optionsDisclosure).toHaveJSProperty("open", true);
    }).toPass({ timeout: 15000 });

    // 3. Switch weapons to Emerald Beam (Aurora)
    const auroraBtn = page.getByRole("button", {
      name: "Aurora (3)",
      exact: true,
    });
    await expect(async () => {
      await auroraBtn.click({ force: true });
      await expect(auroraBtn).toHaveAttribute("aria-pressed", "true", {
        timeout: 2000,
      });
    }).toPass({ timeout: 15000 });

    // 4. Switch to Sandbox mode
    const sandboxTab = page.getByRole("button", { name: /Zero-G Sandbox/i });
    await expect(async () => {
      await sandboxTab.click({ force: true });
      await expect(
        page.getByRole("button", { name: "Zero-G", exact: true })
      ).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 15000 });
  });

  test("Garmin Watch Simulator switches device targets and starts", async ({
    page,
  }) => {
    await page.goto("/arcade/garmin-watch", { waitUntil: "domcontentloaded" });

    // 1. Launch Cabinet with hydration retry
    await expect(async () => {
      const launchBtn = page.getByRole("button", { name: /Launch Cabinet/i });
      if (await launchBtn.isVisible()) {
        await launchBtn.click({ force: true });
      }
      await expect(page.locator("canvas").first()).toBeVisible({
        timeout: 2000,
      });
    }).toPass({ timeout: 20000 });

    const garminCanvas = page.locator("canvas").first();
    await expect(garminCanvas).toBeVisible({ timeout: 15000 });

    // 3. Switch to Edge (128KB) profile
    const edgeBtn = page.getByRole("button", { name: /Edge \(128KB\)/i });
    await expect(async () => {
      await edgeBtn.click({ force: true });
      await expect(page.getByText("LIMIT: 128 KB RAM").first()).toBeVisible({
        timeout: 2000,
      });
    }).toPass({ timeout: 15000 });

    // 4. Start simulation with hydration retry: verify the idle overlay
    // actually dismisses rather than merely attempting the click.
    const startSimBtn = page.getByRole("button", { name: /START SIMULATION/i });
    await expect(async () => {
      if (await startSimBtn.isVisible()) {
        await startSimBtn.click({ force: true });
      }
      await expect(startSimBtn).toBeHidden({ timeout: 2000 });
    }).toPass({ timeout: 15000 });
  });

  test("Quasi-Perfect Puzzler allows level selection and tactic clicking", async ({
    page,
  }) => {
    await page.goto("/arcade/quasi-puzzler", { waitUntil: "domcontentloaded" });

    // 1. Launch Cabinet with hydration retry
    await expect(async () => {
      const launchBtn = page.getByRole("button", { name: /Launch Cabinet/i });
      if (await launchBtn.isVisible()) {
        await launchBtn.click({ force: true });
      }
      await expect(
        page.locator("h3", { hasText: "The Identity Crisis" })
      ).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 20000 });

    // 3. Verify Level 1 and solve via rfl tactic card click + target node
    await expect(
      page.locator("h3", { hasText: "The Identity Crisis" })
    ).toBeVisible({ timeout: 15000 });

    const rflCard = page.locator('[data-tactic-id="rfl"]');
    await expect(rflCard).toBeVisible({ timeout: 15000 });
    await rflCard.click();

    const goalNode = page.locator('[data-node-id="eq-lvl1"]');
    await expect(goalNode).toBeVisible({ timeout: 15000 });

    // 4. Click the goal node to discharge it and open the Q.E.D. Theorem
    // Verified modal, with hydration retry: executeTacticOnNode() is a no-op
    // once the level is solved, so retrying this click is safe.
    await expect(async () => {
      await goalNode.click();
      await expect(
        page.getByText("AST GOAL DISCHARGED · SIMULATED")
      ).toBeVisible({
        timeout: 2000,
      });
    }).toPass({ timeout: 15000 });
  });

  test("Retro Labyrinth renders on 404 Error page with interactive canvas", async ({
    page,
  }) => {
    await page.goto("/non-existent-arcade-route-404", {
      waitUntil: "domcontentloaded",
    });

    // Click the Insert Coin preview or verify canvas
    await expect(async () => {
      const coinPreview = page.locator('[data-testid="insert-coin-preview"]');
      if (await coinPreview.isVisible()) {
        await coinPreview.click({ force: true });
      }
      const labyrinthCanvas = page.locator("canvas").first();
      await expect(labyrinthCanvas).toBeVisible({ timeout: 3000 });
    }).toPass({ timeout: 20000 });

    await expect(
      page.getByRole("heading", { name: "This page wandered off." })
    ).toBeVisible();
  });
});
