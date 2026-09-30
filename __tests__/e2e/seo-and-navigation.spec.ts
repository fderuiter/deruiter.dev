import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { settleFooterTicker } from "./helpers/footer-ticker";

const ALL_FIRST_CLASS_ROUTES = [
  "/",
  "/arcade",
  "/arcade/laser-loon",
  "/work/laser-loon",
  "/arcade/quasi-puzzler",
  "/arcade/garmin-watch",
  "/arcade/clinical-chaos",
  "/arcade/retro-labyrinth",
  "/arcade/working-with-duck",
  "/proof",
  "/crf",
  "/neuro",
  "/stack",
  "/simulator",
  "/schedule",
  "/case-studies/clinical-data-mapper",
];

test.describe("SEO & Navigation Full-Spectrum Suite", () => {
  for (const route of ALL_FIRST_CLASS_ROUTES) {
    test(`Route '${route}' returns 200, valid SEO metadata, schemas, and footer`, async ({
      page,
    }) => {
      const response = await page.goto(route, {
        waitUntil: "domcontentloaded",
      });
      expect(response?.status()).toBe(200);

      // Verify Document Title
      const title = await page.title();
      expect(title.length).toBeGreaterThan(10);
      expect(title).toContain("Frederick de Ruiter");

      // Verify Meta Description
      const metaDescription = page.locator('meta[name="description"]');
      await expect(metaDescription).toHaveCount(1);
      const descContent = await metaDescription.getAttribute("content");
      expect(descContent && descContent.length > 20).toBe(true);

      // Verify OpenGraph tags
      const ogTitle = page.locator('meta[property="og:title"]');
      await expect(ogTitle).toHaveCount(1);

      const ogDesc = page.locator('meta[property="og:description"]');
      await expect(ogDesc).toHaveCount(1);

      // Verify Structured Data JSON-LD
      const jsonLdScripts = page.locator('script[type="application/ld+json"]');
      const jsonLdCount = await jsonLdScripts.count();
      expect(jsonLdCount).toBeGreaterThanOrEqual(1);

      // Verify Global Footer is mounted and visible
      const footer = page.locator("footer");
      await expect(footer).toBeVisible();

      // Check Footer links contain key pillars
      await expect(footer.locator('text="Explore the projects"')).toBeVisible();
      await expect(footer.locator('a[href="/arcade"]')).toBeVisible();
      await expect(footer.locator('a[href="/schedule"]')).toBeVisible();
    });
  }

  test("Breadcrumbs allow fluid hierarchical navigation", async ({ page }) => {
    await page.goto("/arcade/laser-loon", { waitUntil: "domcontentloaded" });

    const breadcrumbNav = page.locator('nav[aria-label="Breadcrumb"]');
    await expect(breadcrumbNav).toBeVisible();

    // Click 'Arcade Hub' in breadcrumbs
    await breadcrumbNav.locator('a[href="/arcade"]').click();
    await page.waitForURL("**/arcade");
    expect(page.url()).toContain("/arcade");
  });

  test("NextPrevNav on Case Studies navigates to adjacent study", async ({
    page,
  }) => {
    await page.goto("/case-studies/clinical-data-mapper", {
      waitUntil: "domcontentloaded",
    });

    const nextLink = page.locator('a:has-text("Next Case Study")').first();
    await nextLink.scrollIntoViewIfNeeded();
    await expect(nextLink).toBeVisible();
    await nextLink.click();

    await page.waitForURL(
      (url) =>
        url.pathname.startsWith("/case-studies/") &&
        !url.pathname.includes("clinical-data-mapper")
    );
    expect(page.url()).not.toContain("clinical-data-mapper");
  });

  test("Accessibility: Zero critical violations across core routes", async ({
    page,
  }) => {
    const criticalRoutes = [
      "/",
      "/arcade",
      "/proof",
      "/schedule",
      "/case-studies/clinical-data-mapper",
    ];

    test.setTimeout(90_000);

    // Entrance fades and the footer ticker cross-fade pass through partial
    // opacity, which axe measures as low contrast. Scan the settled page.
    await page.emulateMedia({ reducedMotion: "reduce" });

    for (const route of criticalRoutes) {
      await page.goto(route, { waitUntil: "load" });
      await settleFooterTicker(page);
      // Same settle routine as accessibility.spec.ts: stop CSS transitions
      // and let the entrance fades finish before scanning.
      await page.addStyleTag({
        content:
          "*, *::before, *::after { transition: none !important; animation: none !important; }",
      });
      // Framer entrance fades run as JS or Web Animations, which the style
      // tag can't stop: wait for every finite animation to finish, then for
      // no animated element to sit between hidden and fully shown.
      await page.evaluate(() =>
        Promise.all(
          document
            .getAnimations()
            .filter((a) => a.effect?.getComputedTiming().endTime !== Infinity)
            .map((a) => a.finished.catch(() => undefined))
        )
      );
      await page.waitForFunction(
        () =>
          Array.from(
            document.querySelectorAll<HTMLElement>('[style*="opacity"]')
          ).every((el) => {
            // Decorative SVG shapes (the mobile grid background) hold a fixed
            // fractional opacity and carry no text for axe to measure.
            if (el instanceof SVGElement) return true;
            const opacity = Number(el.style.opacity);
            return Number.isNaN(opacity) || opacity === 0 || opacity === 1;
          }),
        undefined,
        { timeout: 10_000 }
      );
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();

      const criticalViolations = accessibilityScanResults.violations.filter(
        (v) => v.impact === "critical" || v.impact === "serious"
      );

      expect(criticalViolations).toEqual([]);
    }
  });

  test("Redirect: Legacy /transparency permanently redirects to /proof", async ({
    page,
  }) => {
    await page.goto("/transparency");
    await page.waitForURL("**/proof");
    expect(page.url()).toContain("/proof");
  });
});
