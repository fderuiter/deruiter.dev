import { test, expect } from "@playwright/test";

// ADR 0048: eight games show a desktop-only notice on phones and portrait
// tablets. Each case sets its own viewport and touch emulation so the spec
// means the same thing under every Playwright project.
const GATED = [
  "working-with-duck",
  "laser-loon",
  "quasi-puzzler",
  "garmin-watch",
  "clinical-chaos",
  "retro-labyrinth",
  "study-director",
];

// Protocol Drift is a simulator now (#1841) and keeps the same desktop-only gate.
const GATED_ROUTES = [
  ...GATED.map((slug) => `/arcade/${slug}`),
  "/protocol-drift",
];

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
      await expect(
        notice.getByRole("link", { name: /Meme Vault/i })
      ).toHaveAttribute("href", "/arcade/meme-vault");
    });

    test("the arcade hub marks desktop-only games", async ({
      page,
      browserName,
    }) => {
      test.skip(browserName === "firefox", "isMobile is unsupported");
      await page.goto("/arcade");
      await expect(page.getByText("Desktop only").first()).toBeVisible();
      await expect(
        page.getByText(/On a phone\? These games need a desktop/)
      ).toBeVisible();
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

    test("the arcade hub shows no desktop-only markers", async ({ page }) => {
      await page.goto("/arcade");
      await expect(page.getByText("Desktop only").first()).toBeHidden();
    });
  });
});
