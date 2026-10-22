import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

for (const width of [320, 375, 768, 1440]) {
  test(`strategy toolkit works at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/platform/strategy");
    await expect(
      page.getByRole("heading", { level: 1, name: "Platform strategy toolkit" })
    ).toBeVisible();
    await expect(async () => {
      await page
        .getByRole("spinbutton", { name: "Functional fit weight" })
        .fill("0");
      await expect(page).toHaveURL(/#strategy=/);
    }).toPass({ timeout: 15000 });
    await page.reload();
    await expect(
      page.getByRole("spinbutton", { name: "Functional fit weight" })
    ).toHaveValue("0");
    const overflow = await page.evaluate(() => {
      const width = document.documentElement.clientWidth;
      return [...document.querySelectorAll("main *")]
        .filter((element) => {
          let parent = element.parentElement;
          while (parent && parent !== document.body) {
            if (
              ["auto", "scroll", "hidden", "clip"].includes(
                getComputedStyle(parent).overflowX
              )
            )
              return false;
            parent = parent.parentElement;
          }
          return element.getBoundingClientRect().right > width + 1;
        })
        .map((element) => element.tagName);
    });
    expect(overflow).toEqual([]);
    const audit = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(
      audit.violations.filter((v) =>
        ["critical", "serious", "moderate"].includes(v.impact ?? "")
      )
    ).toEqual([]);
    const screenshotPath = testInfo.outputPath(`strategy-${width}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    await testInfo.attach(`strategy-${width}`, {
      path: screenshotPath,
      contentType: "image/png",
    });
  });
}

test("memo exports are generated in the browser", async ({ page }) => {
  await page.goto("/platform/strategy");
  await expect(
    page.getByRole("heading", { level: 2, name: "05 / Decision memo" })
  ).toBeVisible();
  for (const [label, extension] of [
    ["Download HTML", ".html"],
    ["Download Markdown", ".md"],
  ]) {
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: label }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain(extension);
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    expect(Buffer.concat(chunks).toString("utf8")).toContain("Synthetic data");
  }
});
