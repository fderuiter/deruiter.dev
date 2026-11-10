import { expect, test, type Page } from "@playwright/test";

/**
 * Visitor tasks for the change-and-see loop (#3162): pick the study, trace
 * one TLF number to its source rows, and change a visit window to see what
 * moves downstream. Each task runs at the four widths of the layout matrix.
 * The pages run on synthetic data in the browser, with no third-party calls.
 */

const WIDTHS = [320, 375, 768, 1440] as const;

/** The first pipeline run on /study-data takes a few seconds in a worker. */
const RUN_TIMEOUT = 60_000;

/**
 * Elements that reach past the viewport's right edge, skipping any inside a
 * container that clips or scrolls horizontally. Same check as
 * `__tests__/e2e/visual.spec.ts`.
 */
function findOverflowingElements(page: Page) {
  return page.evaluate(() => {
    const clientWidth = document.documentElement.clientWidth;
    const bad: { tag: string; className: string; right: number }[] = [];
    document.querySelectorAll("*").forEach((el) => {
      let parent = el.parentElement;
      while (
        parent &&
        parent !== document.body &&
        parent !== document.documentElement
      ) {
        const style = window.getComputedStyle(parent);
        if (
          ["hidden", "auto", "scroll", "clip"].includes(style.overflowX) ||
          style.overflow === "hidden" ||
          style.overflow === "clip"
        ) {
          return;
        }
        parent = parent.parentElement;
      }
      const rect = el.getBoundingClientRect();
      if (rect.right > clientWidth + 1) {
        bad.push({
          tag: el.tagName.toLowerCase(),
          className:
            typeof el.className === "string" ? el.className.slice(0, 50) : "",
          right: Math.round(rect.right),
        });
      }
    });
    return bad;
  });
}

async function expectNoHorizontalScroll(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    )
  ).toBe(false);
  expect(await findOverflowingElements(page)).toEqual([]);
}

async function openStudyData(page: Page) {
  await page.goto("/study-data");
  await expect(page.getByText(/^Run 1: 90 subjects, seed 301/)).toBeVisible({
    timeout: RUN_TIMEOUT,
  });
}

for (const width of WIDTHS) {
  test.describe(`clinical product tasks at ${width}px`, () => {
    test.beforeEach(async ({ page }, testInfo) => {
      test.skip(
        testInfo.project.name !== "chromium",
        "The width matrix runs in desktop Chromium; each block sets its own viewport."
      );
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.setViewportSize({ width, height: 900 });
    });

    test("picks DEMO-301 and sees its summary", async ({ page }) => {
      await page.goto("/clinical");
      const picker = page.getByTestId("study-picker");
      const select = picker.getByLabel("Study");

      await expect(async () => {
        await select.selectOption("DEMO-301");
        await expect(select).toHaveValue("DEMO-301", { timeout: 1_500 });
      }).toPass({ timeout: 15_000 });

      const summary = page.getByTestId("study-picker-summary");
      await expect(summary).toContainText("Study of Demoxacin");
      await expect(summary).toContainText(/\d+ forms? · /);
      await expect(summary).toContainText(/\d+ TLFs?/);
      await expectNoHorizontalScroll(page);
    });

    test("traces the first TLF number to a source row", async ({ page }) => {
      await openStudyData(page);
      const path = page.getByTestId("trace-number-path");

      await expect(async () => {
        await page.getByRole("tab", { name: "Trace a number" }).click();
        await expect(path).toBeVisible({ timeout: 1_500 });
      }).toPass({ timeout: 15_000 });

      await expect(async () => {
        await path
          .getByRole("list", { name: "Numbers in this table" })
          .getByRole("button")
          .first()
          .click();
        await expect(path.getByText("Step 2 of 3")).toBeVisible({
          timeout: 1_500,
        });
      }).toPass({ timeout: 15_000 });

      await expect(
        path.getByTestId("trace-path-ADaM").getByRole("listitem").first()
      ).toBeVisible({ timeout: 30_000 });
      await expect(
        path.getByTestId("trace-path-SDTM").getByRole("listitem").first()
      ).toBeVisible();
      await expectNoHorizontalScroll(page);
    });

    test("widens a visit window by 10 days and sees the diff", async ({
      page,
    }) => {
      await openStudyData(page);
      const input = page
        .getByTestId("sandbox-edit-panel")
        .getByLabel(/^Days allowed after /);
      const current = Number(await input.inputValue());
      expect(Number.isInteger(current)).toBe(true);
      await input.fill(String(current + 10));
      await expect(
        page.getByTestId("sandbox-edit-panel").getByRole("alert")
      ).toHaveCount(0);

      await expect(async () => {
        await page
          .getByRole("button", { name: "Rerun with this window" })
          .click();
        await expect(page.getByText(/^Run 2: /)).toBeVisible({
          timeout: 2_000,
        });
      }).toPass({ timeout: 15_000 });

      const diff = page.getByTestId("run-diff-panel");
      await expect(diff).toBeVisible({ timeout: RUN_TIMEOUT });
      await expect(diff).not.toContainText("No change from the last run.");
      await expect(diff.getByRole("listitem").first()).toBeVisible();
      await expectNoHorizontalScroll(page);
    });
  });
}
