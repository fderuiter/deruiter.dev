import { test, expect, type Page } from "@playwright/test";
import { waitForAnimationFrames } from "./helpers/settle";

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

test.describe("Monkey C Mayhem guided tutorial", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium",
      "Keyboard walkthrough on desktop Chrome"
    );
  });

  test("walks a safe practice run by doing, and can be replayed", async ({
    page,
  }) => {
    await page.goto("/arcade/garmin-watch");
    await expect(async () => {
      await page.getByRole("button", { name: /Launch Cabinet/i }).click();
      await expect(page.getByTestId("tutorial-offer")).toBeVisible({
        timeout: 2000,
      });
    }).toPass({ timeout: 30000 });
    await page.getByRole("button", { name: "Start the tutorial" }).click();

    const card = page.getByTestId("tutorial-card");
    await expect.poll(() => step(page)).toBe("welcome");
    await card.getByRole("button", { name: "Next" }).click();

    // Practice: the watch's own keys complete each step.
    const watch = page.locator("[data-keyboard-boundary]");
    await expect.poll(() => step(page)).toBe("start");
    await expect(watch).toBeFocused();
    await page.keyboard.press("Enter");

    // The run holds for GPS before the runner can jump.
    await expect.poll(() => step(page)).toBe("jump");
    await expect(async () => {
      await page.keyboard.press("ArrowUp");
      await expect.poll(() => step(page), { timeout: 1000 }).not.toBe("jump");
    }).toPass({ timeout: 15000 });

    await expect.poll(() => step(page)).toBe("high-jump");
    await expect(async () => {
      // Held for about half a second of frames counts as a held jump.
      await page.keyboard.down("ArrowUp");
      await waitForAnimationFrames(page, 30);
      await page.keyboard.up("ArrowUp");
      await expect
        .poll(() => step(page), { timeout: 1000 })
        .not.toBe("high-jump");
    }).toPass({ timeout: 10000 });

    await expect.poll(() => step(page)).toBe("sprint");
    await page.keyboard.down("ArrowRight");
    await expect.poll(() => step(page)).toBe("jog");
    await page.keyboard.up("ArrowRight");
    await page.keyboard.down("ArrowLeft");
    await expect.poll(() => step(page)).toBe("action");
    await page.keyboard.up("ArrowLeft");
    await page.keyboard.press("x");

    await expect.poll(() => step(page)).toBe("slam");
    await expect(async () => {
      await page.keyboard.press("ArrowUp");
      await waitForAnimationFrames(page, 9);
      await page.keyboard.press("ArrowDown");
      await expect.poll(() => step(page), { timeout: 1000 }).not.toBe("slam");
    }).toPass({ timeout: 10000 });

    // The meters are read steps, and the practice run is still going.
    await expect.poll(() => step(page)).toBe("meters");
    await card.getByRole("button", { name: "Next" }).click();
    await expect.poll(() => step(page)).toBe("dev-mode");
    await card.getByRole("button", { name: "Next" }).click();
    await expect.poll(() => step(page)).toBe("done");
    await card.getByRole("button", { name: "Finish" }).click();

    await expect(page.getByTestId("tutorial-finished")).toBeVisible();
    await page.getByRole("button", { name: "Start playing" }).click();
    await expect(page.getByTestId("tutorial-card")).toHaveCount(0);

    // The Tutorial key replays it.
    await page.getByTestId("cabinet-tutorial-key").click();
    await expect.poll(() => step(page)).toBe("welcome");
  });
});

