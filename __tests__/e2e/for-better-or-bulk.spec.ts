import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/** Eight times the clock, so a whole level fits in an end-to-end test. */
const ROUTE = "/arcade/for-better-or-bulk?speed=8";
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const BLOCKING = new Set(["critical", "serious", "moderate"]);

async function openPlan(page: Page) {
  await page.goto(ROUTE, { waitUntil: "domcontentloaded" });
  await expect(async () => {
    const launch = page.getByRole("button", { name: /Launch Cabinet/i });
    if (await launch.isVisible()) await launch.click();
    await expect(page.getByTestId("fbb-setup")).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 30000 });
}

/**
 * axe on the game only, so the checks cover what this game renders. Running
 * CSS animations are finished first: a scene fading in is measured at its
 * final colours, not part-way through the fade.
 */
async function expectNoBlockingViolations(page: Page, state: string) {
  await page.evaluate(() => {
    for (const animation of document.getAnimations()) {
      const { iterations } = animation.effect?.getTiming() ?? {};
      if (iterations !== Infinity) animation.finish();
    }
  });
  const results = await new AxeBuilder({ page })
    .include("[data-fbb-cabinet]")
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

/**
 * Plays a whole level by keyboard, through the brothers' text, until the
 * ceremony playback is on screen. The playback runs for a few seconds at
 * this speed, so callers act on it straight away.
 */
async function playToPlayback(page: Page) {
  await openPlan(page);
  await expectNoBlockingViolations(page, "plan screen");

  await page.getByRole("button", { name: "Start setup" }).click();
  const game = page.getByTestId("fbb-game");
  await expect(page.getByTestId("fbb-canvas")).toBeVisible();
  await expect(page.getByTestId("fbb-clock")).not.toHaveText("9:00", {
    timeout: 10000,
  });
  await expectNoBlockingViolations(page, "venue");

  // Abbi walks left to the lantern crate and takes one.
  await game.focus();
  const prompt = page.getByTestId("fbb-prompt-abbi");
  await page.keyboard.down("ArrowLeft");
  await expect(prompt).toContainText("Take a paper lantern", {
    timeout: 10000,
  });
  await page.keyboard.up("ArrowLeft");
  await page.keyboard.press("Enter");
  await expect(prompt).toContainText("carrying a paper lantern");

  // Tab hands the keyboard to Fred.
  await page.keyboard.press("Tab");
  await expect(page.getByTestId("fbb-active")).toContainText("Fred");

  const dialog = page.getByRole("dialog", {
    name: "Text from Fred's brothers",
  });
  await expect(dialog).toBeVisible({ timeout: 30000 });
  await expectNoBlockingViolations(page, "brothers' text");
  await page.keyboard.press("Enter");
  await expect(dialog).toBeHidden();

  await expect(page.getByTestId("fbb-playback")).toBeVisible({
    timeout: 60000,
  });
}

/**
 * Skips the ceremony playback to the receipt. The click is retried until the
 * playback is gone.
 */
async function skipPlaybackToReceipt(page: Page) {
  await expect(async () => {
    const skip = page.getByRole("button", { name: "Skip" });
    if (await skip.isVisible()) await skip.click();
    await expect(page.getByTestId("fbb-playback")).toBeHidden({
      timeout: 2000,
    });
  }).toPass({ timeout: 15000 });
  await expect(page.getByTestId("fbb-receipt")).toBeVisible({
    timeout: 10000,
  });
}

/**
 * The receipt title must sit below the fixed navbar, not under it. The
 * navbar's padding changes as the page scrolls, so both boxes are polled until
 * the scroll has settled.
 */
async function expectTitleBelowBanner(page: Page) {
  await expect
    .poll(
      async () => {
        const title = await page.getByTestId("fbb-title").boundingBox();
        const banner = await page.getByRole("banner").first().boundingBox();
        if (!title || !banner) return -1;
        return title.y - (banner.y + banner.height);
      },
      { timeout: 10000 }
    )
    .toBeGreaterThanOrEqual(0);
}

test.describe("For Better or Bulk (/arcade/for-better-or-bulk)", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("plays a whole level by keyboard, skips the playback and reaches the receipt", async ({
    page,
  }) => {
    test.setTimeout(120000);
    await playToPlayback(page);
    await expectNoBlockingViolations(page, "ceremony playback");

    await skipPlaybackToReceipt(page);
    await expect(page.getByTestId("fbb-title")).toBeFocused();
    await expect(page.getByTestId("fbb-follow-through")).toContainText(
      "Kept. Fred stayed"
    );
    await expectTitleBelowBanner(page);
    await expectNoBlockingViolations(page, "receipt");
  });

  test.describe("a taller desktop window", () => {
    test.use({ viewport: { width: 1440, height: 1000 } });

    test("the receipt title clears the navbar once the receipt is reached", async ({
      page,
    }) => {
      test.setTimeout(120000);
      await playToPlayback(page);
      await skipPlaybackToReceipt(page);
      await expectTitleBelowBanner(page);
    });
  });

  test("Escape skips the playback to the receipt once", async ({ page }) => {
    test.setTimeout(120000);
    await playToPlayback(page);

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("fbb-receipt")).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByTestId("fbb-playback")).toBeHidden();
    await expect(page.getByTestId("fbb-title")).toBeFocused();
  });

  test("pauses with Escape and keeps the clock still", async ({ page }) => {
    await openPlan(page);
    await page.getByRole("button", { name: "Start setup" }).click();
    await page.getByTestId("fbb-game").focus();
    await page.keyboard.press("Escape");
    await expect(page.getByText(/^Paused at/)).toBeVisible();
    const clock = page.getByTestId("fbb-clock");
    const before = await clock.textContent();
    await page.waitForTimeout(1500);
    await expect(clock).toHaveText(before ?? "");
  });
});
