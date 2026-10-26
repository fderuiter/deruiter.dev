import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { settleFooterTicker } from "./helpers/footer-ticker";

/**
 * Real-browser checks for /platform/governance (#2638, #2636): the page at
 * the four widths of the layout matrix, with zero critical, serious or
 * moderate axe violations and no horizontal overflow, the catalog's search
 * and filters, a link to an entry the filters hide, and a link from the
 * data quality issue log to a rule in a closed group.
 */

const WIDTHS = [320, 375, 768, 1440] as const;

/** Elements that stick out of the viewport, outside any scroll container. */
function overflowing(page: Page) {
  return page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    return [...document.querySelectorAll("main *")]
      .filter((element) => {
        let parent = element.parentElement;
        while (parent && parent !== document.body) {
          if (
            ["auto", "scroll", "hidden", "clip"].includes(
              getComputedStyle(parent).overflowX
            )
          )
            return false;
          parent = parent.parentElement;
        }
        return element.getBoundingClientRect().right > width + 1;
      })
      .map((element) => element.tagName.toLowerCase());
  });
}

async function seriousViolations(page: Page) {
  // The footer ticker's cross-fade would read as a contrast failure (#952).
  await settleFooterTicker(page);
  const audit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  return audit.violations
    .filter((v) => ["critical", "serious", "moderate"].includes(v.impact ?? ""))
    .map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) }));
}

/** A catalog entry's card, by its id. */
const entry = (page: Page, id: string) => page.locator(`[id="catalog-${id}"]`);

for (const width of WIDTHS) {
  test(`governance page is accessible and contained at ${width}px`, async ({
    page,
  }, testInfo) => {
    test.slow();
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/platform/governance");
    await expect(
      page.getByRole("heading", { level: 1, name: "Govern the data" })
    ).toBeVisible();
    // A product's and a metric's details open, so both are checked too.
    await entry(page, "silver.edc_visit").locator("summary").click();
    await entry(page, "subjects_screened").locator("summary").click();
    expect(await overflowing(page)).toEqual([]);
    expect(await seriousViolations(page)).toEqual([]);

    const path = testInfo.outputPath(`governance-${width}.png`);
    await page.screenshot({ path, fullPage: true });
    await testInfo.attach(`governance-${width}`, {
      path,
      contentType: "image/png",
    });
  });
}

test("the catalog searches, filters and still lands a link the filters hide", async ({
  page,
}) => {
  test.slow();
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto("/platform/governance");
  const search = page.getByRole("searchbox", { name: "Search the catalog" });
  // Typing before hydration would be lost, so retry until the count moves.
  await expect(async () => {
    await search.fill("");
    await search.fill("enrollment");
    await expect(page.getByText(/^\d+ of 94 entries$/)).toBeVisible({
      timeout: 1_000,
    });
  }).toPass({ timeout: 15_000 });

  const kind = page.getByRole("group", { name: "Kind", exact: true });
  await kind.getByRole("checkbox", { name: /^Metrics/ }).check();
  await expect(entry(page, "gold.fct_enrollment")).toHaveCount(0);
  // Subjects enrolled reads the enrollment fact the filter now hides.
  const enrolled = entry(page, "subjects_enrolled");
  await expect(enrolled).toBeVisible();

  await enrolled.locator("summary").click();
  await enrolled.locator('a[href="#catalog-gold.fct_enrollment"]').click();
  const product = entry(page, "gold.fct_enrollment");
  await expect(product).toBeVisible();
  await expect(product).toBeFocused();
  await expect(search).toHaveValue("");
  await expect(page.getByText("94 entries", { exact: true })).toBeVisible();

  // The metric's glossary term is on the same page.
  await enrolled.getByRole("link", { name: "Enrollment", exact: true }).click();
  await expect(page).toHaveURL(/#glossary-enrollment-term$/);
  await expect(
    page.locator('[id="glossary-enrollment-term"]')
  ).toBeInViewport();
});

test("an issue's rule link opens the closed group the rule is in", async ({
  page,
}) => {
  test.slow();
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto("/platform/governance");
  const rule = page.locator('[id="dq-rule-DQ-K04"]');
  const group = page.locator("details", { has: rule });
  await expect(group).not.toHaveAttribute("open");
  // DQI-004's rule passes today, so its Consistency group starts closed.
  const link = page
    .locator('[id="dq-issue-DQI-004"]')
    .locator('a[href="#dq-rule-DQ-K04"]');
  // A click before hydration lands without the listener, so retry.
  await expect(async () => {
    await page.evaluate(() => history.replaceState(null, "", "#quality"));
    await link.click();
    await expect(rule).toBeInViewport({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
  await expect(group).toHaveAttribute("open", "");
  await expect(rule).toContainText("Passed");
});
