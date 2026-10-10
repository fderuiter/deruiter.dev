import path from "node:path";
import { test, expect, type Locator, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { guestDay } from "@/lib/study-director-world";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const BLOCKING = new Set(["critical", "serious", "moderate"]);
const SAVE_KEY = "study_director_world_v1";
const SEED = "e2e-guests";

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
      timeout: 5000,
    });
  }).toPass({ timeout: 60000 });
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

async function activate(control: Locator) {
  await control.focus();
  await expect(control).toBeFocused();
  await control.page().keyboard.press("Enter");
}

/** Calls that came due while the clock jumped ring one after another: send each to voicemail. */
async function quietPhone(page: Page) {
  const ringing = page.getByRole("alertdialog", {
    name: "The phone is ringing",
  });
  for (let call = 0; call < 12 && (await ringing.isVisible()); call += 1) {
    await ringing.getByRole("button", { name: "Send to voicemail" }).click();
    await page.waitForTimeout(150);
  }
}

/** A word with someone standing in a doorway lets them move on. */
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
async function reloadWith(
  page: Page,
  patch: { day?: number; minute?: number }
) {
  await page.evaluate(
    ([key, seed, changes]) => {
      const world = JSON.parse(localStorage.getItem(key as string) ?? "{}");
      world.study.seed = seed;
      if (changes.day) world.study.day = changes.day;
      if (changes.minute) world.minute = changes.minute;
      localStorage.setItem(key as string, JSON.stringify(world));
    },
    [SAVE_KEY, SEED, patch] as const
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

/** The scene card sits below the stage, so it gets a picture of its own. */
async function shotCard(
  card: Locator,
  testInfo: { outputPath: () => string },
  name: string
) {
  const dir = process.env.SD_SHOTS_DIR ?? testInfo.outputPath();
  await card.scrollIntoViewIfNeeded();
  await card.screenshot({ path: path.join(dir, `${name}.png`) });
}

async function driveTo(page: Page, site: string) {
  await walkTo(page, /Walk to Your car/, /You are facing the Your car/);
  await page.keyboard.press("e");
  const car = page.getByTestId("world-outcome");
  await activate(
    car.getByRole("button", { name: new RegExp(`Drive to ${site}`) })
  );
  await expect(
    page.getByRole("heading", { level: 2, name: new RegExp(`${site} visit`) })
  ).toBeVisible();
}

test.describe("Study Director: more sites, a sponsor visit and a vendor (#1839)", () => {
  test.use({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });

  test("Site 04's confident coordinator keeps the source from memory", async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000);
    await launchWorld(page);
    await reloadWith(page, { day: 30, minute: 9 * 60 });
    await driveTo(page, "Site 04");
    await expect(page.getByTestId("world-room")).toContainText(
      "Site 04 car park"
    );
    await expectNoBlockingViolations(page, "Site 04 arrival");
    await shot(page, testInfo, "site-04-arrival-1280");

    await walkTo(
      page,
      /Walk to Source documents/,
      /You are facing the Source documents/
    );
    await page.keyboard.press("e");
    await activate(
      page.getByRole("button", { name: "Review source documents, 90 minutes" })
    );
    await expect(page.getByTestId("world-outcome")).toContainText(
      "You learned: Works from memory"
    );
    await expectNoBlockingViolations(page, "Site 04 source check");
    await shot(page, testInfo, "site-04-check-1280");
    await shotCard(
      page.getByTestId("world-outcome"),
      testInfo,
      "site-04-outcome-1280"
    );
  });

  test("Site 05's new coordinator has no one to ask", async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000);
    await launchWorld(page);
    await reloadWith(page, { day: 30, minute: 9 * 60 });
    await driveTo(page, "Site 05");
    await shot(page, testInfo, "site-05-arrival-1280");

    await walkTo(
      page,
      /Walk to Coordinator Jun Park/,
      /You are facing the Coordinator Jun Park/
    );
    await page.keyboard.press("e");
    await activate(
      page.getByRole("button", {
        name: "Interview the coordinator, 30 minutes",
      })
    );
    await expect(page.getByTestId("world-outcome")).toContainText(
      "You learned: Has no one to ask"
    );
    await expectNoBlockingViolations(page, "Site 05 interview");
    await shot(page, testInfo, "site-05-check-1280");
  });

  test("the sponsor waits in the conference room until you walk in", async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000);
    await launchWorld(page);
    await reloadWith(page, {
      day: guestDay(SEED, "sponsorVisit"),
      minute: 14 * 60 + 5,
    });
    const card = page.getByTestId("world-guest");
    await expect(card).toHaveAttribute("data-guest", "sponsorVisit");
    await expect(page.getByTestId("world-guest-where")).toBeVisible();
    await expect(page.getByTestId("world-tasks")).toContainText(
      "Imogen Vale of Arcadia Therapeutics is waiting"
    );

    await walkTo(page, /Walk to Conference room/, /The conference room/);
    await expect(page.getByTestId("world-guest-where")).toBeHidden();
    await expectNoBlockingViolations(page, "sponsor visit");
    await shot(page, testInfo, "sponsor-visit-1280");
    await shotCard(card, testInfo, "sponsor-visit-card-1280");

    await page
      .getByRole("button", { name: /Give her the clean summary/ })
      .click();
    await expect(card).toBeHidden();
    // The visit is remembered, and the interruption it held back can land.
    await expect
      .poll(() =>
        page.evaluate(
          (key) =>
            JSON.parse(localStorage.getItem(key) ?? "{}").guests?.[0]?.choice,
          SAVE_KEY
        )
      )
      .toBe("summary");
  });

  test("the EDC vendor wants a renewal and an audit-trail conversation", async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000);
    await launchWorld(page);
    await reloadWith(page, {
      day: guestDay(SEED, "vendorMeeting"),
      minute: 10 * 60 + 35,
    });
    const card = page.getByTestId("world-guest");
    await expect(card).toHaveAttribute("data-guest", "vendorMeeting");
    await walkTo(page, /Walk to Conference room/, /The conference room/);
    await expectNoBlockingViolations(page, "vendor meeting");
    await shot(page, testInfo, "vendor-meeting-1280");
    await shotCard(card, testInfo, "vendor-meeting-card-1280");
    await page.getByRole("button", { name: /Negotiate the renewal/ }).click();
    await expect(card).toBeHidden();
  });
});
