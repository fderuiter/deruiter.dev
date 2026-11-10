import { devices, expect, test } from "@playwright/test";

for (const width of [320, 375, 768]) {
  test(`CRF Studio keeps its study picker usable at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 740 });
    await page.goto("/crf");

    const picker = page
      .getByLabel("Select Clinical Protocol Preset", { exact: true })
      .filter({ visible: true });
    await expect(picker).toBeVisible();
    expect((await picker.boundingBox())?.width).toBeGreaterThan(100);

    if (width < 768) {
      const mode = page.getByLabel("Studio mode", { exact: true });
      await expect(mode).toBeVisible();
      await expect(mode.locator("option")).toHaveCount(7);
      await mode.selectOption("matrix");
      await expect(mode).toHaveValue("matrix");
      await mode.selectOption("designer");

      const canvas = page.locator(".crf-canvas-area").filter({ visible: true });
      await expect(canvas).toBeVisible();
      const layout = await canvas.evaluate((element) => ({
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
        overflowY: getComputedStyle(element).overflowY,
      }));
      expect(layout.scrollHeight).toBeLessThanOrEqual(layout.clientHeight + 2);
      expect(layout.overflowY).not.toBe("auto");
      await expect(
        page.getByRole("button", { name: "Add Field Widget" })
      ).toHaveCSS("position", "static");
    }

    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    );
    expect(horizontalOverflow).toBe(false);
  });
}

test.describe("CRF Studio touch targets (#3469)", () => {
  test.use({ hasTouch: true, viewport: { width: 375, height: 740 } });

  test("section, field and toolbar tools are at least 44px on a touch screen", async ({
    page,
  }) => {
    await page.goto("/crf");
    expect(
      await page.evaluate(() => matchMedia("(pointer: coarse)").matches)
    ).toBe(true);

    const targets = [
      page.getByRole("button", { name: "Find, F: search the study" }),
      page.getByRole("button", { name: "More Studio Actions" }),
      page.getByRole("button", { name: /^Save form .* as a template$/ }),
      page.getByRole("button", { name: "Rename Section" }),
      page.getByRole("button", { name: "Move Section Down" }),
      page.getByRole("button", { name: "Field Actions" }),
      page.getByRole("button", { name: "* Hard Stop" }),
    ];
    for (const target of targets) {
      const button = target.filter({ visible: true }).first();
      await expect(button).toBeVisible();
      const box = await button.boundingBox();
      expect(
        box?.height,
        (await button.getAttribute("aria-label")) ?? (await button.innerText())
      ).toBeGreaterThanOrEqual(44);
    }

    const iconOnly = page
      .getByRole("button", { name: "Field Actions" })
      .filter({ visible: true })
      .first();
    expect((await iconOnly.boundingBox())?.width).toBeGreaterThanOrEqual(44);

    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    );
    expect(horizontalOverflow).toBe(false);
  });
});

test.describe("CRF Studio mobile redirect (#3204)", () => {
  test("a phone user agent on /crf lands on /m/crf", async ({ browser }) => {
    const context = await browser.newContext({
      userAgent: devices["Pixel 7"].userAgent,
      viewport: { width: 412, height: 915 },
    });
    const page = await context.newPage();
    await expect(async () => {
      await page.goto("/crf");
      await expect(page).toHaveURL(/\/m\/crf$/, { timeout: 5_000 });
    }).toPass({ timeout: 15_000 });
    await context.close();
  });

  test("a desktop user agent on /crf stays on /crf", async ({ browser }) => {
    const context = await browser.newContext({
      userAgent: devices["Desktop Chrome"].userAgent,
    });
    const page = await context.newPage();
    await expect(async () => {
      await page.goto("/crf");
      await expect(page).toHaveURL(/\/crf$/, { timeout: 5_000 });
      expect(new URL(page.url()).pathname).toBe("/crf");
    }).toPass({ timeout: 15_000 });
    await context.close();
  });
});
