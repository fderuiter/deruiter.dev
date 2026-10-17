import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Monkey C Mayhem 10/10 audit (#2128): desktop checks for the gaps the audit
 * found, run at the desktop sizes the rubric names.
 */

const DESKTOP_SIZES = [
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
] as const;

const BLOCKING = new Set(["critical", "serious", "moderate"]);

async function blockingViolations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).analyze();
  return results.violations
    .filter((v) => BLOCKING.has(v.impact ?? ""))
    .map(
      (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`
    );
}

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
  for (const size of DESKTOP_SIZES) {
    test(`the run-over card fits beside the watch at ${size.width}px (#2132)`, async ({
      page,
    }) => {
      await page.setViewportSize(size);
      await launchCabinet(page);
      // Dev Mode's battery drain ends a run in a few clicks.
      await page.getByRole("switch", { name: "Dev Mode" }).click();
      await page.locator('[data-testid="garmin-screen"]').click();
      await page.keyboard.press("Enter");
      const dialog = page.getByRole("dialog");
      await expect(async () => {
        if (!(await dialog.count())) {
          await page
            .getByRole("button", { name: /Drain Battery/ })
            .click({ timeout: 1000 });
        }
        await expect(dialog).toBeVisible({ timeout: 500 });
      }).toPass({ timeout: 20000 });
      // Clicking the drain button scrolled the page; a player who ran out of
      // battery would still be looking at the watch. Bring the watch back to
      // the top of the view below the navbar (the page's scroll-padding-top,
      // #2325) rather than replaying wherever the harness's own clicks left
      // the page, which centre their target and so depend on its size.
      await page.evaluate(() =>
        document
          .querySelector(".garmin-sim")
          ?.scrollIntoView({ block: "start", behavior: "instant" })
      );

      const primary = dialog.getByRole("button", { name: /Reboot|Run Again/ });
      await expect(primary).toBeFocused();
      const navBottom = await page.evaluate(
        () =>
          document.querySelector("header")?.getBoundingClientRect().bottom ?? 0
      );
      for (const box of [
        await dialog.boundingBox(),
        await primary.boundingBox(),
      ]) {
        expect(box).not.toBeNull();
        expect(box!.y).toBeGreaterThanOrEqual(navBottom);
        expect(box!.y + box!.height).toBeLessThanOrEqual(size.height);
      }
    });
  }
  test("axe finds nothing serious idle, running or at game over (#2133)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await launchCabinet(page);
    expect(await blockingViolations(page)).toEqual([]);

    await page.getByRole("switch", { name: "Dev Mode" }).click();
    await page.locator('[data-testid="garmin-screen"]').click();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("img", { name: /Smartwatch display simulator/i })
    ).toHaveAttribute("aria-label", /Status: playing/);
    expect(await blockingViolations(page)).toEqual([]);

    const dialog = page.getByRole("dialog");
    await expect(async () => {
      if (!(await dialog.count())) {
        await page
          .getByRole("button", { name: /Drain Battery/ })
          .click({ timeout: 1000 });
      }
      await expect(dialog).toBeVisible({ timeout: 500 });
    }).toPass({ timeout: 20000 });
    expect(await blockingViolations(page)).toEqual([]);
  });

  test("Enter starts a race after Race Mode is clicked (#2130)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await launchCabinet(page);
    await page.getByRole("radio", { name: "Race Mode" }).click();
    await expect(page.locator('[data-keyboard-boundary="true"]')).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("img", { name: /Smartwatch display simulator/i })
    ).toHaveAttribute("aria-label", /Status: playing/);
  });
});
