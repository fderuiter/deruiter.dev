import { test, expect } from "@playwright/test";
import { ARCADE_REGISTRY } from "../../lib/arcade/registry";

// ADR 0048, narrowed by ADR 0061: games whose phone view is still gated show
// a desktop-only notice on phones (PHONE_QUERY). Tablets get the game. The
// registry decides which games (#2368), so this list follows it. Each case
// sets its own viewport and touch emulation so the spec means the same thing
// under every Playwright project.
const GATED_ROUTES = ARCADE_REGISTRY.filter(
  (game) => game.views.phone === "gated"
).map((game) => game.route);
const READY = ARCADE_REGISTRY.filter((game) => game.views.phone === "ready");
const BADGE = "[data-phone-readiness]";

test.describe("Desktop-only arcade gate", () => {
  test.describe("on a phone", () => {
    test.use({
      viewport: { width: 390, height: 664 },
      hasTouch: true,
      isMobile: true,
    });

    for (const route of GATED_ROUTES) {
      test(`${route} shows the notice instead of the cabinet`, async ({
        page,
        browserName,
      }) => {
        test.skip(browserName === "firefox", "isMobile is unsupported");
        await page.goto(route);
        await expect(page.getByTestId("desktop-only-notice")).toBeVisible();
        await expect(
          page.getByRole("button", { name: /Launch Cabinet/i })
        ).toBeHidden();
        await expect(page.locator("h1")).toBeVisible();
      });
    }

    test("the notice offers a preview, a saved link and phone-friendly picks", async ({
      page,
      browserName,
    }) => {
      test.skip(browserName === "firefox", "isMobile is unsupported");
      await page.goto("/arcade/garmin-watch");
      const notice = page.getByTestId("desktop-only-notice");
      await expect(notice.getByRole("img")).toBeVisible();
      await expect(
        notice.getByRole("button", { name: /Save link for later/i })
      ).toBeVisible();
      // The picks are the games the registry says play on a phone.
      for (const game of READY) {
        await expect(
          notice.getByRole("link", { name: new RegExp(game.name) })
        ).toHaveAttribute("href", game.route);
      }
    });

    test("the arcade hub badges each game and lists phone-ready games first", async ({
      page,
      browserName,
    }) => {
      test.skip(browserName === "firefox", "isMobile is unsupported");
      await page.goto("/arcade");
      const grid = page.getByTestId("arcade-games-grid");
      await expect(
        grid.getByText("Best on a bigger screen").first()
      ).toBeVisible();
      await expect(grid.getByText("Plays on phone").first()).toBeVisible();
      await expect(
        page.getByText(/On a phone\? Most of these games want a bigger screen/)
      ).toBeVisible();
      // Every card sits in one column, at least 88px tall, and the games that
      // play on a phone come first.
      const cards = grid.locator(":scope > [data-phone-view]");
      const boxes = await cards.evaluateAll((elements) =>
        elements.map((element) => {
          const box = element.getBoundingClientRect();
          return {
            ready: element.getAttribute("data-phone-view") === "ready",
            x: Math.round(box.x),
            y: box.y,
            height: box.height,
          };
        })
      );
      expect(new Set(boxes.map((box) => box.x)).size).toBe(1);
      for (const box of boxes) expect(box.height).toBeGreaterThanOrEqual(88);
      const byPosition = [...boxes].sort((a, b) => a.y - b.y);
      const firstGated = byPosition.findIndex((box) => !box.ready);
      expect(byPosition.slice(firstGated).every((box) => !box.ready)).toBe(
        true
      );
      expect(firstGated).toBeGreaterThan(0);
    });

    test("Try it anyway reveals the cabinet", async ({ page, browserName }) => {
      test.skip(browserName === "firefox", "isMobile is unsupported");
      await page.goto("/arcade/laser-loon");
      await expect(async () => {
        await page.getByRole("button", { name: /Try it anyway/i }).click();
        await expect(
          page.getByRole("button", { name: /Launch Cabinet/i })
        ).toBeVisible();
      }).toPass({ timeout: 15000 });
    });

    test("Trial & Error stays playable", async ({ page, browserName }) => {
      test.skip(browserName === "firefox", "isMobile is unsupported");
      await page.goto("/arcade/trial-and-error");
      await expect(
        page.getByRole("button", { name: /Launch Cabinet/i })
      ).toBeVisible();
      await expect(page.getByTestId("desktop-only-notice")).toHaveCount(0);
    });
  });

  test.describe("on a tablet", () => {
    // ADR 0061: iPads in either orientation get the game, not the notice.
    test.use({
      viewport: { width: 820, height: 1180 },
      hasTouch: true,
      isMobile: true,
    });

    test("a gated game shows no notice on an iPad in portrait", async ({
      page,
      browserName,
    }) => {
      test.skip(browserName === "firefox", "isMobile is unsupported");
      await page.goto("/arcade/retro-labyrinth");
      await expect(page.getByTestId("desktop-only-notice")).toBeHidden();
      await expect(
        page.getByRole("button", { name: /Launch Cabinet/i })
      ).toBeVisible();
    });

    test("the arcade hub shows no phone badges on an iPad", async ({
      page,
      browserName,
    }) => {
      test.skip(browserName === "firefox", "isMobile is unsupported");
      await page.goto("/arcade");
      await expect(page.locator(BADGE).first()).toBeHidden();
    });
  });

  test.describe("in a narrow desktop window", () => {
    test.use({
      viewport: { width: 375, height: 667 },
      hasTouch: false,
      isMobile: false,
    });

    test("a fine pointer still gets the game", async ({ page }) => {
      await page.goto("/arcade/laser-loon");
      await expect(
        page.getByRole("button", { name: /Launch Cabinet/i })
      ).toBeVisible();
      await expect(page.getByTestId("desktop-only-notice")).toBeHidden();
    });

    test("the arcade hub shows no phone badges", async ({ page }) => {
      await page.goto("/arcade");
      await expect(page.locator(BADGE).first()).toBeHidden();
    });
  });
});
