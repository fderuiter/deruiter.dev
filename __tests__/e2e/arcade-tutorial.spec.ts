import { test, expect, type Page } from "@playwright/test";

/**
 * #2972: a game's guided tutorial in a real browser. Laser Loon offers it
 * once on first launch, walks the player through the Sandbox with the keys
 * they will use, and hands back to the Campaign. The other specs start with
 * the offer already answered (playwright.config.ts); this one starts fresh.
 */
test.use({ storageState: { cookies: [], origins: [] } });

test.beforeEach(({}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium",
    "Keyboard walkthrough on desktop Chrome"
  );
});

const step = (page: Page) =>
  page.getByTestId("tutorial-card").getAttribute("data-tutorial-step");

async function launch(page: Page) {
  await page.goto("/arcade/laser-loon");
  await expect(async () => {
    await page.getByRole("button", { name: /Launch Cabinet/i }).click();
    await expect(page.locator("[data-keyboard-boundary]")).toBeVisible({
      timeout: 2000,
    });
  }).toPass({ timeout: 30000 });
}

test.describe("Laser Loon guided tutorial", () => {
  test("is offered once, teaches by doing, and returns to the Campaign", async ({
    page,
  }) => {
    await launch(page);
    const start = page.getByRole("button", { name: "Start the tutorial" });
    await expect(start).toBeFocused();
    await page.keyboard.press("Enter");

    await expect.poll(() => step(page)).toBe("welcome");
    await expect(page.getByRole("button", { name: "Next" })).toBeFocused();
    await page.keyboard.press("Enter");

    // Practice: the game's own keys complete the step.
    await expect.poll(() => step(page)).toBe("move");
    await expect(page.locator("[data-keyboard-boundary]")).toBeFocused();
    for (const key of ["ArrowUp", "ArrowDown", "ArrowUp"]) {
      await page.keyboard.press(key);
    }
    await expect.poll(() => step(page)).toBe("fire");
    await page.keyboard.down(" ");
    await expect.poll(() => step(page)).toBe("kill");
    await page.keyboard.up(" ");

    // Every practice can be skipped.
    for (const id of ["kill", "optic", "crit"]) {
      await expect.poll(() => step(page)).toBe(id);
      await page.getByRole("button", { name: "Skip this step" }).click();
    }
    await expect.poll(() => step(page)).toBe("ultimate");
    await page.keyboard.press("u");

    await expect.poll(() => step(page)).toBe("survive");
    await page.keyboard.press("Enter");
    await expect.poll(() => step(page)).toBe("modes");
    await page.getByRole("button", { name: "Finish" }).click();

    const finished = page.getByTestId("tutorial-finished");
    await expect(finished).toContainText("You skipped 3 practice steps");
    await page.getByRole("button", { name: "Start playing" }).click();
    await expect(
      page.getByRole("button", { name: /Start Campaign/i })
    ).toBeVisible();

    // Finished on this device: the next launch goes straight to the game,
    // and the Tutorial key replays it.
    await page.reload();
    await launch(page);
    await expect(page.getByTestId("tutorial-offer")).toHaveCount(0);
    await page.getByTestId("cabinet-tutorial-key").click();
    await expect.poll(() => step(page)).toBe("welcome");
  });

  test("can be turned down, and stays turned down", async ({ page }) => {
    await launch(page);
    await page.getByRole("button", { name: "Skip, just play" }).click();
    await expect(page.getByTestId("tutorial-offer")).toHaveCount(0);
    await page.reload();
    await launch(page);
    await expect(page.locator("[data-keyboard-boundary]")).toBeVisible();
    await expect(page.getByTestId("tutorial-offer")).toHaveCount(0);
  });
});
