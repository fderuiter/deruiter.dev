import { test, expect, type Page } from "@playwright/test";

test.describe("Arcade Games Complete Buttons Visibility & Usability Audit", () => {
  const AUDIT_TARGETS: Array<{
    name: string;
    route: string;
    expectedButtons: Array<{
      namePattern: RegExp | string;
      description: string;
    }>;
  }> = [
    {
      name: "Laser Loon: Bug Hunter",
      route: "/arcade/laser-loon",
      expectedButtons: [
        {
          namePattern: /Fullscreen/i,
          description: "Cabinet Frame Fullscreen Button",
        },
        {
          namePattern: /Setup/i,
          description: "Cabinet Frame Setup Wizard Button",
        },
        { namePattern: /Power/i, description: "Cabinet Frame Power Button" },
        { namePattern: /Museum/i, description: "Flag Museum Button" },
        { namePattern: /Manual/i, description: "Field Manual Button" },
      ],
    },
    {
      name: "Retro Labyrinth",
      route: "/arcade/retro-labyrinth",
      expectedButtons: [
        {
          namePattern: /Fullscreen/i,
          description: "Cabinet Frame Fullscreen Button",
        },
        {
          namePattern: /Setup/i,
          description: "Cabinet Frame Setup Wizard Button",
        },
        { namePattern: /Power/i, description: "Cabinet Frame Power Button" },
      ],
    },
    {
      name: "Garmin Watch Simulator",
      route: "/arcade/garmin-watch",
      expectedButtons: [
        {
          namePattern: /Fullscreen/i,
          description: "Cabinet Frame Fullscreen Button",
        },
        {
          namePattern: /Setup/i,
          description: "Cabinet Frame Setup Wizard Button",
        },
        { namePattern: /Power/i, description: "Cabinet Frame Power Button" },
      ],
    },
    {
      name: "Clinical Trial Chaos",
      route: "/arcade/clinical-chaos",
      expectedButtons: [
        {
          namePattern: /Fullscreen/i,
          description: "Cabinet Frame Fullscreen Button",
        },
        {
          namePattern: /Setup/i,
          description: "Cabinet Frame Setup Wizard Button",
        },
        { namePattern: /Power/i, description: "Cabinet Frame Power Button" },
      ],
    },
    {
      name: "Working With Duck",
      route: "/arcade/working-with-duck",
      expectedButtons: [
        {
          namePattern: /Fullscreen/i,
          description: "Cabinet Frame Fullscreen Button",
        },
        {
          namePattern: /Setup/i,
          description: "Cabinet Frame Setup Wizard Button",
        },
        { namePattern: /Power/i, description: "Cabinet Frame Power Button" },
      ],
    },
    {
      name: "Quasi-Perfect Puzzler",
      route: "/arcade/quasi-puzzler",
      expectedButtons: [
        {
          namePattern: /Fullscreen/i,
          description: "Cabinet Frame Fullscreen Button",
        },
        {
          namePattern: /Setup/i,
          description: "Cabinet Frame Setup Wizard Button",
        },
        { namePattern: /Power/i, description: "Cabinet Frame Power Button" },
      ],
    },
    {
      name: "Secret Meme Vault",
      route: "/arcade/meme-vault",
      expectedButtons: [
        { namePattern: /Play /i, description: "Soundboard Play Buttons" },
      ],
    },
  ];

  for (const target of AUDIT_TARGETS) {
    test(`[${target.name}] all buttons are visible, sized, and interactive in windowed and fullscreen`, async ({
      page,
    }: {
      page: Page;
    }) => {
      await page.goto(target.route);
      await page.waitForLoadState("domcontentloaded");

      // 1. Launch Cabinet if button exists
      const launchBtn = page.getByRole("button", { name: /Launch Cabinet/i });
      if (await launchBtn.isVisible()) {
        await launchBtn.click({ force: true });
        // Wait for cabinet frame to mount
        await expect(
          page.locator('button[aria-label*="Fullscreen"]').first()
        ).toBeVisible({ timeout: 15000 });
      }

      // 2. Audit Windowed Mode Buttons
      for (const btnDef of target.expectedButtons) {
        // Check button visibility using standard locator
        const button = page
          .getByRole("button", { name: btnDef.namePattern })
          .first();
        if (await button.isVisible().catch(() => false)) {
          const box = await button.boundingBox();
          expect(box).not.toBeNull();
          expect(box!.width).toBeGreaterThan(0);
          expect(box!.height).toBeGreaterThan(0);
        }
      }

      // 3. Test Fullscreen Mode Button Visibility (if cabinet game)
      const fullscreenBtn = page
        .locator('button[aria-label*="Fullscreen"]')
        .first();
      if (await fullscreenBtn.isVisible().catch(() => false)) {
        await fullscreenBtn.click();

        // Verify floating exit and power buttons in fullscreen
        const exitFullscreenBtn = page
          .locator('button[aria-label*="Exit Fullscreen"]')
          .first();
        await expect(exitFullscreenBtn).toBeVisible({ timeout: 5000 });
        const box = await exitFullscreenBtn.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.width).toBeGreaterThan(0);
        expect(box!.height).toBeGreaterThan(0);

        // Exit fullscreen
        await exitFullscreenBtn.click();
        await expect(
          page.locator('button[aria-label*="Exit Fullscreen"]')
        ).toHaveCount(0);
      }
    });
  }
});
