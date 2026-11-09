import { expect, test, type Page } from "@playwright/test";

/**
 * Measures the clinical pages named in #3146 at 375 px (#3386): does the
 * journey strip (`ClinicalJourneyNav`) sit above the page heading, and does
 * the page also render the next/previous navigator (`NextPrevNav`), which
 * would give it two competing "what next" controls?
 *
 * The spec records what it finds rather than asserting a design, because
 * #3146 decides the fix from these numbers. It fails only when a page cannot
 * be measured: no journey strip, no heading, or horizontal overflow.
 */

const PAGES = ["/study-data", "/platform", "/protocol-drift", "/crf"] as const;

/** `NextPrevNav` has no landmark; its default link labels identify it. */
const NEXT_PREV_LABEL = /^(Previous|Next) Experience$/i;

interface LayoutReading {
  readonly page: string;
  readonly stripTop: number;
  readonly headingTop: number;
  readonly stripAboveHeading: boolean;
  readonly nextPrevControls: number;
  readonly bothControlsPresent: boolean;
}

async function readLayout(page: Page, path: string): Promise<LayoutReading> {
  const strip = page.getByRole("navigation", { name: "Clinical data journey" });
  const heading = page.locator("main h1").first();
  let stripTop = Number.NaN;
  let headingTop = Number.NaN;
  let nextPrevControls = 0;

  await expect(async () => {
    await expect(strip).toBeVisible();
    await expect(heading).toBeAttached();
    stripTop = await strip.evaluate((el) => el.getBoundingClientRect().top);
    headingTop = await heading.evaluate((el) => el.getBoundingClientRect().top);
    nextPrevControls = await page
      .locator("main a span")
      .filter({ hasText: NEXT_PREV_LABEL })
      .count();
    expect(Number.isFinite(stripTop)).toBe(true);
    expect(Number.isFinite(headingTop)).toBe(true);
  }).toPass({ timeout: 15_000 });

  return {
    page: path,
    stripTop: Math.round(stripTop),
    headingTop: Math.round(headingTop),
    stripAboveHeading: stripTop < headingTop,
    nextPrevControls,
    bothControlsPresent: nextPrevControls > 0,
  };
}

test.describe("clinical journey strip against the H1 at 375 px (#3386)", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  for (const path of PAGES) {
    test(`measures ${path}`, async ({ page }, testInfo) => {
      test.setTimeout(90_000);
      await page.emulateMedia({ reducedMotion: "reduce" });
      const response = await page.goto(path, { waitUntil: "load" });
      expect(response?.status() ?? 0).toBeLessThan(400);

      const reading = await readLayout(page, path);
      await testInfo.attach(`layout${path.replaceAll("/", "-")}.json`, {
        body: JSON.stringify(reading, null, 2),
        contentType: "application/json",
      });
      console.log(`[journey-layout] ${JSON.stringify(reading)}`);

      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth + 1
      );
      expect(overflow, `${path} scrolls sideways at 375 px`).toBe(false);
    });
  }
});
