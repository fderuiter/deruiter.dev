import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const BLOCKING = new Set(["critical", "serious", "moderate"]);

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

/** Minutes after midnight for a clock reading such as "9:30 AM". */
function toMinutes(text: string): number {
  const match = /^(\d{1,2}):(\d{2}) (AM|PM)$/.exec(text.trim());
  if (!match) throw new Error(`Unreadable clock: ${text}`);
  const hours = (Number(match[1]) % 12) + (match[3] === "PM" ? 12 : 0);
  return hours * 60 + Number(match[2]);
}

async function press(page: Page, key: string, times: number) {
  for (let i = 0; i < times; i += 1) await page.keyboard.press(key);
}

test.describe("Study Director world (/arcade/study-director#mode=world)", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("walks to the coffee machine with the keyboard alone and passes axe", async ({
    page,
  }) => {
    await launchWorld(page);
    const room = page.getByTestId("world-room");
    await expect(room).toContainText("The lobby");
    await expect(page.getByRole("img", { name: /^The lobby/ })).toBeVisible();
    await expectNoBlockingViolations(page, "world screen");

    const clock = page.getByTestId("world-clock");
    const startedAt = toMinutes(await clock.innerText());
    const playfield = page.getByTestId("world-playfield");
    await playfield.focus();
    await expect(playfield).toBeFocused();

    // Lobby to the break room: north through the lobby door, west along the
    // corridor, south into the break room and west to the machine.
    await press(page, "ArrowUp", 4);
    await expect(room).toContainText("The corridor");
    await press(page, "a", 9);
    await press(page, "s", 2);
    await expect(room).toContainText("The break room");
    await press(page, "ArrowLeft", 2);
    await expect(room).toContainText("You are facing the Coffee machine");
    // Seventeen tiles at four a minute: the clock moved on four minutes.
    expect(toMinutes(await clock.innerText())).toBe(startedAt + 4);

    await page.keyboard.press("e");
    await expect(page.getByTestId("world-outcome")).toContainText(
      "Cup 1 today"
    );
    await expectNoBlockingViolations(page, "coffee outcome");
  });

  test("walks to a station from the office directory", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await launchWorld(page);
    const edc = page.getByRole("button", { name: /Walk to EDC workstation/ });
    await edc.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("world-room")).toContainText(
      "You are facing the EDC workstation",
      { timeout: 15000 }
    );
    await expect(page.getByTestId("world-playfield")).toBeFocused();
    await page.keyboard.press("e");
    // The EDC opens its own screen since #1689.
    await expect(
      page.getByRole("dialog", { name: "EDC workstation" })
    ).toBeVisible();
  });

  test("opens from the briefing and returns to the desk", async ({ page }) => {
    await page.goto("/arcade/study-director");
    await page.waitForLoadState("domcontentloaded");
    await expect(async () => {
      await page.getByRole("button", { name: /Launch Cabinet/i }).click();
      await expect(
        page.getByRole("button", { name: "Preview: walk the office" })
      ).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 15000 });
    await page
      .getByRole("button", { name: "Preview: walk the office" })
      .focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("world-hud")).toBeVisible();
    expect(page.url()).toContain("#mode=world");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    );
    expect(overflow).toBe(false);
    await page.getByRole("button", { name: "Back to the desk" }).click();
    await expect(
      page.getByRole("button", { name: /Start the study/i })
    ).toBeVisible();
  });
});
