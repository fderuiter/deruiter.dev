import path from "node:path";
import { test, expect, type Page } from "@playwright/test";

const SAVE_KEY = "study_director_world_v1";

type Json = Record<string, unknown>;
type Member = { id: string; workload: number };
type Site = Json & { openQueries: number };

/** How each floor is staged: plain edits to a saved world run. */
const FLOORS: Record<string, (world: Json) => Json> = {
  calm: (world) => world,
  stressed: (world) => {
    const study = world.study as Json;
    const load: Record<string, number> = {
      maya: 88,
      walt: 80,
      dana: 70,
      priya: 70,
    };
    return {
      ...world,
      coffees: 3,
      fatigue: 10,
      study: {
        ...study,
        day: 20,
        team: (study.team as Member[]).map((m) => ({
          ...m,
          workload: load[m.id] ?? m.workload,
        })),
        sites: (study.sites as Site[]).map((s) => ({ ...s, openQueries: 12 })),
        documentationDebt: 45,
        adjust: { ...(study.adjust as Json), client: -15, team: -35 },
      },
    };
  },
  crisis: (world) => {
    const study = world.study as Json;
    return {
      ...world,
      coffees: 6,
      fatigue: 40,
      study: {
        ...study,
        day: 90,
        slipDays: 30,
        team: (study.team as Member[]).map((m) => ({ ...m, workload: 98 })),
        sites: (study.sites as Site[]).map((s) => ({ ...s, openQueries: 40 })),
        documentationDebt: 90,
        adjust: {
          ...(study.adjust as Json),
          integrity: -70,
          compliance: -70,
          client: -70,
          team: -70,
        },
      },
    };
  },
};

/**
 * The stage is a window that follows the player, so what is on screen
 * depends on where they stand: this one puts them in their own office, beside
 * the waste bin.
 */
FLOORS.crisisOffice = (world) => ({
  ...FLOORS.crisis(world),
  player: { x: 4, y: 3, facing: "up" },
  location: "office",
});

async function launchWorld(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("study_director_world_intro_seen", "1");
  });
  await page.goto("/arcade/study-director#mode=world");
  await page.waitForLoadState("domcontentloaded");
  await expect(async () => {
    await page.getByRole("button", { name: /Launch Cabinet/i }).click();
    await expect(page.getByTestId("world-hud")).toBeVisible({
      timeout: 2000,
    });
  }).toPass({ timeout: 15000 });
}

/** Opens the world, rewrites its save into the staged floor, and reloads. */
async function stageFloor(page: Page, floor: string) {
  await launchWorld(page);
  const raw = await page.evaluate(
    (key) => window.localStorage.getItem(key),
    SAVE_KEY
  );
  expect(raw).toBeTruthy();
  const staged = FLOORS[floor](JSON.parse(raw ?? "{}") as Json);
  await page.evaluate(
    ([key, value]) => window.localStorage.setItem(key, value),
    [SAVE_KEY, JSON.stringify(staged)] as const
  );
  await page.reload();
  await launchWorld(page);
  await page.getByTestId("world-canvas").scrollIntoViewIfNeeded();
}

async function canvasPixels(page: Page): Promise<string> {
  return page
    .getByTestId("world-canvas")
    .evaluate((c) => (c as HTMLCanvasElement).toDataURL());
}

/** The canvas once it has stopped changing (fonts, resize, first draw). */
async function settledPixels(page: Page): Promise<string> {
  let last = "";
  await expect
    .poll(
      async () => {
        const prev = last;
        await page.waitForTimeout(200);
        last = await canvasPixels(page);
        return prev === last;
      },
      { timeout: 10000 }
    )
    .toBe(true);
  return last;
}

test.describe("Study Director world: the office tells the story", () => {
  test.use({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });

  for (const width of [1280, 1440]) {
    for (const floor of Object.keys(FLOORS)) {
      test(`${floor} floor at ${width}`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width, height: 900 });
        await page.emulateMedia({ reducedMotion: "reduce" });
        await stageFloor(page, floor);
        const room = page.getByTestId("world-room");
        if (floor === "crisis") {
          await expect(page.getByTestId("world-canvas")).toHaveAttribute(
            "aria-label",
            /sponsor piled at reception/
          );
        } else {
          await expect(room).toBeVisible();
        }
        const overflow = await page.evaluate(
          () =>
            document.documentElement.scrollWidth >
            document.documentElement.clientWidth
        );
        expect(overflow).toBe(false);
        // Clear the fixed site header, then capture the floor and its panel.
        await page.evaluate(() => {
          const top = document
            .querySelector("[data-sd-world]")
            ?.getBoundingClientRect().top;
          if (top !== undefined) window.scrollBy(0, top - 80);
        });
        const dir = process.env.SD_SHOTS_DIR ?? testInfo.outputPath();
        await page.screenshot({
          path: path.join(dir, `floor-${floor}-${width}.png`),
        });
      });
    }
  }

  test("the bin fire flickers only under motion-safe", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await stageFloor(page, "crisisOffice");
    const still = await settledPixels(page);
    await page.waitForTimeout(400);
    expect(await canvasPixels(page)).toBe(still);

    await page.emulateMedia({ reducedMotion: "no-preference" });
    await expect
      .poll(
        async () => {
          const a = await canvasPixels(page);
          await page.waitForTimeout(150);
          return a !== (await canvasPixels(page));
        },
        { timeout: 5000 }
      )
      .toBe(true);
  });

  test("a calm floor runs no animation loop", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await stageFloor(page, "calm");
    const first = await settledPixels(page);
    await page.waitForTimeout(400);
    expect(await canvasPixels(page)).toBe(first);
  });
});
