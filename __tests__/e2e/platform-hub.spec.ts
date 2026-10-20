import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

for (const width of [320, 375, 768, 1440]) {
  test(`platform hub is accessible and contained at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/platform");

    await expect(
      page.getByRole("heading", { level: 1, name: "Clinical Data Platform" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Capability map" })
    ).toBeVisible();
    await expect(page.locator("article")).toHaveCount(13);

    const overflowing = await page.evaluate(() => {
      const viewportWidth = document.documentElement.clientWidth;
      return [...document.querySelectorAll("main *")]
        .filter(
          (element) => element.getBoundingClientRect().right > viewportWidth + 1
        )
        .map((element) => element.tagName.toLowerCase());
    });
    expect(overflowing).toEqual([]);

    const audit = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(
      audit.violations.filter((violation) =>
        ["critical", "serious", "moderate"].includes(violation.impact ?? "")
      )
    ).toEqual([]);

    const screenshotPath = testInfo.outputPath(`platform-${width}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    await testInfo.attach(`platform-${width}`, {
      path: screenshotPath,
      contentType: "image/png",
    });
  });
}
