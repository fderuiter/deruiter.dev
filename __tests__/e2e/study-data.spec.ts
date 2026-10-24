import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const RUN_TIMEOUT = 60_000;

async function waitForRun(page: Page) {
  await expect(page.getByText(/^Run 1: 90 subjects, seed 301/)).toBeVisible({
    timeout: RUN_TIMEOUT,
  });
}

async function overflowingElements(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    return [...document.querySelectorAll("main *")]
      .filter((element) => {
        // Content inside a horizontal scroll container is reachable by
        // scrolling that container; only the page itself must not overflow.
        let parent = element.parentElement;
        while (parent && parent.tagName !== "MAIN") {
          const { overflowX } = window.getComputedStyle(parent);
          if (overflowX === "auto" || overflowX === "scroll") return false;
          parent = parent.parentElement;
        }
        return element.getBoundingClientRect().right > viewportWidth + 1;
      })
      .map((element) => element.tagName.toLowerCase());
  });
}

async function seriousViolations(page: Page) {
  const audit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  return audit.violations.filter((violation) =>
    ["critical", "serious", "moderate"].includes(violation.impact ?? "")
  );
}

for (const width of [320, 375, 768, 1440]) {
  test(`study data pipeline is accessible and contained at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/study-data");

    await expect(
      page.getByRole("heading", { level: 1, name: "Study Data Pipeline" })
    ).toBeVisible();
    await waitForRun(page);
    await expect(
      page.getByRole("list", { name: "Pipeline stages" }).getByRole("listitem")
    ).toHaveCount(7);

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth
      )
    ).toBe(false);
    expect(await overflowingElements(page)).toEqual([]);
    expect(await seriousViolations(page)).toEqual([]);

    const screenshotPath = testInfo.outputPath(`study-data-${width}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    await testInfo.attach(`study-data-${width}`, {
      path: screenshotPath,
      contentType: "image/png",
    });
  });
}

test("a table cell traces back to the protocol, and the trace stays accessible", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/study-data");
  await waitForRun(page);

  const lineage = page.locator('section[aria-labelledby="lineage-title"]');
  await expect(async () => {
    await page
      .getByRole("button", {
        name: "Trace an example: the Week 12 mean, Placebo",
      })
      .click();
    await expect(lineage.getByRole("status")).toContainText(
      "Table 14.2.1 · Week 12",
      { timeout: 5_000 }
    );
  }).toPass({ timeout: 15_000 });

  await expect(
    page.getByRole("heading", { name: "Lineage explorer" })
  ).toBeFocused();
  await expect(
    lineage.getByRole("button", { name: /^Trace forward: VS .*Vital signs/i })
  ).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);

  // Keyboard: open the first table cell that shows a result and trace it.
  const grid = page.getByRole("grid").first();
  const cell = grid.locator("td[data-ars-results]").first();
  await cell.focus();
  await page.keyboard.press("Enter");
  await expect(lineage.getByRole("status")).toContainText("Tracing Table", {
    timeout: 15_000,
  });
  await expect(cell).toHaveAttribute("aria-selected", "true");
});
