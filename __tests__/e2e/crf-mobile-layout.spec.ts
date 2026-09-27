import { expect, test } from "@playwright/test";

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
