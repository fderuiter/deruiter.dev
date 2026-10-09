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

async function activate(control: Locator) {
  await control.focus();
  await expect(control).toBeFocused();
  await control.page().keyboard.press("Enter");
}

async function walkTo(page: Page, name: RegExp, facing: RegExp) {
  await openDirectory(page);
  await activate(page.getByRole("button", { name }));
  await expect(page.getByTestId("world-room")).toContainText(facing, {
    timeout: 20000,
  });
  await expect(page.getByTestId("world-playfield")).toBeFocused();
}

async function canvasPixels(page: Page): Promise<string> {
  return page
    .getByTestId("world-canvas")
    .evaluate((c) => (c as HTMLCanvasElement).toDataURL());
}

/** Scrolls the stage clear of the fixed site header. */
async function scrollToStage(page: Page) {
  await page.evaluate(() => {
    const top = document
      .querySelector("[data-sd-world]")
      ?.getBoundingClientRect().top;
    if (top !== undefined) window.scrollBy(0, top - 80);
  });
}

async function shot(
  page: Page,
  testInfo: { outputPath: () => string },
  name: string
) {
  const dir = process.env.SD_SHOTS_DIR ?? testInfo.outputPath();
  await page.screenshot({ path: path.join(dir, `${name}.png`) });
}

test.describe("Study Director world: the stage (#1829 to #1834)", () => {
  test.use({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });

  for (const width of [1024, 1280, 1440]) {
    test(`camera, minimap, prompt and tasks at ${width}`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await launchWorld(page);

      // The map is on, the page does not overflow, and the stage keeps its size.
      const minimap = page.getByTestId("world-minimap");
      await expect(minimap).toBeVisible();
      const canvas = page.getByTestId("world-canvas");
      const before = await canvas.boundingBox();
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth
      );
      expect(overflow).toBe(false);

      // Walking pans the camera: the picture changes and the box does not.
      const still = await canvasPixels(page);
      await openDirectory(page);
      await activate(
        page.getByRole("button", { name: /Walk to Coffee machine/ })
      );
      await expect(page.getByTestId("world-room")).toContainText(
        /You are facing the Coffee machine/,
        { timeout: 20000 }
      );
      expect(await canvasPixels(page)).not.toBe(still);
      const after = await canvas.boundingBox();
      expect(after?.height).toBe(before?.height);
      expect(after?.width).toBe(before?.width);

      // The prompt names what you face; the tasks panel lists what is open.
      await expect(page.getByTestId("world-prompt")).toContainText(
        /use Coffee machine/i
      );
      await expect(page.getByTestId("world-tasks")).toBeVisible();
      await expect(page.getByTestId("world-phase")).toBeVisible();

      // The map hides and shows again.
      const toggle = page.getByRole("button", { name: "Minimap" });
      await toggle.click();
      await expect(minimap).toBeHidden();
      await toggle.click();
      await expect(minimap).toBeVisible();

      await scrollToStage(page);
      await shot(page, testInfo, `stage-${width}`);
    });
  }

  test("a conversation opens as a dialogue box and passes axe", async ({
    page,
  }, testInfo) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await launchWorld(page);
    await walkTo(page, /Walk to Maya/, /You are facing Maya/);
    await page.keyboard.press("e");
    const talk = page.getByRole("dialog", { name: "Maya" });
    await expect(talk).toBeVisible();
    await expect(talk.getByTestId("speaker-hearts")).toBeVisible();
    await expectNoBlockingViolations(
      page,
      "[data-testid=world-dialogue]",
      "dialogue box"
    );
    await shot(page, testInfo, "dialogue-maya-1280");
    await page.keyboard.press("Escape");
    await expect(talk).toBeHidden();
    await expect(page.getByTestId("world-playfield")).toBeFocused();
  });

  test("the EDC opens as a monitor and the desk phone as a phone", async ({
    page,
  }, testInfo) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await launchWorld(page);
    await walkTo(page, /Walk to EDC workstation/, /You are facing the EDC/);
    await page.keyboard.press("e");
    const edc = page.getByTestId("world-edc");
    await expect(edc).toHaveAttribute("data-device", "monitor");
    await expectNoBlockingViolations(
      page,
      "[data-testid=world-edc]",
      "EDC monitor"
    );
    await shot(page, testInfo, "device-edc-1280");
    await edc.getByRole("button", { name: "Close window" }).click();
    await expect(edc).toBeHidden();

    // Move the day to the afternoon, when the sponsor's call is due.
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
    await expect(phone).toHaveAttribute("data-device", "phone");
    await shot(page, testInfo, "device-phone-1280");
    await page.keyboard.press("Enter");
    const call = page.getByRole("dialog", { name: /Exploratory biomarkers/ });
    await expect(call).toHaveAttribute("data-device", "phone");
    await page.keyboard.press("Escape");
  });

  test("the overnight report is a card and N starts the next day", async ({
    page,
  }, testInfo) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await launchWorld(page);
    await expect(page.getByTestId("world-digest")).toBeVisible();
    await scrollToStage(page);
    await shot(page, testInfo, "card-digest-1280");
    await walkTo(page, /Walk to Your car/, /You are facing the Your car/);
    await page.keyboard.press("e");
    await activate(page.getByRole("button", { name: "Go home" }));
    const card = page.getByTestId("world-overnight");
    await expect(card).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Drive in for day 2/ })
    ).toBeFocused();
    await expectNoBlockingViolations(
      page,
      "[data-testid=world-overnight]",
      "overnight card"
    );
    await card.scrollIntoViewIfNeeded();
    await shot(page, testInfo, "card-overnight-1280");
    await page.keyboard.press("n");
    await expect(page.getByTestId("world-hud")).toContainText("2 · Tuesday");
    await expect(page.getByTestId("world-digest")).toBeVisible();
  });
});
