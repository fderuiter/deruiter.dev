import { expect, test } from "@playwright/test";

const viewports = [
  { name: "320px", width: 320, height: 568 },
  { name: "375px", width: 375, height: 667 },
  { name: "768px", width: 768, height: 1024 },
  { name: "1440px", width: 1440, height: 900 },
];

for (const viewport of viewports) {
  test(`featured project previews remain usable at ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expect(
      page.getByRole("heading", {
        name: "Things I’ve built. Reasons I built them.",
      })
    ).toBeVisible();

    const cards = page.getByTestId("featured-project-card");
    await expect(cards).toHaveCount(3);

    for (const card of await cards.all()) {
      // Under reduced motion the card runs no transition: either it has none
      // (motion-reduce:transition-none) or every duration is zero (#3976).
      const reducedMotionDuration = await card.evaluate((element) => {
        const style = window.getComputedStyle(element);
        if (style.transitionProperty === "none") return 0;
        const raw = style.transitionDuration;
        if (!raw) return 0;
        const durations = raw
          .split(",")
          .map((s) => Number.parseFloat(s.trim()) || 0);
        return Math.max(...durations);
      });
      expect(reducedMotionDuration).toBeLessThanOrEqual(0.00001);
      await expect(card.getByText("Problem", { exact: true })).toBeVisible();
      await expect(
        card.getByText("Contribution", { exact: true })
      ).toBeVisible();
      await expect(card.getByText("Outcome", { exact: true })).toBeVisible();

      const action = card.getByRole("link", { name: /Read the .+ case study/ });
      await expect(action).toBeVisible();
      await expect(action).toHaveCSS("min-height", "44px");
      const actionBox = await action.boundingBox();
      expect(actionBox?.width).toBeGreaterThanOrEqual(44);
      expect(actionBox?.height).toBeGreaterThanOrEqual(44);
      await action.focus();
      await expect(action).toBeFocused();
    }

    const overflowingCards = await cards.evaluateAll(
      (projectCards) =>
        projectCards.filter((card) => card.scrollWidth > card.clientWidth)
          .length
    );
    expect(overflowingCards).toBe(0);
  });
}

test("featured project previews remain bounded with 200% text scaling", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });

  const cards = page.getByTestId("featured-project-card");
  await expect(cards).toHaveCount(3);

  const overflowingCards = await cards.evaluateAll(
    (projectCards) =>
      projectCards.filter((card) => card.scrollWidth > card.clientWidth).length
  );
  expect(overflowingCards).toBe(0);
});

test("featured project previews contain 40% longer detail without horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/");
  await page
    .locator('[data-testid="featured-project-card"] dd')
    .evaluateAll((details) => {
      for (const detail of details) {
        const original = detail.textContent ?? "";
        detail.textContent = `${original} ${original.slice(
          0,
          Math.ceil(original.length * 0.4)
        )}`;
      }
    });

  const cards = page.getByTestId("featured-project-card");
  const overflowingCards = await cards.evaluateAll(
    (projectCards) =>
      projectCards.filter((card) => card.scrollWidth > card.clientWidth).length
  );
  expect(overflowingCards).toBe(0);
});
