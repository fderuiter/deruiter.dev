import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { settleFooterTicker } from "./helpers/footer-ticker";

/**
 * Real-browser checks for /platform/explore (#2634): the page at the four
 * widths of the layout matrix, with zero critical, serious or moderate axe
 * violations and no horizontal overflow, and an exploration built from the
 * controls, written to the link and opened again from it.
 */

const WIDTHS = [320, 375, 768, 1440] as const;

const heading = (page: Page, name: string) =>
  page.getByRole("heading", { level: 2, name });

/** Waits until the worker has drawn the starting exploration. */
async function settled(page: Page) {
  await expect(heading(page, "Subjects screened by study")).toBeVisible({
    timeout: 60_000,
  });
}

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

for (const width of WIDTHS) {
  test(`explorer is accessible and contained at ${width}px`, async ({
    page,
  }, testInfo) => {
    test.slow();
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/platform/explore");
    await settled(page);
    // A filter open with its values, and the calculation panel open, so
    // both are checked too.
    await page.getByLabel("Add a filter").selectOption("site");
    await expect(
      page.getByRole("group", { name: "Site", exact: true })
    ).toBeVisible();
    await page.locator("summary", { hasText: "is calculated" }).click();
    expect(await overflowing(page)).toEqual([]);
    expect(await seriousViolations(page)).toEqual([]);

    const path = testInfo.outputPath(`explore-${width}.png`);
    await page.screenshot({ path, fullPage: true });
    await testInfo.attach(`explore-${width}`, {
      path,
      contentType: "image/png",
    });
  });
}

test("an exploration built from the controls opens again from its link", async ({
  page,
}) => {
  test.slow();
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto("/platform/explore");
  await settled(page);

  await page.getByLabel("Add a dimension").selectOption("country");
  await expect(
    heading(page, "Subjects screened by study and country")
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Study: stop grouping by it" })
    .click();
  await expect(heading(page, "Subjects screened by country")).toBeVisible();

  await page.getByLabel("Add a filter").selectOption("study");
  const studies = page.getByRole("group", { name: "Study", exact: true });
  await studies.getByRole("checkbox", { name: "DEMO-302" }).check();
  await expect(studies).toContainText("1 of 8 chosen.");
  await page.getByRole("radio", { name: "Table" }).check();
  await expect(page.getByRole("region", { name: "Chart" })).toHaveCount(0);

  await expect(page).toHaveURL(
    /#metric=subjects_screened&by=country&in\.study=DEMO-302&visual=table$/
  );
  const rows = await page
    .getByRole("region", { name: "Subjects screened by country data" })
    .locator("tbody tr")
    .allTextContents();
  expect(rows.length).toBeGreaterThan(0);

  await page.reload();
  await expect(heading(page, "Subjects screened by country")).toBeVisible({
    timeout: 60_000,
  });
  expect(
    await page
      .getByRole("region", { name: "Subjects screened by country data" })
      .locator("tbody tr")
      .allTextContents()
  ).toEqual(rows);
  expect(
    await page
      .getByRole("group", { name: "Study", exact: true })
      .getByRole("checkbox", { name: "DEMO-302" })
      .isChecked()
  ).toBe(true);
});

test("a new metric is a step Back undoes", async ({ page }) => {
  test.slow();
  await page.goto("/platform/explore");
  await settled(page);
  await page.getByLabel("Metric").selectOption({ label: "Subjects enrolled" });
  await expect(heading(page, "Subjects enrolled by study")).toBeVisible();
  await page.goBack();
  await expect(heading(page, "Subjects screened by study")).toBeVisible();
});
