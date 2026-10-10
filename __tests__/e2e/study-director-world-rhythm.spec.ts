import path from "node:path";
import { test, expect, type Locator, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const BLOCKING = new Set(["critical", "serious", "moderate"]);
const SAVE_KEY = "study_director_world_v1";

async function openDirectory(page: Page) {
  const toggle = page.getByRole("button", {
    name: /^(Office|Site) directory$/,
  });
  if ((await toggle.getAttribute("aria-expanded")) === "false")
    await toggle.click();
}

async function launchWorld(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("study_director_world_intro_seen", "1");
  });
  await page.goto("/arcade/study-director#mode=world");
  await page.waitForLoadState("domcontentloaded");
  await expect(async () => {
    await page.getByRole("button", { name: /Launch Cabinet/i }).click();
    await expect(page.getByTestId("world-hud")).toBeVisible({
      timeout: 2000,
    });
  }).toPass({ timeout: 30000 });
}

async function expectNoBlockingViolations(
  page: Page,
  selector: string,
  state: string
) {
  const results = await new AxeBuilder({ page })
    .include(selector)
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

async function activate(control: Locator) {
  await control.focus();
  await expect(control).toBeFocused();
  await control.page().keyboard.press("Enter");
}

/** The sponsor's phone rings at a seed-dependent time: send it to voicemail. */
async function quietPhone(page: Page) {
  const ringing = page.getByRole("alertdialog", {
    name: "The phone is ringing",
  });
  if (await ringing.isVisible())
    await ringing.getByRole("button", { name: "Send to voicemail" }).click();
}

/**
 * Someone standing in a doorway blocks the walk, and the clock only moves
 * when the player acts. A word with them (ten minutes) lets them move on.
 */
async function excuseMe(page: Page) {
  const prompt = page.getByTestId("world-prompt");
  if (!(await prompt.isVisible())) return;
  if (!/talk to/i.test(await prompt.innerText())) return;
  await page.keyboard.press("e");
  await page.keyboard.press("Escape");
}

async function walkTo(page: Page, name: RegExp, facing: RegExp) {
  await expect(async () => {
    await quietPhone(page);
    await excuseMe(page);
    await openDirectory(page);
    await activate(page.getByRole("button", { name }));
    await expect(page.getByTestId("world-room")).toContainText(facing, {
      timeout: 8000,
    });
  }).toPass({ timeout: 40000 });
  await expect(page.getByTestId("world-playfield")).toBeFocused();
}

/** Rewrites the saved world, then reloads into it. */
async function reloadWith(page: Page, patch: Record<string, unknown>) {
  await page.evaluate(
    ([key, changes]) => {
      const world = JSON.parse(localStorage.getItem(key as string) ?? "{}");
      Object.assign(world, changes);
      localStorage.setItem(key as string, JSON.stringify(world));
    },
    [SAVE_KEY, patch] as const
  );
  await page.reload();
  await launchWorld(page);
}

async function shot(
  page: Page,
  testInfo: { outputPath: () => string },
  name: string
) {
  const dir = process.env.SD_SHOTS_DIR ?? testInfo.outputPath();
  await page.evaluate(() => {
    const top = document
      .querySelector("[data-sd-world]")
      ?.getBoundingClientRect().top;
    if (top !== undefined) window.scrollBy(0, top - 80);
  });
  await page.screenshot({ path: path.join(dir, `${name}.png`) });
}

test.describe("Study Director world: a day with a rhythm (#1837, #1838)", () => {
  test.use({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });

  test("priority in the morning, an interruption, a coffee, and the wrap-up", async ({
    page,
  }, testInfo) => {
    // People walk their schedules and the phone rings at a seed-dependent
    // time, so a walk can need a second attempt.
    test.setTimeout(180_000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await launchWorld(page);

    // Morning: pick what the day is about.
    const priority = page.getByTestId("world-priority");
    await expect(priority).toBeVisible();
    await expectNoBlockingViolations(
      page,
      "[data-testid=world-priority]",
      "priority card"
    );
    await activate(priority.getByRole("button", { name: /Be with the team/ }));
    await expect(page.getByTestId("world-priority-line")).toContainText(
      "Be with the team"
    );
    await expect(priority).toBeHidden();

    // Mid-morning: something lands on the day.
    await reloadWith(page, { minute: 10 * 60 + 5 });
    const interruption = page.getByTestId("world-interruption");
    await expect(interruption).toBeVisible();
    await expect(page.getByTestId("world-tasks")).toContainText(
      await interruption.getByRole("heading").innerText()
    );
    await expectNoBlockingViolations(
      page,
      "[data-testid=world-interruption]",
      "interruption card"
    );
    await shot(page, testInfo, "rhythm-interruption-1280");
    await activate(interruption.getByRole("button").first());
    await expect(interruption).toBeHidden();

    // Midday: what makes Maya tick, and a coffee. The phone can ring at any
    // point and take the conversation, so each step reopens it when needed.
    const openMaya = async () => {
      const talk = page.getByRole("dialog", { name: "Maya" });
      await quietPhone(page);
      if (!(await talk.isVisible())) {
        await walkTo(page, /Walk to Maya/, /You are facing Maya/);
        await page.keyboard.press("e");
        await expect(talk).toBeVisible({ timeout: 3000 });
      }
      return talk;
    };
    await expect(async () => {
      const talk = await openMaya();
      await activate(talk.getByRole("button", { name: /Ask about them/ }));
      await expect(talk).toContainText(/never says no|already know/, {
        timeout: 3000,
      });
    }).toPass({ timeout: 60000 });
    await expect(async () => {
      const talk = await openMaya();
      await activate(talk.getByRole("button", { name: /Bring coffee/ }));
      await expect(talk).toContainText(/exactly right|had a coffee from you/, {
        timeout: 3000,
      });
    }).toPass({ timeout: 60000 });
    const talk = await openMaya();
    await expectNoBlockingViolations(
      page,
      "[data-testid=world-dialogue]",
      "relationship actions"
    );
    await shot(page, testInfo, "relationship-maya-1280");
    await page.keyboard.press("Escape");
    await expect(talk).toBeHidden();

    // Late afternoon: going home shows how the day went.
    await reloadWith(page, { minute: 16 * 60 + 20 });
    await walkTo(page, /Walk to Your car/, /You are facing the Your car/);
    await page.keyboard.press("e");
    await activate(page.getByRole("button", { name: "Go home" }));
    const overnight = page.getByTestId("world-overnight");
    await expect(overnight).toBeVisible();
    await expect(overnight).toContainText("How today went");
    await expect(overnight).toContainText("You decided");
    await expect(overnight).toContainText("Be with the team");
    await expectNoBlockingViolations(
      page,
      "[data-testid=world-overnight]",
      "wrap-up"
    );
    await shot(page, testInfo, "wrapup-1280");
    await activate(
      overnight.getByRole("button", { name: /Drive in for day 2/ })
    );
    await expect(page.getByText("Tuesday morning")).toBeVisible();
    // A new day asks again.
    await expect(page.getByTestId("world-priority")).toBeVisible();
  });
});
