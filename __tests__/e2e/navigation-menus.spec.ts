import { test, expect, type Page } from "@playwright/test";

// The top bar, its three menus and the mobile drawer (#1842, phase N1). Every
// click that depends on React having hydrated sits in a toPass block so it
// cannot land on static HTML that has no listeners yet.

async function openMenu(page: Page, name: string) {
  const trigger = page
    .getByRole("navigation", { name: "Main Navigation" })
    .getByRole("button", { name, exact: true });
  await expect(async () => {
    if ((await trigger.getAttribute("aria-expanded")) !== "true") {
      await trigger.click();
    }
    await expect(trigger).toHaveAttribute("aria-expanded", "true", {
      timeout: 1500,
    });
  }).toPass({ timeout: 15000 });
  return trigger;
}

test.describe("Top bar and menus on a wide screen", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("shows six items and no Systems menu or GitHub link", async ({
    page,
  }) => {
    await page.goto("/");
    const bar = page.getByRole("navigation", { name: "Main Navigation" });
    await expect(bar.getByRole("link", { name: "Work" })).toBeVisible();
    await expect(bar.getByRole("link", { name: "Blog" })).toBeVisible();
    for (const menu of ["Arcade", "Simulators", "About"]) {
      await expect(
        bar.getByRole("button", { name: menu, exact: true })
      ).toBeVisible();
    }
    await expect(bar.getByRole("link", { name: "Contact" })).toBeVisible();
    await expect(bar.getByRole("button", { name: "Systems" })).toHaveCount(0);
    await expect(bar.getByRole("link", { name: /GitHub/ })).toHaveCount(0);
  });

  test("Arcade menu lists games only, moves with the arrow keys and returns focus on Escape", async ({
    page,
  }) => {
    await page.goto("/");
    const trigger = await openMenu(page, "Arcade");
    const panel = page.locator("#arcade-navigation");
    await expect(panel.getByRole("link", { name: /Arcade Hub/ })).toBeVisible();
    await expect(
      panel.getByRole("link", { name: /Study Director/ })
    ).toBeVisible();
    await expect(
      panel.getByRole("link", { name: /Protocol Drift/ })
    ).toHaveCount(0);
    await expect(panel.getByRole("link", { name: /Merch/ })).toHaveCount(0);

    await trigger.focus();
    await page.keyboard.press("ArrowDown");
    await expect(panel.getByRole("link", { name: /Arcade Hub/ })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(panel.getByRole("link", { name: /Laser Loon/ })).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await expect(panel.getByRole("link", { name: /Arcade Hub/ })).toBeFocused();
    await page.keyboard.press("End");
    await expect(panel.getByRole("link", { name: /Meme Vault/ })).toBeFocused();
    await page.keyboard.press("Home");
    await expect(panel.getByRole("link", { name: /Arcade Hub/ })).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(panel).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test("Simulators menu has Simulators and Studios groups and opens Protocol Drift", async ({
    page,
  }) => {
    await page.goto("/");
    await openMenu(page, "Simulators");
    const panel = page.locator("#simulators-navigation");
    await expect(panel.getByText("Simulators", { exact: true })).toBeVisible();
    await expect(panel.getByText("Studios", { exact: true })).toBeVisible();
    for (const name of [
      /Protocol Drift/,
      /Incident Simulator/,
      /Patrol Shift/,
      /CRF Studio/,
      /Proof Workspace/,
      /NeuroRecon Studio/,
    ]) {
      await expect(panel.getByRole("link", { name })).toBeVisible();
    }
    await expect(async () => {
      await panel.getByRole("link", { name: /Protocol Drift/ }).click();
      await expect(page).toHaveURL(/\/protocol-drift$/, { timeout: 4000 });
    }).toPass({ timeout: 15000 });
    await expect(page.locator("h1")).toContainText("Protocol Drift");
  });

  test("About menu holds the site pages and GitHub opens in a new tab", async ({
    page,
  }) => {
    await page.goto("/");
    await openMenu(page, "About");
    const panel = page.locator("#about-navigation");
    await expect(
      panel.getByRole("link", { name: /Under the Hood/ })
    ).toHaveAttribute("href", "/stack");
    await expect(
      panel.getByRole("link", { name: /Open Source Credits/ })
    ).toHaveAttribute("href", "/acknowledgments");
    const github = panel.getByRole("link", { name: /GitHub/ });
    await expect(github).toHaveAttribute("target", "_blank");
    await expect(github).toHaveAttribute("rel", /noopener/);
  });

  test("the old Protocol Drift arcade URL redirects to the simulator", async ({
    page,
  }) => {
    const response = await page.goto("/arcade/protocol-drift");
    expect(response?.ok()).toBe(true);
    await expect(page).toHaveURL(/\/protocol-drift$/);
    await expect(page.locator("h1")).toContainText("Protocol Drift");
  });

  test("the arcade hub no longer lists Protocol Drift", async ({ page }) => {
    await page.goto("/arcade");
    await expect(
      page.locator(
        'main a[href="/arcade/protocol-drift"], main a[href="/protocol-drift"]'
      )
    ).toHaveCount(0);
  });
});

test.describe("Mobile drawer", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("folds Arcade and Simulators and closes on Escape", async ({ page }) => {
    await page.goto("/");
    const hamburger = page.locator('button[aria-controls="mobile-navigation"]');
    await expect(async () => {
      if ((await hamburger.getAttribute("aria-expanded")) !== "true") {
        await hamburger.click();
      }
      await expect(page.locator("#mobile-navigation")).toBeVisible({
        timeout: 1500,
      });
    }).toPass({ timeout: 15000 });

    const drawer = page.locator("#mobile-navigation");
    const arcade = drawer.getByRole("button", { name: /^Arcade/ });
    const sims = drawer.getByRole("button", { name: /^Simulators/ });
    await expect(arcade).toHaveAttribute("aria-expanded", "false");
    await expect(sims).toHaveAttribute("aria-expanded", "false");

    await arcade.click();
    await expect(arcade).toHaveAttribute("aria-expanded", "true");
    await expect(
      drawer.getByRole("link", { name: /Study Director/ })
    ).toBeVisible();

    await sims.click();
    await expect(
      drawer.getByRole("link", { name: /Protocol Drift/ })
    ).toBeVisible();
    await expect(
      drawer.getByRole("link", { name: /Incident Simulator/ })
    ).toBeVisible();

    // 48px minimum touch targets on the section buttons and links.
    for (const target of [
      arcade,
      sims,
      drawer.getByRole("link", { name: "Contact" }),
    ]) {
      const box = await target.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(47.5);
    }

    // No horizontal overflow.
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(0);

    await page.keyboard.press("Escape");
    await expect(drawer).toHaveCount(0);
  });
});
