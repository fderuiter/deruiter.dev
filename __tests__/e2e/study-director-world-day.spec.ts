import { test, expect, type Locator, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const BLOCKING = new Set(["critical", "serious", "moderate"]);
const SAVE_KEY = "study_director_world_v1";

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

/** Presses a control from the keyboard: focus it, then Enter. */
async function activate(control: Locator) {
  await control.focus();
  await expect(control).toBeFocused();
  await control.page().keyboard.press("Enter");
}

async function walkTo(page: Page, name: RegExp, facing: RegExp) {
  await activate(page.getByRole("button", { name }));
  await expect(page.getByTestId("world-room")).toContainText(facing, {
    timeout: 20000,
  });
  await expect(page.getByTestId("world-playfield")).toBeFocused();
}

test.describe("Study Director world: a working day (#1688, #1689)", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("plays a full day by keyboard: arrive, talk, answer, document, go home", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await launchWorld(page);
    // Arrive: the morning digest.
    await expect(page.getByText("Monday morning")).toBeVisible();

    // Talk: walk to Maya and press E.
    await walkTo(page, /Walk to Maya/, /You are facing Maya/);
    await page.keyboard.press("e");
    const talk = page.getByRole("dialog", { name: "Maya" });
    await expect(talk).toBeVisible();
    await expect(talk.getByTestId("relationship-card")).toContainText("Trust");
    await expectNoBlockingViolations(
      page,
      "[data-testid=world-dialogue]",
      "conversation"
    );
    await page.keyboard.press("Escape");
    await expect(talk).toBeHidden();
    await expect(page.getByTestId("world-playfield")).toBeFocused();

    // Answer an event: return the sponsor's call from the desk phone.
    await walkTo(page, /Walk to Phone/, /You are facing the Phone/);
    await page.keyboard.press("e");
    const desk = page.getByRole("dialog", { name: "Your desk" });
    await expect(desk).toBeVisible();
    await activate(desk.getByRole("button", { name: /Call: Arcadia/ }));
    const call = page.getByRole("dialog", { name: /Exploratory biomarkers/ });
    await expect(call).toBeVisible();
    await expectNoBlockingViolations(
      page,
      "[data-testid=world-dialogue]",
      "event dialogue"
    );
    await page.keyboard.press("2");
    await expect(call).toContainText("Decided: Add them after an impact");

    // Document: write it up at the desk, twenty minutes.
    const clock = page.getByTestId("world-clock");
    const before = await clock.innerText();
    await activate(call.getByRole("button", { name: /Write it up now/ }));
    await expect(desk).toContainText("Written up and filed");
    await expect(clock).not.toHaveText(before);
    await expectNoBlockingViolations(page, "[data-testid=world-desk]", "desk");
    await page.keyboard.press("Escape");
    await expect(desk).toBeHidden();

    // Go home: walk to the car, confirm, read the report, drive in.
    await walkTo(page, /Walk to Your car/, /You are facing the Your car/);
    await page.keyboard.press("e");
    await activate(page.getByRole("button", { name: "Go home" }));
    await expect(page.getByText("Overnight, day 1")).toBeVisible();
    await activate(page.getByRole("button", { name: /Drive in for day 2/ }));
    await expect(page.getByText("Tuesday morning")).toBeVisible();
    await expect(page.getByTestId("world-hud")).toContainText("2 · Tuesday");
    const saved = await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key) ?? "{}"),
      SAVE_KEY
    );
    const record = saved.study.log.find(
      (r: { eventId: string }) => r.eventId === "sponsor-biomarkers"
    );
    expect(record).toMatchObject({ optionId: "assess", documented: true });
  });

  test("rings the phone when a call is due, and the overlays pass axe", async ({
    page,
  }) => {
    await launchWorld(page);
    // Move the saved day on to the afternoon, when the sponsor's call is due.
    await page.evaluate((key) => {
      const world = JSON.parse(localStorage.getItem(key) ?? "{}");
      world.minute = 16 * 60 + 40;
      localStorage.setItem(key, JSON.stringify(world));
    }, SAVE_KEY);
    await page.reload();
    await launchWorld(page);
    const phone = page.getByRole("alertdialog", {
      name: "The phone is ringing",
    });
    await expect(phone).toBeVisible();
    await expect(phone.getByRole("button", { name: "Answer" })).toBeFocused();
    await expectNoBlockingViolations(
      page,
      "[data-testid=world-phone]",
      "phone"
    );
    await page.keyboard.press("Enter");
    const call = page.getByRole("dialog", { name: /Exploratory biomarkers/ });
    await expect(call).toBeVisible();
    await expectNoBlockingViolations(
      page,
      "[data-testid=world-dialogue]",
      "call"
    );
    await page.keyboard.press("Escape");
    await expect(phone).toBeHidden();
  });
});
