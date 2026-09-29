import { test, expect } from "@playwright/test";

test.describe("Study Director (/arcade/study-director)", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("launches, answers a message, spends attention and ends the day", async ({
    page,
  }) => {
    await page.goto("/arcade/study-director");
    await page.waitForLoadState("domcontentloaded");

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    );
    expect(overflow).toBe(false);

    await expect(async () => {
      await page.getByRole("button", { name: /Launch Cabinet/i }).click();
      await expect(
        page.getByRole("button", { name: /Start the study/i })
      ).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 15000 });

    await page.getByRole("button", { name: /Start the study/i }).click();
    await expect(page.getByText(/Day 1 \/ 77/)).toBeVisible();

    await page.getByRole("button", { name: /Sure, we'll add them/ }).click();
    await expect(
      page.getByRole("img", { name: /7 of 8 attention left today/ })
    ).toBeVisible();

    await page.getByRole("button", { name: "End day" }).click();
    await expect(page.getByText(/Day 2 \/ 77/)).toBeVisible();
  });
});
