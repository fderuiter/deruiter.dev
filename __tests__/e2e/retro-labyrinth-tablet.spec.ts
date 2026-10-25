import { test, expect } from "@playwright/test";
import { expectView } from "./mobile-harness";
import { describeRetroLabyrinthOnDevice } from "./helpers/retro-labyrinth-device";

// The iPad projects run this file (ADR 0061, #2032).
describeRetroLabyrinthOnDevice("Retro Labyrinth on a tablet (#2032)");

// Every iPad project is a full-screen tablet, so the cabinet mounts the
// tablet view (ADR 0062, #2859); Split View panes are phones.
test("Retro Labyrinth mounts its tablet view on an iPad (#2859)", async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.use.hasTouch, "touch projects only");
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
  await expectView(page, "tablet");
  await expect(
    page.getByRole("button", { name: "EMP: fire an EMP burst" })
  ).toBeVisible({ timeout: 90000 });
});
