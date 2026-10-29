import { expect, test } from "@playwright/test";

/**
 * Proof Canvas on phones (#3465): every view tab is reachable at 320, 375
 * and 393 px, the page never scrolls sideways, and on a coarse pointer the
 * tabs and header actions are at least 44 px tall. Each case sets its own
 * viewport and touch emulation so the spec means the same thing under every
 * Playwright project.
 */

const TABS = ["Canvas", "Ledger", "Fallacy", "Terminal"] as const;

for (const width of [320, 375, 393]) {
  test.describe(`Proof Canvas at ${width}px`, () => {
    test.use({
      viewport: { width, height: 760 },
      hasTouch: true,
      isMobile: true,
    });

    test("reaches every view tab without scrolling the page sideways", async ({
      page,
      browserName,
    }) => {
      test.skip(browserName === "firefox", "isMobile is unsupported");
      await page.goto("/proof");
      const views = page.getByRole("region", { name: "Proof views" });
      await expect(views).toBeVisible();

      for (const name of TABS) {
        const tab = views.getByRole("button", { name, exact: true });
        await expect(async () => {
          await tab.scrollIntoViewIfNeeded();
          await tab.click();
        }).toPass({ timeout: 15000 });
        const box = await tab.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
        expect(box!.height).toBeGreaterThanOrEqual(44);
      }

      for (const name of ["Share", "Custom Studio", "Export"]) {
        const box = await page
          .getByRole("button", { name, exact: true })
          .boundingBox();
        expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
      }

      const horizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth
      );
      expect(horizontalOverflow).toBe(false);
    });
  });
}

test.describe("Proof Canvas at 1440px", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("keeps the desktop layout without the phone view tabs", async ({
    page,
  }) => {
    await page.goto("/proof");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Proof views" })
    ).toBeHidden();
  });
});
