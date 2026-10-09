import { test, expect, type Page } from "@playwright/test";

// Navigation layout matrix (#1849, phase N3 of #1842): every top-level item,
// the three menus, the mobile drawer and the Preferences menu at 320, 375, 768,
// 1024 and 1440, with a horizontal overflow check on the header at each width
// and at 200% text. Clicks that need React to have hydrated sit in toPass
// blocks so they cannot land on static HTML that has no listeners yet.

const WIDTHS = [320, 375, 768, 1024, 1440] as const;
// The desktop group needs the xl breakpoint; below it the mobile bar and
// drawer take over (see components/Navbar.tsx).
const DESKTOP_MIN_WIDTH = 1280;

const TOP_LEVEL = {
  links: ["Work", "Blog", "Contact"],
  menus: ["Arcade", "Simulators", "About"],
} as const;

const MENU_SAMPLES: Record<string, RegExp[]> = {
  Arcade: [/Arcade Hub/, /Laser Loon/, /Study Director/, /Meme Vault/],
  Simulators: [
    /Protocol Drift/,
    /Incident Simulator/,
    /CRF Studio/,
    /Proof Workspace/,
    /NeuroRecon Studio/,
  ],
  About: [/Under the Hood/, /Open Source Credits/, /Office Hours/, /GitHub/],
};

async function headerOverflow(page: Page) {
  return page.evaluate(() => {
    const clientWidth = document.documentElement.clientWidth;
    const offenders: string[] = [];
    document.querySelectorAll("header *").forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      if (rect.right > clientWidth + 1 || rect.left < -1) {
        offenders.push(
          `${el.tagName.toLowerCase()} ${String(el.className).slice(0, 60)} ` +
            `[${Math.round(rect.left)}, ${Math.round(rect.right)}]`
        );
      }
    });
    return {
      offenders,
      pageOverflow: document.documentElement.scrollWidth - clientWidth,
    };
  });
}

async function expectNoHeaderOverflow(page: Page) {
  const { offenders, pageOverflow } = await headerOverflow(page);
  expect(offenders).toEqual([]);
  expect(pageOverflow).toBeLessThanOrEqual(0);
}

async function openDrawer(page: Page) {
  const hamburger = page.locator('button[aria-controls="mobile-navigation"]');
  await expect(async () => {
    if ((await hamburger.getAttribute("aria-expanded")) !== "true") {
      await hamburger.click();
    }
    await expect(page.locator("#mobile-navigation")).toBeVisible({
      timeout: 1500,
    });
  }).toPass({ timeout: 15000 });
  return page.locator("#mobile-navigation");
}

async function openDesktopMenu(page: Page, name: string) {
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

async function expectPreferencesSections(scope: ReturnType<Page["locator"]>) {
  for (const name of ["Reading mode", "Sound", "Text"]) {
    await expect(
      scope.getByRole("heading", { name: new RegExp(`^${name}`) })
    ).toBeVisible();
  }
}

for (const width of WIDTHS) {
  const desktop = width >= DESKTOP_MIN_WIDTH;

  test.describe(`Navigation at ${width}px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
    });

    test("header has no horizontal overflow", async ({ page }) => {
      await expect(page.locator("header")).toBeVisible();
      await expectNoHeaderOverflow(page);
    });

    test("header has no horizontal overflow at 200% text", async ({ page }) => {
      await page.addStyleTag({
        content: "html { font-size: 200% !important; }",
      });
      await expect(page.locator("header")).toBeVisible();
      await expectNoHeaderOverflow(page);
    });

    if (desktop) {
      test("shows every top-level item and opens each menu", async ({
        page,
      }) => {
        const bar = page.getByRole("navigation", { name: "Main Navigation" });
        for (const name of TOP_LEVEL.links) {
          await expect(bar.getByRole("link", { name })).toBeVisible();
        }
        for (const name of TOP_LEVEL.menus) {
          await expect(
            bar.getByRole("button", { name, exact: true })
          ).toBeVisible();
        }
        for (const name of TOP_LEVEL.menus) {
          const trigger = await openDesktopMenu(page, name);
          const panel = page.locator(`#${name.toLowerCase()}-navigation`);
          for (const item of MENU_SAMPLES[name]) {
            await expect(panel.getByRole("link", { name: item })).toBeVisible();
          }
          await page.keyboard.press("Escape");
          await expect(panel).toHaveCount(0);
          await expect(trigger).toBeFocused();
        }
      });

      test("Preferences menu has three sections, closes on Escape and keeps overflow clean", async ({
        page,
      }) => {
        const trigger = page.getByRole("button", {
          name: "Open navigation preferences",
        });
        await expect(async () => {
          if ((await trigger.getAttribute("aria-expanded")) !== "true") {
            await trigger.click();
          }
          await expect(trigger).toHaveAttribute("aria-expanded", "true", {
            timeout: 1500,
          });
        }).toPass({ timeout: 15000 });

        const panel = page.locator("#navigation-preferences");
        await expectPreferencesSections(panel);
        await expectNoHeaderOverflow(page);

        await page.keyboard.press("Escape");
        await expect(panel).toHaveCount(0);
        await expect(trigger).toBeFocused();
      });
    } else {
      test("the drawer replaces the desktop bar and lists every group", async ({
        page,
      }) => {
        await expect(page.getByTestId("navbar-desktop-group")).toBeHidden();
        const drawer = await openDrawer(page);

        for (const name of TOP_LEVEL.links) {
          await expect(drawer.getByRole("link", { name })).toBeVisible();
        }
        for (const name of TOP_LEVEL.menus) {
          const fold = drawer.getByRole("button", {
            name: new RegExp(`^${name}`),
          });
          await expect(fold).toBeVisible();
          if ((await fold.getAttribute("aria-expanded")) !== "true") {
            await fold.click();
          }
          await expect(fold).toHaveAttribute("aria-expanded", "true");
          for (const item of MENU_SAMPLES[name]) {
            // The drawer footer repeats a few links (GitHub), so take the first.
            await expect(
              drawer.getByRole("link", { name: item }).first()
            ).toBeVisible();
          }
        }
        await expectNoHeaderOverflow(page);

        await page.keyboard.press("Escape");
        await expect(drawer).toHaveCount(0);
      });

      test("the drawer carries the Preferences panel", async ({ page }) => {
        const drawer = await openDrawer(page);
        const prefs = drawer.getByRole("group", { name: "PREFERENCES" });
        await prefs.scrollIntoViewIfNeeded();
        await expectPreferencesSections(prefs);
        await expect(
          prefs.getByRole("button", { name: /Enable OpenDyslexic font mode/ })
        ).toBeVisible();
        await expect(prefs.getByLabel("Volume")).toBeVisible();
        await expectNoHeaderOverflow(page);
      });
    }
  });
}
