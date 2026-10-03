import { test, expect, type Locator, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
import path from "node:path";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const BLOCKING = new Set(["critical", "serious", "moderate"]);
/** Where screenshots go when SD_SCREENSHOT_DIR is set; otherwise none. */
const SHOTS = process.env.SD_SCREENSHOT_DIR;

async function launchWorld(page: Page) {
  await page.goto("/arcade/study-director#mode=world");
  await page.waitForLoadState("domcontentloaded");
  await expect(async () => {
    await page.getByRole("button", { name: /Launch Cabinet/i }).click();
    await expect(page.getByTestId("world-hud")).toBeVisible({
      timeout: 2000,
    });
  }).toPass({ timeout: 15000 });
}

async function expectNoBlockingViolations(page: Page, state: string) {
  const results = await new AxeBuilder({ page })
    .include("[data-sd-world]")
    .withTags(WCAG_TAGS)
    .analyze();
  const blocking = results.violations
    .filter((v) => BLOCKING.has(v.impact ?? ""))
    .map(
      (v) =>
        `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`
    );
  expect(blocking, `axe violations on the ${state}`).toEqual([]);
}

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  // The site's fixed navbar would be stitched over the world; hide it.
  await page.locator("[data-sd-world]").screenshot({
    path: path.join(SHOTS, `${name}.png`),
    style: "header.fixed { display: none !important; }",
  });
}

/** Presses Tab until the control has focus, as a keyboard user would. */
async function tabTo(page: Page, control: Locator) {
  for (let i = 0; i < 80; i += 1) {
    await page.keyboard.press("Tab");
    if (await control.evaluate((el) => el === document.activeElement)) return;
  }
  throw new Error("Could not reach the control with Tab");
}

/** Chooses a directory entry with the keyboard and waits for the walk. */
async function walkTo(page: Page, name: RegExp, facing: RegExp) {
  await tabTo(page, page.getByRole("button", { name }));
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("world-room")).toContainText(facing, {
    timeout: 15000,
  });
  await expect(page.getByTestId("world-playfield")).toBeFocused();
}

test.describe("Study Director site visits (/arcade/study-director#mode=world)", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("drives to a site, checks source and writes it up from the keyboard alone", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await launchWorld(page);
    await page.getByTestId("world-playfield").focus();

    await walkTo(page, /Walk to Your car/, /You are facing the Your car/);
    await page.keyboard.press("e");
    const car = page.getByTestId("world-outcome");
    await expect(car.getByRole("button", { name: "Go home" })).toBeVisible();
    await tabTo(page, car.getByRole("button", { name: /Drive to Site 02/ }));
    await page.keyboard.press("Enter");

    await expect(
      page.getByRole("heading", { level: 2, name: /Site 02 visit/ })
    ).toBeVisible();
    await expect(page.getByTestId("world-room")).toContainText(
      "Site 02 car park"
    );
    await expect(
      page.getByRole("navigation", { name: "Site directory" })
    ).toBeVisible();
    await expectNoBlockingViolations(page, "site arrival");
    await shot(page, "site-visit-arrival-1280");

    await walkTo(
      page,
      /Walk to Source documents/,
      /You are facing the Source documents/
    );
    await page.keyboard.press("e");
    const check = page.getByRole("button", {
      name: "Review source documents, 90 minutes",
    });
    await tabTo(page, check);
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("world-outcome")).toContainText(
      "You learned: Meticulous"
    );
    await expect(page.getByTestId("site-visit")).toContainText(
      "Learned: Meticulous"
    );
    await expectNoBlockingViolations(page, "site check");
    await shot(page, "site-visit-check-1280");

    await walkTo(page, /Walk to Your car/, /You are facing the Your car/);
    await page.keyboard.press("e");
    await tabTo(
      page,
      page.getByRole("button", { name: /Drive back to the office/ })
    );
    await page.keyboard.press("Enter");
    const report = page.getByTestId("site-report");
    await expect(report).toContainText("Site 02 visit write-up");
    await expect(
      page.getByRole("heading", { level: 2, name: /The CRO floor/ })
    ).toBeVisible();
    await expectNoBlockingViolations(page, "visit write-up");
    await shot(page, "site-visit-writeup-1280");

    // Nothing may spill sideways at 1280.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("names what a quiet site's dashboard was hiding", async ({ page }) => {
    test.setTimeout(90_000);
    await launchWorld(page);
    // Fast-forward the saved run to mid-study, with Site 03 quietly in trouble.
    await page.evaluate(() => {
      const key = "study_director_world_v1";
      const world = JSON.parse(localStorage.getItem(key) ?? "{}");
      world.study.day = 30;
      world.minute = 9 * 60;
      world.study.sites = world.study.sites.map((s: Record<string, unknown>) =>
        s.id === "site-03"
          ? {
              ...s,
              enrolled: 10,
              deviations: 4,
              unsignedSource: 7,
              eligibilityConcerns: 2,
              openQueries: 9,
              trainingCurrent: false,
            }
          : s
      );
      localStorage.setItem(key, JSON.stringify(world));
    });
    await page.reload();
    await launchWorld(page);
    await page.getByTestId("world-playfield").focus();

    await walkTo(page, /Walk to Your car/, /You are facing the Your car/);
    await page.keyboard.press("e");
    await tabTo(page, page.getByRole("button", { name: /Drive to Site 03/ }));
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("heading", { level: 2, name: /Site 03 visit/ })
    ).toBeVisible();

    for (const [name, check] of [
      ["Source documents", "Review source documents, 90 minutes"],
      ["Screening log", "Check eligibility, 60 minutes"],
      ["Coordinator Tom Reyes", "Interview the coordinator, 30 minutes"],
    ] as const) {
      await walkTo(
        page,
        new RegExp(`Walk to ${name}`),
        new RegExp(`You are facing the ${name}`)
      );
      await page.keyboard.press("e");
      await tabTo(page, page.getByRole("button", { name: check }));
      await page.keyboard.press("Enter");
      await expect(page.getByTestId("world-outcome")).toBeVisible();
    }
    await expect(page.getByTestId("site-visit")).toContainText(
      "Learned: Overstretched"
    );
    await expect(page.getByTestId("site-visit")).toContainText(
      "7 pages of source not signed"
    );
    await expectNoBlockingViolations(page, "troubled site");
    await shot(page, "site-03-visit-1280");

    await walkTo(page, /Walk to Your car/, /You are facing the Your car/);
    await page.keyboard.press("e");
    await tabTo(
      page,
      page.getByRole("button", { name: /Drive back to the office/ })
    );
    await page.keyboard.press("Enter");
    const report = page.getByTestId("site-report");
    await expect(report).toContainText(
      "Hidden by the dashboard: Unsigned source: 7. The dashboard showed 1."
    );
    await expect(report).toContainText("Questionable eligibility: 2");
    await expectNoBlockingViolations(page, "troubled write-up");
    await shot(page, "site-03-writeup-1280");
  });
});
