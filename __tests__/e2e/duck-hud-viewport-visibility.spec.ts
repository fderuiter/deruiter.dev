import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Regression coverage for the Working With Duck HUD/action-dock overlap audit (2026-09-09, D05/D09):
// at short viewports the fullscreen layout formed a tall vertical stack and the Toys/Tricks/Actions
// dock started below the fold (y=584 @ 320x568, y=395 @ 667x375), forcing players to scroll away
// from the live canvas to act. This spec measures the dock's on-screen position directly.
const SHORT_VIEWPORTS = [
  { name: "320x568 portrait", width: 320, height: 568 },
  { name: "667x375 landscape", width: 667, height: 375 },
];

async function gotoDuck(page: import("@playwright/test").Page) {
  // A browser with no prior Clerk cookies redirects its first navigation through Clerk's
  // cross-domain "dev browser" handshake before rendering anything. That's transparent against a
  // real Clerk instance, but here it targets an unreachable placeholder host, so pre-seed the
  // cookies Clerk expects to find already synced and skip the handshake entirely. Harmless when a
  // real instance is configured — it only short-circuits the same "already synced" fast path.
  await page.context().addCookies([
    { name: "__client_uat", value: "0", domain: "127.0.0.1", path: "/" },
    {
      name: "__clerk_db_jwt",
      value: "test-dev-browser-placeholder",
      domain: "127.0.0.1",
      path: "/",
    },
  ]);
  await page.goto("/arcade/working-with-duck");
  await page.waitForLoadState("domcontentloaded");
}

async function launchDuckFullscreen(page: import("@playwright/test").Page) {
  await gotoDuck(page);

  await expect(async () => {
    const launchBtn = page.getByRole("button", { name: /Launch Cabinet/i });
    if (await launchBtn.isVisible()) {
      await launchBtn.click({ force: true });
    }
    const fullscreenBtn = page
      .locator('button[aria-label*="Fullscreen"]')
      .first();
    await expect(fullscreenBtn).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 20000 });

  const fullscreenBtn = page
    .locator('button[aria-label*="Fullscreen"]')
    .first();
  await fullscreenBtn.click();
  await page.waitForTimeout(300);
}

test.describe("Working With Duck: HUD and action dock stay simultaneously visible", () => {
  for (const viewport of SHORT_VIEWPORTS) {
    test(`action dock is visible without scrolling at ${viewport.name}`, async ({
      page,
    }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await launchDuckFullscreen(page);

      const canvas = page.locator("canvas").first();
      await expect(canvas).toBeVisible({ timeout: 10000 });

      const dock = page.getByTestId("duck-action-dock");
      await expect(dock).toBeVisible({ timeout: 10000 });

      const canvasBox = await canvas.boundingBox();
      const dockBox = await dock.boundingBox();
      expect(canvasBox).not.toBeNull();
      expect(dockBox).not.toBeNull();

      // The playfield must actually be on screen (not scrolled entirely below the fold).
      expect(canvasBox!.y).toBeLessThan(viewport.height);
      expect(canvasBox!.y + canvasBox!.height).toBeGreaterThan(0);

      // The action dock must start within the visible viewport — no scrolling required
      // to reach Toys/Tricks/Actions while the scene is on screen.
      expect(dockBox!.y).toBeLessThan(viewport.height);
    });
  }
});

// #1316: the windowed cabinet was 960 px tall at 1440x900, so the hotbar started below the fold
// and clicking Dog Park or Bathtub scrolled the scene under the navbar. The canvas now caps its
// width by the viewport height, so the whole cabinet fits below the fixed navbar.
test.describe("Working With Duck: windowed cabinet fits a desktop screen", () => {
  test("cabinet fits below the navbar at 1440x900", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoDuck(page);

    await expect(async () => {
      const launchBtn = page.getByRole("button", { name: /Launch Cabinet/i });
      if (await launchBtn.isVisible()) {
        await launchBtn.click({ force: true });
      }
      await expect(page.getByTestId("duck-action-dock")).toBeVisible({
        timeout: 2000,
      });
    }).toPass({ timeout: 20000 });

    const cabinet = page.locator(".arcade-cabinet").first();
    const navHeight = await page.evaluate(
      () =>
        document.querySelector("header")?.getBoundingClientRect().height ?? 0
    );
    const cabinetBox = await cabinet.boundingBox();
    expect(cabinetBox).not.toBeNull();
    expect(cabinetBox!.height).toBeLessThanOrEqual(900 - navHeight);
  });
});

// Regression coverage for D09: axe found three serious color-contrast violations (3.84:1,
// below the required 4.5:1) in the always-visible top HUD helper labels — the small
// "Endless Mode / Speed", "Fetch / Sit / ZOOMIES", and "Drag to Door" text under each meter.
test.describe("Working With Duck: HUD meets WCAG AA contrast while running", () => {
  test("top HUD has zero color-contrast violations once the game is running", async ({
    page,
  }) => {
    await gotoDuck(page);

    await expect(async () => {
      const launchBtn = page.getByRole("button", { name: /Launch Cabinet/i });
      if (await launchBtn.isVisible()) {
        await launchBtn.click({ force: true });
      }
      // The attract screen is the title (#1516): Launch starts Sprint 1.
      await expect(page.getByTestId("duck-hud-meters")).toBeVisible({
        timeout: 2000,
      });
    }).toPass({ timeout: 20000 });

    const hud = page.getByTestId("duck-hud-meters");
    await expect(hud).toBeVisible({ timeout: 10000 });

    const results = await new AxeBuilder({ page })
      .include('[data-testid="duck-hud-meters"]')
      .withTags(["wcag2aa", "wcag21aa"])
      .analyze();

    const contrastViolations = results.violations.filter(
      (v) => v.id === "color-contrast"
    );
    expect(
      contrastViolations,
      JSON.stringify(contrastViolations, null, 2)
    ).toHaveLength(0);
  });
});
