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

// A portrait iPad keeps the maze full width on top, the room status and the
// route and objective under it, and the d-pad and tools in the bottom corners
// (#2861). The maze keeps its own aspect, so on a tall iPad the spare height
// sits above the thumbs, never between the maze and its status (the band
// #2037 closed).
test("Retro Labyrinth lays a portrait iPad out under the maze (#2861)", async ({
  page,
}, testInfo) => {
  const viewport = testInfo.project.use.viewport;
  test.skip(
    !/^iPad/.test(testInfo.project.name) ||
      !viewport ||
      viewport.width > viewport.height,
    "portrait iPad projects only"
  );
  await launchOnTablet(page);

  const canvas = await page
    .locator("[data-arcade-cabinet] canvas")
    .first()
    .boundingBox();
  const status = await page.getByTestId("labyrinth-room-panel").boundingBox();
  const objective = await page
    .getByTestId("labyrinth-tablet-objective")
    .boundingBox();
  const route = await page.getByTestId("labyrinth-tablet-route").boundingBox();
  expect(canvas && status && objective && route).toBeTruthy();
  expect(canvas!.width).toBeGreaterThanOrEqual(viewport!.width * 0.9);
  expect(status!.y).toBeGreaterThanOrEqual(canvas!.y + canvas!.height);
  expect(status!.y - (canvas!.y + canvas!.height)).toBeLessThanOrEqual(16);
  expect(objective!.y).toBeGreaterThanOrEqual(status!.y + status!.height);
  expect(route!.y).toBe(objective!.y);
  expect(route!.x + route!.width).toBeLessThanOrEqual(objective!.x);

  const pad = page.getByRole("group", { name: "Directional pad" });
  const up = await pad.getByRole("button", { name: "Move Up" }).boundingBox();
  const left = await pad
    .getByRole("button", { name: "Move Left" })
    .boundingBox();
  expect(up && left).toBeTruthy();
  expect(left!.x).toBeLessThan(viewport!.width / 2);
  // The d-pad keeps to its half: it never reaches into the tools' column.
  const padBox = await pad.boundingBox();
  expect(padBox!.x + padBox!.width).toBeLessThanOrEqual(viewport!.width / 2);
  expect(up!.y).toBeGreaterThanOrEqual(objective!.y + objective!.height);
  const down = await pad
    .getByRole("button", { name: "Move Down" })
    .boundingBox();
  expect(viewport!.height - (down!.y + down!.height)).toBeLessThanOrEqual(48);

  const emp = await page
    .getByRole("button", { name: "EMP: fire an EMP burst" })
    .boundingBox();
  expect(emp!.x).toBeGreaterThanOrEqual(viewport!.width / 2);

  for (const key of await page
    .locator('[data-dock] button:visible, [data-dock] [role="button"]:visible')
    .all()) {
    const box = await key.boundingBox();
    if (!box) continue;
    expect(box.width).toBeGreaterThanOrEqual(48);
    expect(box.height).toBeGreaterThanOrEqual(48);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport!.height);
  }
  await assertNoHorizontalOverflow(page);
});

// A left-handed player (the cabinet's Setup sheet, #2862) gets the d-pad on
// the right and the tools on the left, in both orientations.
test("Retro Labyrinth swaps the tablet docks for a left hand (#2862)", async ({
  page,
}, testInfo) => {
  const viewport = testInfo.project.use.viewport;
  test.skip(
    !/^iPad/.test(testInfo.project.name) || !viewport,
    "iPad projects only"
  );
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "arcade_device_settings_v1",
      JSON.stringify({ version: 1, handedness: "left" })
    );
  });
  await launchOnTablet(page);
  await expect(page.locator(".arcade-stage")).toHaveAttribute(
    "data-handedness",
    "left"
  );

  const middle = viewport!.width / 2;
  const up = await page
    .getByRole("group", { name: "Directional pad" })
    .getByRole("button", { name: "Move Up" })
    .boundingBox();
  const emp = await page
    .getByRole("button", { name: "EMP: fire an EMP burst" })
    .boundingBox();
  expect(up && emp).toBeTruthy();
  expect(up!.x + up!.width / 2).toBeGreaterThan(middle);
  expect(emp!.x + emp!.width / 2).toBeLessThan(middle);
  if (viewport!.width > viewport!.height) {
    // Landscape: each dock stays in its own column beside the maze.
    const canvas = await page
      .locator("[data-arcade-cabinet] canvas")
      .first()
      .boundingBox();
    expect(up!.x).toBeGreaterThanOrEqual(canvas!.x + canvas!.width);
    expect(emp!.x + emp!.width).toBeLessThanOrEqual(canvas!.x);
  }
  await assertNoHorizontalOverflow(page);
});
