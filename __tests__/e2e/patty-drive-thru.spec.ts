import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/** A fixed seed: the first car orders a single fries two seconds in. */
const ROUTE = "/arcade/patty-drive-thru?seed=e2e-4";
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const BLOCKING = new Set(["critical", "serious", "moderate"]);

async function clockIn(page: Page) {
  await page.goto(ROUTE, { waitUntil: "domcontentloaded" });
  await expect(async () => {
    const launch = page.getByRole("button", { name: /Launch Cabinet/i });
    if (await launch.isVisible()) await launch.click();
    await expect(page.getByTestId("pdt-intro")).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 30000 });
  await page.getByRole("button", { name: "Clock in" }).click();
  await expect(page.getByTestId("pdt-clock")).toBeVisible();
}

/** axe on the game only, so the checks cover what this game renders. */
async function expectNoBlockingViolations(page: Page, state: string) {
  const results = await new AxeBuilder({ page })
    .include("[data-pdt-cabinet]")
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

test.describe("Patty's Drive-Thru (/arcade/patty-drive-thru)", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("serves a car by keyboard in the flat view", async ({ page }) => {
    // Reduced motion selects the flat view on every browser, WebGL or not.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await clockIn(page);
    await expect(page.getByTestId("pdt-game")).toHaveAttribute(
      "data-pdt-view",
      "flat"
    );
    await expectNoBlockingViolations(page, "flat register");

    const order = page
      .getByRole("toolbar", { name: "Open orders" })
      .getByRole("button", { name: /^Order 1/ });
    await expect(order).toBeVisible();
    await page.getByTestId("pdt-game").focus();
    await page.keyboard.press("1");
    await expect(order).toHaveAttribute("aria-pressed", "true");

    await page.getByRole("button", { name: "Sides ›", exact: true }).focus();
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "Fries", exact: true }).focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("b");
    await expect(order).toBeHidden();
    await expect(page.getByTestId("pdt-caption")).toContainText("Bumped");
  });

  test("opens the register in the 3D booth and leaves it with Escape", async ({
    page,
  }) => {
    await clockIn(page);
    const game = page.getByTestId("pdt-game");
    test.skip(
      (await game.getAttribute("data-pdt-view")) !== "3d",
      "This browser has no WebGL, so the cabinet shows the flat view."
    );
    await expect(page.getByTestId("pdt-booth-canvas")).toBeVisible();
    await game.focus();
    await page.keyboard.press("Enter");
    const register = page.getByTestId("pdt-register");
    await expect(register).toBeVisible();
    // Focus moves to the register's first usable key.
    await expect(register.locator("button:focus")).toHaveCount(1);
    await expectNoBlockingViolations(page, "register");
    await page.keyboard.press("Escape");
    await expect(register).toBeHidden();
    await expect(game).toBeFocused();
  });

  test("links the diary to its companion blog post", async ({ page }) => {
    await page.goto("/blog/notes-from-my-first-job", {
      waitUntil: "domcontentloaded",
    });
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Notes From My First Job"
    );
    await expect(
      page.getByRole("link", { name: /clock in at Patty's Drive-Thru/ }).first()
    ).toHaveAttribute("href", "/arcade/patty-drive-thru");
  });
});
