import { expect, test } from "@playwright/test";

// #3147: three tasks a first-time visitor should manage on the clinical
// pages, checked at each layout width with role and visible-text locators
// only. Fred's moderated user tests (#2681) stay separate.

const CLINICAL_HEADING = "Clinical data, end to end";
const START_HERE = "Start here";
// Step 1 of CLINICAL_JOURNEY in lib/clinical-journey.ts.
const STEP_ONE_LINK = "Open step 1: Case report form designer (CRF Studio)";
const STEP_ONE_PATH = "/crf";
const LINEAGE_HEADING = "Lineage explorer";
const TRACE_EXAMPLE = "Trace an example: the Week 12 mean, Placebo";
const LINEAGE_LEVELS = [
  "Study definition",
  "Collected",
  "SDTM",
  "ADaM",
  "Results",
];

for (const width of [320, 375, 768, 1440]) {
  test.describe(`clinical visitor tasks at ${width}px`, () => {
    test.use({ viewport: { width, height: 800 } });

    test("finds where the study is explained", async ({ page }) => {
      await page.goto("/clinical");
      await expect(
        page.getByRole("heading", { level: 1, name: CLINICAL_HEADING })
      ).toBeVisible();
      const startHere = page.getByRole("complementary", { name: START_HERE });
      await expect(startHere).toBeVisible();
      await expect(
        startHere.getByRole("link", { name: STEP_ONE_LINK })
      ).toBeVisible();
    });

    test("reads where a table value came from", async ({ page }) => {
      test.slow();
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("/study-data");
      // The page runs the default study once on load.
      await expect(page.getByText(/^Run 1: 90 subjects, seed 301/)).toBeVisible(
        { timeout: 60_000 }
      );
      const lineage = page.getByRole("region", { name: LINEAGE_HEADING });
      await expect(async () => {
        await lineage.getByRole("button", { name: TRACE_EXAMPLE }).click();
        await expect(lineage.getByRole("status")).toContainText(
          "Table 14.2.1 · Week 12",
          { timeout: 5_000 }
        );
      }).toPass({ timeout: 15_000 });
      for (const level of LINEAGE_LEVELS) {
        await expect(
          lineage.getByRole("heading", {
            level: 3,
            name: new RegExp(`^${level}`),
          })
        ).toBeVisible();
      }
      // The source records name the collected domain they came from.
      await expect(
        lineage.getByRole("button", {
          name: /^Trace forward: VS .*Vital signs/i,
        })
      ).toBeVisible();
    });

    test("follows Start here to step 1 of the journey", async ({ page }) => {
      await page.goto("/clinical");
      const link = page
        .getByRole("complementary", { name: START_HERE })
        .getByRole("link", { name: STEP_ONE_LINK });
      await expect(async () => {
        await link.click();
        await expect(page).toHaveURL(new RegExp(`${STEP_ONE_PATH}/?$`), {
          timeout: 5_000,
        });
      }).toPass({ timeout: 15_000 });
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    });
  });
}
