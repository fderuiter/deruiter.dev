import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { settleFooterTicker } from "./helpers/footer-ticker";

/**
 * Real-browser checks for /platform/portfolio (#2911): the whole page at
 * the four widths of the layout matrix, with zero critical, serious or
 * moderate axe violations and no horizontal overflow, and the milestone
 * swimlane read with the keyboard and with a pointer.
 */

const WIDTHS = [320, 375, 768, 1440] as const;

/** Waits until the worker has drawn the dashboard. */
async function settled(page: Page) {
  await expect(
    page.getByRole("heading", {
      level: 2,
      name: "Milestones across the portfolio",
    })
  ).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("portfolio-swimlane")).toBeVisible();
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
  test(`portfolio is accessible and contained at ${width}px`, async ({
    page,
  }, testInfo) => {
    test.slow();
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/platform/portfolio");
    await settled(page);

    // Open every calculation panel so its SQL is checked too.
    for (const summary of await page
      .locator("summary", { hasText: "is calculated" })
      .all()) {
      await summary.click();
    }
    expect(await overflowing(page)).toEqual([]);
    expect(await seriousViolations(page)).toEqual([]);

    const path = testInfo.outputPath(`portfolio-${width}.png`);
    await page.screenshot({ path, fullPage: true });
    await testInfo.attach(`portfolio-${width}`, {
      path,
      contentType: "image/png",
    });
  });
}

/** Presses Tab until the target has focus. */
async function tabTo(page: Page, target: Locator) {
  for (let presses = 0; presses < 120; presses++) {
    if (await target.evaluate((el) => el === document.activeElement)) return;
    await page.keyboard.press("Tab");
  }
  throw new Error("the target never took focus from the keyboard");
}

test("the swimlane reads each milestone with the keyboard", async ({
  page,
}) => {
  test.slow();
  await page.goto("/platform/portfolio");
  await settled(page);
  const chart = page.getByRole("group", { name: /^Milestone swimlane/ });
  await tabTo(page, chart);
  const live = chart.locator('[aria-live="polite"]');
  await page.keyboard.press("ArrowDown");
  await expect(live).toHaveText(
    "DEMO-101, Protocol final: reached 2025-01-06, planned 2025-01-06. On plan."
  );
  for (let i = 0; i < 5; i += 1) await page.keyboard.press("ArrowDown");
  for (let i = 0; i < 5; i += 1) await page.keyboard.press("ArrowRight");
  await expect(live).toHaveText(
    "DEMO-302, Last patient in: planned 2026-06-14. 108 days overdue."
  );
});

test("hovering a milestone shows its dates", async ({ page }) => {
  test.slow();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/platform/portfolio");
  await settled(page);
  const swimlane = page.getByTestId("portfolio-swimlane");
  const box = (await swimlane.boundingBox())!;
  // The middle of the first lane, 56 of the chart's 360 units down, at its
  // left end: DEMO-101's protocol final.
  await page.mouse.move(
    box.x + box.width * 0.2,
    box.y + (box.height * 56) / 360
  );
  const readout = page.locator("div.pointer-events-none", {
    hasText: "Planned",
  });
  await expect(readout).toContainText("DEMO-101");
  await expect(readout).toContainText("Actual");
});

test("the finance section forecasts each study's cost at completion", async ({
  page,
}) => {
  test.slow();
  await page.goto("/platform/portfolio");
  await settled(page);
  const finance = page.locator("section", {
    has: page.getByRole("heading", {
      level: 2,
      name: "Budget against forecast at completion",
    }),
  });
  await expect(finance).toContainText("Forecast to overrun: DEMO-302");
  await expect(
    page.getByRole("heading", {
      level: 2,
      name: "Budget, actual and forecast at completion by vendor",
    })
  ).toBeVisible();
});
