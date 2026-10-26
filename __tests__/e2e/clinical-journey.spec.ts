import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * The clinical data journey end to end (#2689): from the homepage into CRF
 * Studio, then step by step with the keyboard through Protocol Drift, the
 * Study Data Pipeline (with a download), the Clinical Data Platform and the
 * case study, and back again. Each step must stay contained and accessible
 * at a phone width and on the desktop.
 */

const STEPS = [
  { path: "/crf", next: "Protocol Drift" },
  { path: "/protocol-drift", next: "Study Data Pipeline" },
  { path: "/study-data", next: "Clinical Data Platform" },
  { path: "/platform", next: "Study Data Pipeline case study" },
  { path: "/case-studies/study-data-pipeline", next: null },
] as const;

function journeyNav(page: Page) {
  return page.getByRole("navigation", { name: "Clinical data journey" });
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

async function seriousNavViolations(page: Page) {
  const audit = await new AxeBuilder({ page })
    .include('nav[aria-label="Clinical data journey"]')
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  return audit.violations.filter((violation) =>
    ["critical", "serious", "moderate"].includes(violation.impact ?? "")
  );
}

for (const width of [320, 1440]) {
  test(`the clinical journey runs from form to portfolio by keyboard at ${width}px`, async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");

    const start = page.getByRole("link", {
      name: "Start the journey at CRF Studio",
    });
    await expect(async () => {
      await start.click();
      await expect(page).toHaveURL(/\/crf$/, { timeout: 5_000 });
    }).toPass({ timeout: 15_000 });

    for (const step of STEPS) {
      await expect(page).toHaveURL(new RegExp(`${step.path}$`));
      const nav = journeyNav(page);
      await expect(nav).toBeVisible();
      await expect(nav.locator('[aria-current="step"]')).toHaveCount(1);
      expect(await overflowingElements(page)).toEqual([]);
      expect(await seriousNavViolations(page)).toEqual([]);

      if (step.path === "/protocol-drift") {
        // Protocol Drift is a workbench, so its journey panel is compact and
        // the related game sits behind "About this step".
        await nav.getByRole("button", { name: /About this step/ }).click();
        await expect(
          nav.getByRole("link", { name: "Clinical Trial Chaos" })
        ).toHaveAttribute("href", "/arcade/clinical-chaos");
        await expect(nav.getByText(/\(Arcade game\)/)).toBeVisible();
      }

      if (step.path === "/study-data") {
        await expect(
          page.getByText(/^Run 1: 90 subjects, seed 301/)
        ).toBeVisible({ timeout: 60_000 });
        const [download] = await Promise.all([
          page.waitForEvent("download", { timeout: 60_000 }),
          page.getByRole("button", { name: "Datasets (.zip)" }).click(),
        ]);
        expect(download.suggestedFilename()).toMatch(/\.zip$/);
      }

      if (!step.next) {
        await expect(nav.getByText(/Next step/)).toHaveCount(0);
        break;
      }
      const next = nav.getByRole("link", {
        name: `Next step: ${step.next} →`,
      });
      await expect(async () => {
        await next.focus();
        await page.keyboard.press("Enter");
        await expect(page).not.toHaveURL(new RegExp(`${step.path}$`), {
          timeout: 5_000,
        });
      }).toPass({ timeout: 20_000 });
    }

    // The return path: the case study leads back to the platform. On a
    // phone the previous step sits in the folded step list (#2896).
    if (width < 640) {
      await journeyNav(page)
        .getByRole("button", { name: /All steps/ })
        .click();
      await journeyNav(page)
        .getByRole("link", {
          name: "4. Govern the portfolio: Clinical Data Platform",
        })
        .click();
    } else {
      await journeyNav(page)
        .getByRole("link", { name: "← Previous step: Clinical Data Platform" })
        .click();
    }
    await expect(page).toHaveURL(/\/platform$/);
    await expect(
      journeyNav(page).locator('[aria-current="step"]')
    ).toContainText("Clinical Data Platform");
  });
}

test("a related case study points back to the demo for its step", async ({
  page,
}) => {
  await page.goto("/case-studies/clinical-data-mapper");
  const nav = journeyNav(page);
  await expect(nav).toContainText("related to step 3");
  await nav
    .getByRole("link", { name: "Study Data Pipeline", exact: true })
    .click();
  await expect(page).toHaveURL(/\/study-data$/);
});
