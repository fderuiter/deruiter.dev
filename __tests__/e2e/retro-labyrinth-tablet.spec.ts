import { test, expect, type Page } from "@playwright/test";
import { assertNoHorizontalOverflow, expectView } from "./mobile-harness";
import { describeRetroLabyrinthOnDevice } from "./helpers/retro-labyrinth-device";

// The iPad projects run this file (ADR 0061, #2032).
describeRetroLabyrinthOnDevice("Retro Labyrinth on a tablet (#2032)");

// Every iPad project is a full-screen tablet, so the cabinet mounts the
// tablet view (ADR 0062, #2859); Split View panes are phones.
async function launchOnTablet(page: Page) {
  await page.goto("/arcade/retro-labyrinth");
  const launch = page.getByRole("button", { name: /Launch Cabinet/i });
  await expect(async () => {
    if ((await launch.count()) > 0) {
      await launch.first().tap({ timeout: 2000 });
    }
    await expect(
      page.locator('[data-arcade-cabinet][data-immersive="true"]')
    ).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 90000 });
  await expect(
    page.getByRole("button", { name: "EMP: fire an EMP burst" })
  ).toBeVisible({ timeout: 90000 });
}

test("Retro Labyrinth mounts its tablet view on an iPad (#2859)", async ({
  page,
}, testInfo) => {
  test.skip(!/^iPad/.test(testInfo.project.name), "iPad projects only");
  await launchOnTablet(page);
  await expectView(page, "tablet");
});

// A landscape iPad frames the maze with a column each side (#2860): the
// route over the d-pad on the left, the objective over the tools on the
// right, every key at least 48px and inside the screen.
test("Retro Labyrinth lays a landscape iPad out in two columns (#2860)", async ({
  page,
}, testInfo) => {
  const viewport = testInfo.project.use.viewport;
  test.skip(
    !/^iPad/.test(testInfo.project.name) ||
      !viewport ||
      viewport.width <= viewport.height,
    "landscape iPad projects only"
  );
  await launchOnTablet(page);

  const canvas = await page
    .locator("[data-arcade-cabinet] canvas")
    .first()
    .boundingBox();
  const route = await page.getByTestId("labyrinth-tablet-route").boundingBox();
  const objective = await page
    .getByTestId("labyrinth-tablet-objective")
    .boundingBox();
  expect(canvas && route && objective).toBeTruthy();
  expect(route!.x + route!.width).toBeLessThanOrEqual(canvas!.x);
  expect(objective!.x).toBeGreaterThanOrEqual(canvas!.x + canvas!.width);

  const tools = page.getByRole("group", { name: "Tools and actions" });
  const keys = tools.getByRole("button");
  await expect(keys).toHaveCount(8);
  for (const slot of [1, 2, 3, 4, 5]) {
    await expect(
      tools.getByRole("button", { name: new RegExp(`tool ${slot}`, "i") })
    ).toHaveCount(1);
  }
  const height = viewport!.height;
  for (const key of await keys.all()) {
    const box = await key.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(48);
    expect(box!.height).toBeGreaterThanOrEqual(48);
    expect(box!.y + box!.height).toBeLessThanOrEqual(height);
  }
  const up = await page
    .getByRole("group", { name: "Directional pad" })
    .getByRole("button", { name: "Move Up" })
    .boundingBox();
  expect(up!.x + up!.width).toBeLessThanOrEqual(canvas!.x);
  await assertNoHorizontalOverflow(page);
});
