import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const BLOCKING = new Set(["critical", "serious", "moderate"]);

async function launch(page: Page) {
  await page.goto("/arcade/study-director");
  await page.waitForLoadState("domcontentloaded");
  await expect(async () => {
    await page.getByRole("button", { name: /Launch Cabinet/i }).click();
    await expect(
      page.getByRole("button", { name: /Start the study/i })
    ).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 15000 });
}

/** axe on the game only, so the checks cover what this game renders. */
async function expectNoBlockingViolations(page: Page, state: string) {
  const results = await new AxeBuilder({ page })
    .include("[data-sd-desk]")
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

test.describe("Study Director (/arcade/study-director)", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("launches, answers a message, spends attention and ends the day", async ({
    page,
  }) => {
    await page.goto("/arcade/study-director");
    await page.waitForLoadState("domcontentloaded");

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    );
    expect(overflow).toBe(false);

    await expect(async () => {
      await page.getByRole("button", { name: /Launch Cabinet/i }).click();
      await expect(
        page.getByRole("button", { name: /Start the study/i })
      ).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 15000 });

    await page.getByRole("button", { name: /Start the study/i }).click();
    await expect(page.getByText(/Day 1 \/ 77/)).toBeVisible();

    await page.getByRole("button", { name: /Sure, we'll add them/ }).click();
    await expect(
      page.getByRole("img", { name: /4 of 5 attention left today/ })
    ).toBeVisible();

    await page.getByRole("button", { name: "End day" }).click();
    await expect(page.getByText(/Day 2 \/ 77/)).toBeVisible();
  });

  test("plays a day from the keyboard alone and passes axe on every screen", async ({
    page,
  }) => {
    test.setTimeout(120000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await launch(page);
    await expectNoBlockingViolations(page, "briefing");

    await page.getByRole("button", { name: /Start the study/i }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByText(/Day 1 \/ 77/)).toBeVisible();
    await expectNoBlockingViolations(page, "desk");

    await page.keyboard.press("?");
    const sheet = page.getByRole("dialog", { name: "Keyboard shortcuts" });
    await expect(sheet).toBeVisible();
    await expectNoBlockingViolations(page, "shortcut sheet");
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();

    await page.keyboard.press("d");
    await page.keyboard.press("1");
    await expect(
      page.getByRole("img", { name: /3 of 5 attention left today/ })
    ).toBeVisible();
    await expect(page.getByTestId("study-outcome")).toContainText("On file");

    await page.keyboard.press("e");
    await expect(page.getByText(/Day 2 \/ 77/)).toBeVisible();
    await expect(page.getByTestId("study-outcome")).toContainText(
      "Overnight report"
    );

    for (let i = 0; i < 150; i += 1) {
      if (await page.getByTestId("study-report").isVisible()) break;
      await page.keyboard.press("e");
    }
    await expect(page.getByTestId("study-report")).toBeVisible();
    await expectNoBlockingViolations(page, "closeout report");
  });
});
