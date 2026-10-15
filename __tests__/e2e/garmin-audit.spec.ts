import { test, expect, type Page } from "@playwright/test";

/**
 * Monkey C Mayhem 10/10 audit (#2128): desktop checks for the gaps the audit
 * found, run at the desktop sizes the rubric names.
 */

const DESKTOP_SIZES = [
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
] as const;

async function launchCabinet(page: Page) {
  await page.goto("/arcade/garmin-watch", { waitUntil: "domcontentloaded" });
  await expect(async () => {
    const launchBtn = page.getByRole("button", { name: /Launch Cabinet/i });
    if (await launchBtn.isVisible()) {
      await launchBtn.click({ force: true });
    }
    await expect(page.locator("canvas").first()).toBeVisible({
      timeout: 2000,
    });
  }).toPass({ timeout: 20000 });
}

test.describe("Monkey C Mayhem audit (#2128)", () => {
  test.skip(
    ({ isMobile }) => isMobile,
    "The arcade cabinet is a desktop layout (ADR 0048)"
  );

  for (const size of DESKTOP_SIZES) {
    test(`every Tab stop in the cabinet is visible at ${size.width}px (#2129)`, async ({
      page,
    }) => {
      await page.setViewportSize(size);
      await launchCabinet(page);
      await page.locator('[data-keyboard-boundary="true"]').focus();

      const hidden: string[] = [];
      for (let i = 0; i < 40; i++) {
        await page.keyboard.press("Tab");
        const stop = await page.evaluate(() => {
          const el = document.activeElement as HTMLElement | null;
          if (!el || !el.closest(".garmin-sim")) return null;
          const box = el.getBoundingClientRect();
          // An off-screen (sr-only) ancestor clips its children to 1px, so
          // the smallest box up the tree is what the player can see.
          let seen = { width: box.width, height: box.height };
          for (let n = el.parentElement; n; n = n.parentElement) {
            const b = n.getBoundingClientRect();
            seen = {
              width: Math.min(seen.width, b.width),
              height: Math.min(seen.height, b.height),
            };
          }
          return {
            name: (
              el.getAttribute("aria-label") ||
              el.textContent ||
              el.tagName
            )
              .trim()
              .slice(0, 40),
            width: seen.width,
            height: seen.height,
          };
        });
        // Focus has left the simulator: every stop inside it was checked.
        if (!stop) break;
        if (stop.width <= 2 || stop.height <= 2) hidden.push(stop.name);
      }
      expect(hidden).toEqual([]);
    });
  }
});
