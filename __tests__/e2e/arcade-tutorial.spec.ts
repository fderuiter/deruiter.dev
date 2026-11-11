import { test, expect, type Page } from "@playwright/test";

/**
 * #2972: a game's guided tutorial in a real browser. Laser Loon offers it
 * once on first launch, walks the player through the Sandbox with the keys
 * they will use, and hands back to the Campaign. Meme Vault (#3450) has no
 * cabinet, so it offers its tutorial over the sampler and walks it on a
 * desktop and a phone. The other specs start with the offer already
 * answered (playwright.config.ts); this one starts fresh.
 */
test.use({ storageState: { cookies: [], origins: [] } });

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
  test.beforeEach(({}, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium",
      "Keyboard walkthrough on desktop Chrome"
    );
  });

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

    // Every practice can be skipped. A shot already in flight can still
    // down a flag or land a weakness hit, completing a step on its own just
    // as Skip is pressed (#3026), so each press skips whichever practice is
    // showing and the count of presses is what the closing card reports.
    const order = ["kill", "optic", "crit", "ultimate"];
    const at = async () => order.indexOf((await step(page)) ?? "");
    let skipped = 0;
    for (const id of ["kill", "optic", "crit"]) {
      await expect.poll(at).toBeGreaterThanOrEqual(order.indexOf(id));
      if ((await step(page)) !== id) continue;
      await page.getByRole("button", { name: "Skip this step" }).click();
      skipped += 1;
    }
    expect(skipped).toBeGreaterThan(0);
    await expect.poll(() => step(page)).toBe("ultimate");
    await page.keyboard.press("u");

    await expect.poll(() => step(page)).toBe("survive");
    await page.keyboard.press("Enter");
    await expect.poll(() => step(page)).toBe("modes");
    await page.getByRole("button", { name: "Finish" }).click();

    const finished = page.getByTestId("tutorial-finished");
    await expect(finished).toContainText(
      `You skipped ${skipped} practice ${skipped === 1 ? "step" : "steps"}`
    );
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

/** Scrolls the sampler into view, which is when the vault offers its tour. */
async function openVault(page: Page) {
  await page.goto("/arcade/meme-vault");
  await expect(async () => {
    await page.getByTestId("meme-echo").scrollIntoViewIfNeeded();
    await expect(page.getByTestId("meme-echo")).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 30000 });
}

test.describe("Meme Vault guided tutorial", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(
      !["chromium", "Mobile Chrome"].includes(testInfo.project.name),
      "Walked on desktop Chrome and one phone"
    );
  });

  test("is offered once, teaches by doing, and replays from its key", async ({
    page,
  }, testInfo) => {
    const phone = testInfo.project.name !== "chromium";
    const card = page.getByTestId("tutorial-card");
    const press = async (key: string, target: string) => {
      if (phone) await page.locator(`[data-tutorial-target="${target}"]`).tap();
      else await page.keyboard.press(key);
    };

    await openVault(page);
    const start = page.getByRole("button", { name: "Start the tutorial" });
    await expect(start).toBeVisible();
    await start.click();

    await expect.poll(() => step(page)).toBe("welcome");
    await card.getByRole("button", { name: "Next" }).click();

    // Practice: Start Echo, by key on a desktop and by tap on a phone.
    await expect.poll(() => step(page)).toBe("echo");
    if (phone) {
      await page.getByRole("button", { name: "Start Echo" }).tap();
    } else {
      await expect(page.locator("[data-keyboard-boundary]")).toBeFocused();
      await page.keyboard.press("Enter");
    }

    // The pattern stops Echo, and a wrong pad only plays its sample.
    await expect.poll(() => step(page)).toBe("pad-1");
    await expect(page.getByTestId("meme-echo")).toHaveAttribute(
      "data-echo-phase",
      "idle"
    );
    if (phone) await page.getByRole("button", { name: /^Play 5 / }).tap();
    else await page.keyboard.press("5");
    await expect.poll(() => step(page)).toBe("pad-1");
    await press("1", "pad-1");
    await expect.poll(() => step(page)).toBe("pad-2");
    await press("2", "pad-2");

    await expect.poll(() => step(page)).toBe("sound");
    await page.locator('[data-tutorial-target="sound"]').click();

    await expect.poll(() => step(page)).toBe("manual");
    if (phone) {
      await page
        .getByRole("button", { name: /Field Manual/i })
        .first()
        .tap();
    } else {
      await expect(page.locator("[data-keyboard-boundary]")).toBeFocused();
      await page.keyboard.press("?");
    }
    const manual = page.getByRole("dialog", { name: /Meme Vault/i });
    await expect(manual).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(manual).toHaveCount(0);

    await expect.poll(() => step(page)).toBe("trophies");
    await card.getByRole("button", { name: "Finish" }).click();
    await expect(page.getByTestId("tutorial-finished")).toBeVisible();
    await page.getByRole("button", { name: "Start playing" }).click();
    await expect(page.getByTestId("tutorial-finished")).toHaveCount(0);

    // Finished on this device: no offer next time, and the key replays it.
    await openVault(page);
    await expect(page.getByTestId("tutorial-offer")).toHaveCount(0);
    await page.getByTestId("meme-tutorial-key").click();
    await expect.poll(() => step(page)).toBe("welcome");
  });

  test("can be turned down, and stays turned down", async ({ page }) => {
    await openVault(page);
    await page.getByRole("button", { name: "Skip, just play" }).click();
    await expect(page.getByTestId("tutorial-offer")).toHaveCount(0);
    await openVault(page);
    await expect(page.getByTestId("meme-echo")).toBeVisible();
    await expect(page.getByTestId("tutorial-offer")).toHaveCount(0);
  });
});

