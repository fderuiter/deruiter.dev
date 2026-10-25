import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { settleFooterTicker } from "./helpers/footer-ticker";

/**
 * Real-browser checks for /platform/operations (#2648): every section of
 * every drill-down level, at the four widths of the layout matrix, with
 * zero critical, serious or moderate axe violations and no horizontal
 * overflow, plus a drill-down walked with the keyboard alone.
 */

/** One scope per drill-down level, and the breadcrumb it ends on. */
const SCOPES = [
  { name: "portfolio", hash: "", current: "Portfolio" },
  // A CRO-run study, which also shows its milestones.
  { name: "study", hash: "study=DEMO-302", current: "DEMO-302" },
  { name: "country", hash: "study=DEMO-302&country=DE", current: "Germany" },
  {
    name: "site",
    hash: "study=DEMO-302&country=DE&site=DEMO-302-DE-103",
    current: "DEMO-302-DE-103",
  },
] as const;

const WIDTHS = [320, 375, 768, 1440] as const;

/** Waits until the worker has drawn the dashboard for a scope. */
async function settled(page: Page, current: string) {
  await expect(
    page
      .getByRole("navigation", { name: "Breadcrumb" })
      .locator('[aria-current="page"]')
  ).toHaveText(current, { timeout: 60_000 });
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, {
    timeout: 30_000,
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
  for (const scope of SCOPES) {
    test(`operations ${scope.name} is accessible and contained at ${width}px`, async ({
      page,
    }, testInfo) => {
      test.slow();
      await page.setViewportSize({ width, height: 900 });
      await page.goto(
        `/platform/operations${scope.hash ? `#${scope.hash}` : ""}`
      );
      await settled(page, scope.current);

      // The freshness table is folded away by default; open it so it is
      // checked too.
      await page.locator("summary", { hasText: "Data as of" }).click();

      const tabs = page
        .getByRole("tablist", { name: "Dashboard sections" })
        .getByRole("tab");
      const names = await tabs.allInnerTexts();
      expect(names.length).toBeGreaterThanOrEqual(4);
      for (const name of names) {
        await expect(async () => {
          await tabs.filter({ hasText: name }).click();
          await expect(page.getByRole("tab", { selected: true })).toHaveText(
            name,
            { timeout: 5_000 }
          );
        }).toPass({ timeout: 15_000 });
        await settled(page, scope.current);
        expect(await overflowing(page), `${name} overflows`).toEqual([]);
        expect(await seriousViolations(page), `${name} axe`).toEqual([]);
      }

      const path = testInfo.outputPath(`operations-${scope.name}-${width}.png`);
      await page.screenshot({ path, fullPage: true });
      await testInfo.attach(`operations-${scope.name}-${width}`, {
        path,
        contentType: "image/png",
      });
    });
  }
}

/** Presses Tab (or Shift+Tab) until the target has focus. */
async function tabTo(page: Page, target: Locator, backwards = false) {
  for (let presses = 0; presses < 120; presses++) {
    if (await target.evaluate((el) => el === document.activeElement)) return;
    await page.keyboard.press(backwards ? "Shift+Tab" : "Tab");
  }
  throw new Error("the target never took focus from the keyboard");
}

test("the drill-down works with the keyboard alone", async ({ page }) => {
  test.slow();
  await page.goto("/platform/operations");
  await settled(page, "Portfolio");
  const selected = page.getByRole("tab", { selected: true });

  // Tabs follow the WAI-ARIA pattern: one tab stop, arrows move the
  // selection, Home and End jump to the ends.
  await expect(async () => {
    await tabTo(page, selected);
    await page.keyboard.press("End");
    await expect(selected).toHaveText("Milestones", { timeout: 5_000 });
  }).toPass({ timeout: 15_000 });
  await page.keyboard.press("Home");
  await expect(selected).toHaveText("Enrollment");
  await page.keyboard.press("ArrowLeft");
  await expect(selected).toHaveText("Milestones");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(selected).toHaveText("Quality and monitoring");
  await expect(selected).toBeFocused();
  await expect(page).toHaveURL(/#view=quality$/);

  // The drill links come before the tabs, so walk back to them.
  const study = page
    .getByRole("navigation", { name: "Studies" })
    .getByRole("link", { name: /DEMO-302/ });
  await tabTo(page, study, true);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#study=DEMO-302&view=quality$/);
  await settled(page, "DEMO-302");

  const country = page
    .getByRole("navigation", { name: "Countries in DEMO-302" })
    .getByRole("link", { name: /Germany/ });
  await tabTo(page, country);
  await page.keyboard.press("Enter");
  await settled(page, "Germany");

  const site = page
    .getByRole("navigation", { name: "Sites in DEMO-302, Germany" })
    .getByRole("link")
    .first();
  await tabTo(page, site);
  await page.keyboard.press("Enter");
  const trail = page.getByRole("navigation", { name: "Breadcrumb" });
  await expect(trail.locator('[aria-current="page"]')).toHaveText(
    /^DEMO-302-DE-\d+$/,
    { timeout: 60_000 }
  );
  await expect(selected).toHaveText("Quality and monitoring");

  // The breadcrumb leads back up, still on the same section.
  const portfolio = trail.getByRole("link", { name: "Portfolio" });
  await tabTo(page, portfolio, true);
  await page.keyboard.press("Enter");
  await settled(page, "Portfolio");
  await expect(page).toHaveURL(/#view=quality$/);
  await expect(selected).toHaveText("Quality and monitoring");
});

test("the risk tab flags the planted site and drills into it (#2631)", async ({
  page,
}) => {
  test.slow();
  await page.goto("/platform/operations#study=DEMO-302&view=risk");
  await settled(page, "DEMO-302");
  await expect(page.getByRole("tab", { selected: true })).toHaveText("Risk");

  const kris = page.getByRole("table", {
    name: /^Key risk indicators for 36 sites/,
  });
  await expect(kris.getByRole("row")).toHaveCount(37);
  const csm = page.locator('section[aria-labelledby="risk-csm"]');
  await expect(
    csm.getByRole("listitem").filter({ hasText: "DEMO-302-BR-118 · " })
  ).toHaveCount(3);
  await expect(
    page.getByRole("table", { name: /risk signal log/ }).getByRole("row")
  ).toHaveCount(3);

  // A site row drills into that site and stays on the Risk tab.
  await expect(async () => {
    await kris.getByRole("link", { name: "DEMO-302-BR-118" }).click();
    await expect(page).toHaveURL(
      /#study=DEMO-302&country=BR&site=DEMO-302-BR-118&view=risk$/,
      { timeout: 5_000 }
    );
  }).toPass({ timeout: 15_000 });
  await settled(page, "DEMO-302-BR-118");
  await expect(page.getByRole("tab", { selected: true })).toHaveText("Risk");
  await expect(
    page
      .getByRole("table", { name: /^Key risk indicators for 1 site/ })
      .getByRole("row")
  ).toHaveCount(2);
  await expect(
    page.getByText(/A limit applies to the whole study/)
  ).toBeVisible();
});