test.describe("Working With Duck guided tutorial", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium",
      "Keyboard walkthrough on desktop Chrome"
    );
  });

  test("walks a frozen practice sprint by doing, and can be replayed", async ({
    page,
  }) => {
    await page.goto("/arcade/working-with-duck");
    await expect(async () => {
      await page.getByRole("button", { name: /Launch Cabinet/i }).click();
      await expect(page.getByTestId("tutorial-offer")).toBeVisible({
        timeout: 2000,
      });
    }).toPass({ timeout: 30000 });
    await page.getByRole("button", { name: "Start the tutorial" }).click();

    const card = page.getByTestId("tutorial-card");
    await expect.poll(() => step(page)).toBe("welcome");
    // The coach card does the teaching, so the hint strip waits.
    await expect(page.getByText(/^Goal: ship the work/)).toHaveCount(0);
    await card.getByRole("button", { name: "Next" }).click();

    // Practice: the game's own keys complete each step.
    await expect.poll(() => step(page)).toBe("start");
    await expect(page.locator("[data-keyboard-boundary]")).toBeFocused();
    // A key in the first half second after Sprint 1 opens is taken as one
    // left over from the last screen, so the press repeats until it lands.
    await expect(async () => {
      await page.keyboard.press("Space");
      await expect.poll(() => step(page), { timeout: 1000 }).not.toBe("start");
    }).toPass({ timeout: 10000 });

    await expect.poll(() => step(page)).toBe("code");
    await expect(async () => {
      await page.keyboard.press("Space");
      await expect.poll(() => step(page), { timeout: 1000 }).not.toBe("code");
    }).toPass({ timeout: 10000 });

    await expect.poll(() => step(page)).toBe("trick");
    await expect(async () => {
      await page.keyboard.press("q");
      await expect.poll(() => step(page), { timeout: 1500 }).not.toBe("trick");
    }).toPass({ timeout: 10000 });

    await expect.poll(() => step(page)).toBe("toy");
    await expect(async () => {
      await page.keyboard.press("2");
      await page.keyboard.press("2");
      await expect.poll(() => step(page), { timeout: 1500 }).not.toBe("toy");
    }).toPass({ timeout: 10000 });

    await expect.poll(() => step(page)).toBe("carry");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Enter");

    await expect.poll(() => step(page)).toBe("meters");
    await card.getByRole("button", { name: "Next" }).click();
    await expect.poll(() => step(page)).toBe("loop");
    await card.getByRole("button", { name: "Finish" }).click();

    await expect(page.getByTestId("tutorial-finished")).toBeVisible();
    await page.getByRole("button", { name: "Start playing" }).click();
    await expect(page.getByTestId("tutorial-card")).toHaveCount(0);

    // The Tutorial key replays it.
    await page.getByTestId("cabinet-tutorial-key").click();
    await expect.poll(() => step(page)).toBe("welcome");
  });
});

test.describe("Quasi-Perfect Puzzler guided tutorial", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium",
      "Keyboard walkthrough on desktop Chrome"
    );
  });

  test("proves Level 1 as practice, undoes it, and saves nothing", async ({
    page,
  }) => {
    await page.goto("/arcade/quasi-puzzler");
    await expect(async () => {
      await page.getByRole("button", { name: /Launch Cabinet/i }).click();
      await expect(page.getByTestId("tutorial-offer")).toBeVisible({
        timeout: 2000,
      });
    }).toPass({ timeout: 30000 });
    await page.getByRole("button", { name: "Start the tutorial" }).click();

    const card = page.getByTestId("tutorial-card");
    await expect.poll(() => step(page)).toBe("goal");
    await card.getByRole("button", { name: "Next" }).click();

    // Practice: the puzzler's own keys and cards complete each step.
    await expect.poll(() => step(page)).toBe("hint");
    await expect(page.locator("[data-keyboard-boundary]")).toBeFocused();
    await page.keyboard.press("h");

    await expect.poll(() => step(page)).toBe("select");
    await page.getByRole("button", { name: /^Tactic rfl\./ }).click();

    await expect.poll(() => step(page)).toBe("apply");
    await page.getByRole("button", { name: /^Goal\. Equality node/ }).click();

    // The practice proof shows no result card, so it can be undone.
    await expect.poll(() => step(page)).toBe("undo");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.locator("[data-keyboard-boundary]").focus();
    await page.keyboard.press("Control+z");

    await expect.poll(() => step(page)).toBe("reset");
    await page.keyboard.press("r");

    await expect.poll(() => step(page)).toBe("subgoals");
    await card.getByRole("button", { name: "Next" }).click();
    await expect.poll(() => step(page)).toBe("done");
    await card.getByRole("button", { name: "Finish" }).click();
    await page.getByRole("button", { name: "Start playing" }).click();
    await expect(page.getByTestId("tutorial-card")).toHaveCount(0);

    // Nothing from the practice proof was saved.
    const saved = await page.evaluate(() =>
      window.localStorage.getItem("quasi_perfect_puzzler_progress_v1")
    );
    expect(JSON.parse(saved ?? "{}").completedLevels?.["1"]).toBeUndefined();

    // The Tutorial key replays it.
    await page.getByTestId("cabinet-tutorial-key").click();
    await expect.poll(() => step(page)).toBe("goal");
  });
});