test.describe("Patty's Drive-Thru guided tutorial", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium",
      "Keyboard walkthrough on desktop Chrome"
    );
  });

  test("runs a practice shift whose clock holds, then returns to the diary", async ({
    page,
  }) => {
    // Reduced motion picks the flat view on every browser, WebGL or not.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/arcade/patty-drive-thru");
    await expect(async () => {
      await page.getByRole("button", { name: /Launch Cabinet/i }).click();
      await expect(page.getByTestId("tutorial-offer")).toBeVisible({
        timeout: 3000,
      });
    }).toPass({ timeout: 30000 });
    await page.getByRole("button", { name: "Start the tutorial" }).click();

    const card = page.getByTestId("tutorial-card");
    const game = page.getByTestId("pdt-game");
    await expect.poll(() => step(page)).toBe("welcome");
    await card.getByRole("button", { name: "Next" }).click();

    await expect.poll(() => step(page)).toBe("turn");
    await expect(game).toBeFocused();
    await page.keyboard.press("a");

    // The one car pulls up, and the clock holds from then on.
    await expect.poll(() => step(page)).toBe("order");
    const order = page
      .getByRole("toolbar", { name: "Open orders" })
      .getByRole("button", { name: /#1, order/ });
    await expect(order).toBeVisible();
    const clock = await page.getByTestId("pdt-clock").textContent();
    await page.keyboard.press("1");
    await expect(order).toHaveAttribute("aria-pressed", "true");

    await expect.poll(() => step(page)).toBe("ring");
    await page.getByRole("button", { name: "Sides ›", exact: true }).click();
    await page.getByRole("button", { name: "Fries", exact: true }).click();

    await expect.poll(() => step(page)).toBe("bump");
    await expect(game).toBeFocused();
    await page.keyboard.press("b");
    await expect(order).toBeHidden();

    await expect.poll(() => step(page)).toBe("wipe");
    await page.keyboard.press("w");

    await expect.poll(() => step(page)).toBe("dilemma");
    await expect(page.getByTestId("pdt-dilemma")).toBeVisible();
    await page.keyboard.press("q");
    await expect(page.getByTestId("pdt-dilemma")).toBeHidden();
    expect(await page.getByTestId("pdt-clock").textContent()).toBe(clock);

    await expect.poll(() => step(page)).toBe("done");
    await card.getByRole("button", { name: "Finish" }).click();
    await page.getByRole("button", { name: "Start playing" }).click();
    await expect(page.getByTestId("pdt-intro")).toBeVisible();
  });
});
