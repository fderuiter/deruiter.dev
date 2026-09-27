import { expect, test } from "@playwright/test";

test("one-sided Screening window is described accurately in the studio", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/crf");

  const spine = page.locator('[data-testid="study-spine-root"]:visible');
  await expect(spine).toContainText("Day -1 (-27d/+0d)");

  await expect(async () => {
    await page.getByRole("tab", { name: /Matrix \(SoA\)/ }).click();
    await expect(page.getByText("Day -1 (-27d/+0d)").first()).toBeVisible();
  }).toPass({ timeout: 15000 });

  await expect(async () => {
    await page.getByRole("button", { name: "Cards" }).click();
    await expect(
      page.getByText("Target Day -1 (-27d/+0d window)")
    ).toBeVisible();
  }).toPass({ timeout: 15000 });
});
