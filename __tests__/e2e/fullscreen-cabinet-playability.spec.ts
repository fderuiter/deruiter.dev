import { test, expect, type Page } from "@playwright/test";

test.describe("Arcade Cabinet Fullscreen & In-Game Playability Suite", () => {
  const CABINET_GAMES: Array<{
    name: string;
    route: string;
    interactiveAction: (page: Page) => Promise<void>;
  }> = [
    {
      name: "Laser Loon: Bug Hunter",
      route: "/arcade/laser-loon",
      interactiveAction: async (page: Page) => {
        const auroraBtn = page.getByRole("button", {
          name: "3: Aurora",
          exact: true,
        });
        if (await auroraBtn.isVisible()) {
          await auroraBtn.click();
        }
      },
    },
    {
      name: "Retro Labyrinth: Graveyard Roguelike",
      route: "/arcade/retro-labyrinth",
      interactiveAction: async (page: Page) => {
        const canvas = page.locator("canvas").first();
        await expect(canvas).toBeVisible({ timeout: 10000 });
      },
    },
    {
      name: "Garmin Watch Simulator",
      route: "/arcade/garmin-watch",
      interactiveAction: async (page: Page) => {
        const startBtn = page
          .getByRole("button", { name: /START|Start\/Stop/i })
          .first();
        if (await startBtn.isVisible()) {
          await startBtn.click();
        }
      },
    },
    {
      name: "Clinical Trial Chaos",
      route: "/arcade/clinical-chaos",
      interactiveAction: async (page: Page) => {
        const buttons = page.locator("button");
        expect(await buttons.count()).toBeGreaterThan(0);
      },
    },
    {
      name: "Working With Duck",
      route: "/arcade/working-with-duck",
      interactiveAction: async (page: Page) => {
        const canvas = page.locator("canvas").first();
        await expect(canvas).toBeVisible({ timeout: 10000 });
      },
    },
    {
      name: "Quasi-Perfect Puzzler",
      route: "/arcade/quasi-puzzler",
      interactiveAction: async (page: Page) => {
        const heading = page.getByRole("heading", { name: /Quasi/i }).first();
        await expect(heading).toBeVisible({ timeout: 10000 });
      },
    },
  ];

  for (const game of CABINET_GAMES) {
    test(`[${game.name}] full-screen toggle, in-game interaction, and exit cycle`, async ({
      page,
    }) => {
      await page.goto(game.route);
      await page.waitForLoadState("domcontentloaded");

      // 1. Launch Cabinet with polling retry
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

      // 2. Find Cabinet Frame Fullscreen Button
      const fullscreenBtn = page
        .locator('button[aria-label*="Fullscreen"]')
        .first();
      await expect(fullscreenBtn).toBeVisible({ timeout: 5000 });

      // 3. Toggle Fullscreen ON
      await fullscreenBtn.click();
      await expect(
        page.locator('button[aria-label*="Exit Fullscreen"]').first()
      ).toBeVisible();

      // Verify zero horizontal overflow while in fullscreen
      const isOverflowInFullscreen = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth
      );
      expect(isOverflowInFullscreen).toBe(false);

      // 4. Execute in-game interaction while in fullscreen
      await game.interactiveAction(page);

      // 5. Toggle Fullscreen OFF via exit button or F key
      const exitBtn = page
        .locator('button[aria-label*="Exit Fullscreen"]')
        .first();
      if (await exitBtn.isVisible()) {
        await exitBtn.click();
      } else {
        await page.keyboard.press("f");
      }
      await expect(
        page.locator('button[aria-label*="Exit Fullscreen"]')
      ).toHaveCount(0);

      // Verify zero horizontal overflow after returning to windowed mode
      const isOverflowAfter = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth
      );
      expect(isOverflowAfter).toBe(false);
    });
  }
});
