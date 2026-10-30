import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { assertNoHorizontalOverflow } from "../mobile-harness";
import { waitForAnimationFrames } from "./settle";
import {
  replayTspMoves,
  solveTspRoom,
  tspSyncRoomToPatrols,
} from "../../../components/retro-labyrinth/room-solver";
import {
  STEPS,
  type Cell,
} from "../../../components/retro-labyrinth/route-plan";
import { generateRoguelikeCampaign } from "../../../lib/dungeon/generator";
import { installSeededRandom } from "./seeded-random";

// Retro Labyrinth on a touch device (ADR 0061, #2032, #2003). The iPad and
// phone projects set the viewport, so each spec plays at whatever size its
// project gives it, in both orientations. Phone-class widths (Split View
// panes, the phone projects) show the desktop-only notice first; these specs
// press "Try it anyway" there. `retro-labyrinth-tablet.spec.ts` and
// `retro-labyrinth-phone.spec.ts` each register the same specs under their
// own title, so the run policy (#2517) can select them by device.
const ROUTE = "/arcade/retro-labyrinth";
const IMMERSIVE = '[data-arcade-cabinet][data-immersive="true"]';
const PLAYFIELD = ".arcade-labyrinth-playfield";
const PAUSE_OVERLAY = "pause-overlay";
const STAGE = `${IMMERSIVE} .arcade-cabinet-stage`;
const BLOCKING = new Set(["critical", "serious", "moderate"]);
// The touch target floor (ADR 0061, rule 4).
const MIN_TARGET_PX = 44;
// The EMP key: "EMP" on the phone's action cluster, which names its keys from
// the action map (#2919), and a longer name in the tablet's tool grid.
const EMP_KEY = { name: /^EMP(: fire an EMP burst)?$/ };
// The seed the room walks give the page's randomness (#3463).
const WALK_SEED = 3463;
// Patrol ticks a walk observes before it gives up looking for a route.
const MAX_OBSERVED_TICKS = 16;

/**
 * Shows the Market key. The phone keeps it in the More sheet (#2919); the
 * tablet's tool grid shows it already.
 */
async function showMarketKey(page: Page) {
  const more = page.getByRole("button", { name: "More", exact: true });
  if ((await more.count()) === 0) return;
  const sheet = page.getByRole("dialog", { name: "More" });
  await expect(async () => {
    if ((await sheet.count()) === 0) await more.tap({ timeout: 2000 });
    await expect(sheet).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 15000 });
}

/** Closes the phone's More sheet, if it is open. */
async function hideMarketKey(page: Page) {
  const close = page.getByRole("button", { name: "Close More" });
  if ((await close.count()) === 0) return;
  await close.tap();
  await expect(page.getByRole("dialog", { name: "More" })).toHaveCount(0);
}

/** A phone-width window held upright is asked to turn: the cabinet is landscape. Tablets and Split View panes keep their orientation. */
async function turnForCabinet(page: Page) {
  const size = page.viewportSize();
  if (size && size.width < 744 && size.height > size.width) {
    await page.setViewportSize({ width: size.height, height: size.width });
  }
}

/** Presses "Try it anyway" when a phone-class width shows the desktop notice. */
async function passNotice(page: Page) {
  const anyway = page.getByRole("button", { name: /Try it anyway/i });
  if (
    await anyway
      .first()
      .isVisible()
      .catch(() => false)
  ) {
    await anyway.first().tap();
  }
}

/** Taps Launch until the cabinet is immersive. Retries only while Launch is up. */
async function launchCabinet(page: Page) {
  await turnForCabinet(page);
  await passNotice(page);
  const launch = page.getByRole("button", { name: /Launch Cabinet/i });
  await expect(async () => {
    if ((await launch.count()) > 0) {
      await launch.tap({ timeout: 2000 });
    }
    await expect(page.locator(IMMERSIVE)).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 90000 });
  // The game loads as a separate chunk behind a "Building the dungeon" stub.
  // Wait for its controls, so the checks below run against the mounted game.
  await expect(page.getByRole("button", EMP_KEY)).toBeVisible({
    timeout: 90000,
  });
}

// The iPad sizes the result card and the market are checked at, both ways up.
const RESULT_SIZES: ReadonlyArray<readonly [number, number]> = [
  [1133, 744],
  [1024, 1366],
];

/** Phone controls whose text is cut off, by their visible label. */
async function clippedControls(page: Page): Promise<string[]> {
  return page.evaluate((selector) => {
    const root = document.querySelector(selector);
    if (!root) return ["no immersive cabinet"];
    const cut: string[] = [];
    root.querySelectorAll<HTMLElement>("button, span, p, h3").forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.width < 2 || !el.textContent?.trim()) return;
      const ellipsis = getComputedStyle(el).textOverflow === "ellipsis";
      const overflowing = el.scrollWidth > el.clientWidth + 1;
      if (overflowing && (el.tagName === "BUTTON" || ellipsis)) {
        cut.push(el.textContent.trim());
      }
    });
    return cut;
  }, IMMERSIVE);
}

/** Saves a screenshot as an attachment, and to LABYRINTH_SCREENS_DIR when set. */
async function shoot(page: Page, testInfo: TestInfo, name: string) {
  const body = await page.screenshot();
  await testInfo.attach(name, { body, contentType: "image/png" });
  const dir = process.env.LABYRINTH_SCREENS_DIR;
  if (dir) {
    await writeFile(path.join(dir, `${name}.png`), body);
  }
}

/** Cells of the patrols still able to catch the player, from the status group. */
async function patrolCells(
  page: Page
): Promise<Array<{ x: number; y: number }>> {
  const raw = await page
    .locator("[data-patrol-cells]")
    .first()
    .getAttribute("data-patrol-cells");
  if (!raw) return [];
  return raw.split(";").map((cell) => {
    const [x, y] = cell.split(",").map(Number);
    return { x, y };
  });
}

/** The player's grid cell, from the status group. */
async function playerCell(
  page: Page
): Promise<{ x: number; y: number } | null> {
  const raw = await page
    .locator("[data-player-cell]")
    .first()
    .getAttribute("data-player-cell");
  if (!raw) return null;
  const [x, y] = raw.split(",").map(Number);
  return { x, y };
}

/**
 * The score, from the accessible status subtree (the phone HUD leaves it out,
 * #2918), and the floor as the HUD shows it.
 */
async function readHud(page: Page) {
  return {
    score: (
      await page.locator('output[for="retro-score"]').first().textContent()
    )?.trim(),
    floor: (
      await page.getByTestId("labyrinth-phone-floor").textContent()
    )?.trim(),
  };
}

/**
 * The floor badge as either HUD shows it: the tablet's "ROOM 02", or the
 * phone chip's "02" over its "Room" caption (#2918).
 */
function floorBadge(kind: "Room" | "Subnet", number: string): RegExp {
  return new RegExp(`^(${kind} ${number}|${number}${kind})$`, "i");
}

/** Visible playfield text set below 12px, by its text (#2918). */
async function smallText(page: Page): Promise<string[]> {
  return page.evaluate((selector) => {
    const root = document.querySelector(selector);
    if (!root) return ["no playfield"];
    const small: string[] = [];
    root.querySelectorAll<HTMLElement>("*").forEach((el) => {
      const own = Array.from(el.childNodes)
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent ?? "")
        .join("")
        .trim();
      if (!own) return;
      const rect = el.getBoundingClientRect();
      // Screen-reader-only text is clipped to a pixel and never seen.
      if (rect.width <= 1 || rect.height <= 1) return;
      if (el.closest("[aria-hidden='true'], [hidden], [inert]")) return;
      const style = getComputedStyle(el);
      if (style.visibility === "hidden" || style.display === "none") return;
      if (parseFloat(style.fontSize) < 11.5) {
        small.push(`${own} (${style.fontSize})`);
      }
    });
    return small;
  }, PLAYFIELD);
}

/** Where the netrunner stands, from the accessible status subtree. */
async function readPlayerGrid(page: Page): Promise<string> {
  const text = await page
    .locator("output", { hasText: "Player Location" })
    .first()
    .textContent();
  return text ?? "";
}

/** The maze grid: rows split by "|", each cell "." for floor and "#" for wall. */
function parseOpenGrid(raw: string): boolean[][] {
  return raw.split("|").map((row) => [...row].map((ch) => ch === "."));
}

type RouteNode = Cell & { visited: boolean };

/** The route nodes: "x,y:visited" entries joined with ";". */
function parseNodes(raw: string): RouteNode[] {
  if (!raw) return [];
  return raw.split(";").map((entry) => {
    const [xy, flag] = entry.split(":");
    const [x, y] = xy.split(",").map(Number);
    return { x, y, visited: flag === "1" };
  });
}

/** The room as the status group describes it, read in one place. */
async function readRoom(page: Page) {
  const group = page.locator("[data-grid]").first();
  const [grid, nodes, exitLocked, threat, patrols, player] = await Promise.all([
    group.getAttribute("data-grid"),
    group.getAttribute("data-nodes"),
    group.getAttribute("data-exit-locked"),
    group.getAttribute("data-threat"),
    group.getAttribute("data-patrol-cells"),
    playerCell(page),
  ]);
  // A patrol's cell and the cells beside it count as closed, so the walker
  // plans around patrols instead of into them.
  const raw = parseOpenGrid(grid ?? "");
  const open = raw.map((row) => [...row]);
  for (const entry of (patrols ?? "").split(";").filter(Boolean)) {
    const [px, py] = entry.split(",").map(Number);
    for (const [dx, dy] of [
      [0, 0],
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      if (open[py + dy]?.[px + dx] !== undefined)
        open[py + dy][px + dx] = false;
    }
  }
  return {
    open,
    raw,
    nodes: parseNodes(nodes ?? ""),
    exitLocked,
    threat,
    player,
  };
}

/** The viewport the project gave this run, for the size-named screenshots. */
function projectSize(page: Page): string {
  const size = page.viewportSize();
  return size ? `${size.width}x${size.height}` : "unknown";
}

/** The patrols' cells, in the order the game lists them. */
async function readPatrolCells(page: Page): Promise<string[]> {
  const raw = await page
    .locator("[data-grid]")
    .first()
    .getAttribute("data-patrol-cells");
  return (raw ?? "").split(";").filter(Boolean);
}

/**
 * Advances the fake clock one frame at a time until the patrols move, which is
 * one enemy tick. The game's frames add up to a tick at irregular frame counts,
 * so the walk waits for the tick it can see instead of a fixed time.
 */
async function stepUntilPatrolTicks(page: Page, maxFrames = 80) {
  const before = await readPatrolCells(page);
  for (let frame = 0; frame < maxFrames; frame++) {
    await page.clock.runFor(16);
    const now = await readPatrolCells(page);
    if (now.join(";") !== before.join(";")) return;
  }
  throw new Error(`no patrol tick within ${maxFrames} frames`);
}

/** The netrunner's grid cell, parsed from the status line. */
async function readPlayerCell(page: Page): Promise<{ x: number; y: number }> {
  const text = await readPlayerGrid(page);
  const match = /Grid \((\d+), (\d+)\)/.exec(text);
  return { x: Number(match?.[1]), y: Number(match?.[2]) };
}

/**
 * Advances the game's clock. The walk installs Playwright's fake clock, so the
 * patrols only move when this runs: a walk is the same on every run.
 */
async function runGameClock(page: Page, ms: number) {
  await page.clock.runFor(ms);
}

/**
 * Registers the Retro Labyrinth touch specs under `title`. The tablet and
 * phone spec files call it, so each device class has its own file and title
 * while the specs stay one copy.
 *
 * @param title - The top-level describe title, naming the game and device.
 */
export function describeRetroLabyrinthOnDevice(title: string): void {
  test.describe(title, () => {
    // A cold game chunk on a dev server can take most of a minute to compile.
    test.setTimeout(240000);

    test.beforeEach(async ({ page }, testInfo) => {
      test.skip(!testInfo.project.use.hasTouch, "touch projects only");
      await page.emulateMedia({ reducedMotion: "reduce" });
      if (testInfo.title.startsWith("walks ")) {
        // The same run seed and patrol randomness on every run (#3463).
        await page.addInitScript(installSeededRandom, WALK_SEED);
      }
      await page.goto(ROUTE);
    });

    test("launches with the maze in the stage and nothing clipped", async ({
      page,
    }) => {
      await launchCabinet(page);

      const cabinet = page.locator(IMMERSIVE);
      await expect(cabinet).toHaveAttribute("data-mobile-layout", "fit");
      const viewport = page.viewportSize()!;
      const box = await cabinet.boundingBox();
      expect(box?.width).toBeCloseTo(viewport.width, 0);
      expect(box?.height).toBeCloseTo(viewport.height, 0);

      await assertNoHorizontalOverflow(page);

      const fit = await page.locator(PLAYFIELD).evaluate((el) => ({
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
      }));
      expect(fit.scrollHeight).toBeLessThanOrEqual(fit.clientHeight + 1);
      const stage = await page.locator(STAGE).evaluate((el) => ({
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
      }));
      expect(stage.scrollHeight).toBeLessThanOrEqual(stage.clientHeight + 1);

      // The maze is the largest part of the screen: at least half of each side.
      // The smallest phone (568x320) gives a little more to its two 3-key
      // thumb docks, the d-pad and the action cluster (#2919), at the 44px
      // floor.
      const canvas = await page
        .locator(`${PLAYFIELD} canvas`)
        .first()
        .boundingBox();
      expect(canvas).not.toBeNull();
      expect(canvas!.width).toBeGreaterThanOrEqual(
        viewport.width * (viewport.width < 600 ? 0.45 : 0.5)
      );
      expect(canvas!.height).toBeGreaterThanOrEqual(viewport.height * 0.3);
    });

    test("every control is at least 44px square", async ({ page }) => {
      await launchCabinet(page);

      const field = page.locator(PLAYFIELD);
      const controls = field
        .locator("[data-touch-button], [data-hold-dpad] button")
        .or(field.getByRole("button", { name: "Options", exact: true }))
        .or(field.getByRole("button", { name: "More", exact: true }));
      const count = await controls.count();
      // Ten or more: a starter slot that holds EMP is hidden, since the EMP key
      // already fires it.
      expect(count).toBeGreaterThanOrEqual(10);
      for (let i = 0; i < count; i++) {
        const box = await controls.nth(i).boundingBox();
        expect(box, `control ${i}`).not.toBeNull();
        expect(box!.width, `control ${i} width`).toBeGreaterThanOrEqual(
          MIN_TARGET_PX - 0.5
        );
        expect(box!.height, `control ${i} height`).toBeGreaterThanOrEqual(
          MIN_TARGET_PX - 0.5
        );
      }
    });

    test("the d-pad and tools sit inside the viewport, under the thumbs", async ({
      page,
    }) => {
      await launchCabinet(page);
      const viewport = page.viewportSize()!;
      const dpad = await page
        .getByRole("button", { name: "Move Right" })
        .boundingBox();
      const emp = await page.getByRole("button", EMP_KEY).boundingBox();
      expect(dpad).not.toBeNull();
      expect(emp).not.toBeNull();
      for (const box of [dpad!, emp!]) {
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
        expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
      }
      // Portrait keeps the docks below the maze; landscape keeps them beside it.
      const canvas = await page
        .locator(`${PLAYFIELD} canvas`)
        .first()
        .boundingBox();
      if (viewport.height > viewport.width) {
        expect(dpad!.y).toBeGreaterThanOrEqual(canvas!.y + canvas!.height - 1);
      } else {
        expect(dpad!.x + dpad!.width).toBeLessThanOrEqual(canvas!.x + 1);
      }
    });

    test("a key press hides the controls, and the next tap moves and shows them", async ({
      page,
    }) => {
      await launchCabinet(page);
      const gates = page.locator("[data-touch-controls]");
      await expect(gates.first()).toHaveAttribute(
        "data-touch-controls",
        "shown"
      );

      // Arrow keys switch the cabinet to keyboard input: the controls fade out
      // and leave the accessibility tree, but stay hit-testable.
      const keys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];
      let before = await readRoom(page);
      for (let i = 0; i < keys.length; i++) {
        await page.keyboard.press(keys[i]);
        const now = await readRoom(page);
        if (
          now.player?.x !== before.player?.x ||
          now.player?.y !== before.player?.y
        ) {
          break;
        }
      }
      await expect(gates.first()).toHaveAttribute(
        "data-touch-controls",
        "hidden"
      );
      await expect(gates.first()).toHaveAttribute("aria-hidden", "true");
      await expect(gates.first()).toHaveClass(/opacity-0/);

      // The first tap after the key press lands on a control and moves the walker
      // at once, and the controls come back with it.
      before = await readRoom(page);
      const step = STEPS.find(
        (s) => before.open[before.player!.y + s.dy]?.[before.player!.x + s.dx]
      );
      expect(step, "the walker has an open neighbour").toBeDefined();
      // The hidden controls leave the accessibility tree, so look them up with it.
      await page
        .getByRole("button", { name: step!.button, includeHidden: true })
        .tap();
      await expect(gates.first()).toHaveAttribute(
        "data-touch-controls",
        "shown"
      );
      const after = await readRoom(page);
      expect(after.player).toEqual({
        x: before.player!.x + step!.dx,
        y: before.player!.y + step!.dy,
      });
    });

    test("P and Escape pause from the keyboard, the touch cabinet stays open, and the walker moves", async ({
      page,
    }) => {
      await launchCabinet(page);
      const paused = page.getByTestId(PAUSE_OVERLAY);
      await expect(paused).toHaveCount(0);
      // The cabinet hands focus to the playfield after the game mounts; a key
      // pressed before that lands nowhere.
      await expect(page.locator(PLAYFIELD)).toBeFocused();

      // The cabinet owns P and Escape (#2357, ADR 0062): P toggles pause.
      await page.keyboard.press("p");
      await expect(paused).toBeVisible();
      await page.keyboard.press("p");
      await expect(paused).toHaveCount(0);
      // Closing the overlay hands focus back to the cabinet, which takes the
      // next key.
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              document.activeElement?.closest("[data-arcade-cabinet]") != null
          )
        )
        .toBe(true);

      // Escape pauses, then offers exit, and never closes the touch cabinet
      // out from under the room (#2569).
      await page.keyboard.press("Escape");
      await expect(paused).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(paused.getByText(/Leave the game\?/)).toBeVisible();
      await expect(page.locator(IMMERSIVE)).toBeVisible();
      await paused.getByRole("button", { name: "Resume", exact: true }).click();
      await expect(paused).toHaveCount(0);

      const start = await readPlayerGrid(page);
      const keys = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"];
      let moved = false;
      for (let i = 0; i < keys.length && !moved; i++) {
        await page.keyboard.press(keys[i]);
        moved = (await readPlayerGrid(page)) !== start;
      }
      expect(moved, "an arrow key after Escape should move the walker").toBe(
        true
      );
    });

    test("plays with taps only until the score or the floor changes", async ({
      page,
    }) => {
      await launchCabinet(page);
      const start = await readHud(page);
      const moves = ["Move Right", "Move Down", "Move Left", "Move Up"];

      let changed = false;
      for (let step = 0; step < 240 && !changed; step++) {
        // Fire the EMP now and then: it is how a bug is cleared for score.
        if (step % 4 === 3) {
          await page.getByRole("button", EMP_KEY).tap();
        } else {
          await page
            .getByRole("button", {
              name: moves[(step + Math.floor(step / 3)) % 4],
            })
            .tap();
        }
        const retry = page.getByRole("button", { name: /RETRY BREACH/i });
        if (await retry.isVisible()) await retry.tap();
        const next = page.getByRole("button", { name: /^Next Room$/ });
        if (await next.isVisible()) await next.tap();
        const now = await readHud(page);
        changed = now.score !== start.score || now.floor !== start.floor;
      }
      expect(
        changed,
        "a tap-only run should change the score or the floor"
      ).toBe(true);
    });

    test("a drag across the maze moves one step, and a tap does nothing", async ({
      page,
      browserName,
    }) => {
      test.skip(
        browserName !== "chromium",
        "touch swipes use the CDP touch API"
      );
      await launchCabinet(page);

      const canvas = await page
        .locator(`${PLAYFIELD} canvas`)
        .first()
        .boundingBox();
      expect(canvas).not.toBeNull();
      const cx = canvas!.x + canvas!.width / 2;
      const cy = canvas!.y + canvas!.height / 2;
      const before = await readPlayerGrid(page);

      const cdp = await page.context().newCDPSession(page);
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x: cx, y: cy }],
      });
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      expect(await readPlayerGrid(page)).toBe(before);

      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x: cx - 40, y: cy }],
      });
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: cx + 20, y: cy }],
      });
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      await expect(
        page.locator("output", { hasText: "Player Location" }).first()
      ).not.toHaveText(before);
    });

    test("holding a d-pad arrow walks, and releasing it stops", async ({
      page,
      browserName,
    }) => {
      test.skip(
        browserName !== "chromium",
        "touch holds use the CDP touch API"
      );
      await launchCabinet(page);

      const arrow = page.getByRole("button", { name: "Move Right" });
      const box = await arrow.boundingBox();
      expect(box).not.toBeNull();
      const cx = box!.x + box!.width / 2;
      const cy = box!.y + box!.height / 2;
      const before = await readPlayerGrid(page);

      const cdp = await page.context().newCDPSession(page);
      const cellOf = (text: string) =>
        (/\((\d+), (\d+)\)/.exec(text) ?? []).slice(1).map(Number);
      const [startX, startY] = cellOf(before);
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x: cx, y: cy }],
      });
      try {
        // A press moves one cell; only the hold repeat moves a second.
        await expect
          .poll(
            async () => {
              const [x, y] = cellOf(await readPlayerGrid(page));
              return Math.abs(x - startX) + Math.abs(y - startY);
            },
            { message: "a held arrow should walk more than one cell" }
          )
          .toBeGreaterThan(1);
      } finally {
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchEnd",
          touchPoints: [],
        });
      }
      const held = await readPlayerGrid(page);

      // Several repeat intervals' worth of frames: the walk must have stopped.
      await waitForAnimationFrames(page, 36);
      expect(await readPlayerGrid(page)).toBe(held);
    });

    test("the cabinet pauses when the tab hides and resumes on a tap", async ({
      page,
    }) => {
      await launchCabinet(page);
      await page.evaluate(() => {
        Object.defineProperty(document, "visibilityState", {
          configurable: true,
          get: () => "hidden",
        });
        document.dispatchEvent(new Event("visibilitychange"));
      });
      const paused = page.getByTestId(PAUSE_OVERLAY);
      await expect(paused).toBeVisible();
      await expect(
        paused.getByText("Paused while you were away.")
      ).toBeVisible();

      await page.evaluate(() => {
        // @ts-expect-error restoring the browser's own property
        delete document.visibilityState;
      });
      await paused.getByRole("button", { name: "Resume", exact: true }).tap();
      await expect(paused).toHaveCount(0);
    });

    test("the options sheet opens over the maze, pauses the room, and closes", async ({
      page,
    }) => {
      await launchCabinet(page);
      const cabinet = page.locator(IMMERSIVE);

      await page.getByRole("button", { name: "Options", exact: true }).tap();
      const sheet = page.getByTestId("labyrinth-options-sheet");
      await expect(sheet).toBeVisible();
      // The sheet holds the cabinet's sheet pause: the room stops, and no
      // pause overlay covers the sheet (ADR 0062).
      await expect(cabinet).toHaveAttribute("data-paused", "true");
      await expect(page.getByTestId(PAUSE_OVERLAY)).toHaveCount(0);

      // The room comes back paused, and Resume continues it.
      await sheet.getByRole("button", { name: "Close options" }).tap();
      await expect(sheet).toHaveCount(0);
      const paused = page.getByTestId(PAUSE_OVERLAY);
      await expect(paused).toBeVisible();
      await paused.getByRole("button", { name: "Resume", exact: true }).tap();
      await expect(cabinet).toHaveAttribute("data-paused", "false");
    });

    test("launch keeps the preview still, and leaving restores the same offset", async ({
      page,
    }) => {
      await turnForCabinet(page);
      await passNotice(page);
      const preview = page.locator('[data-game="retro-labyrinth"]').first();
      const launch = page.getByRole("button", { name: /Launch Cabinet/i });
      await launch.evaluate((el) => el.scrollIntoView({ block: "center" }));
      await expect(launch).toBeVisible();
      const viewport = page.viewportSize()!;
      const launchBox = await launch.boundingBox();
      expect(launchBox!.y).toBeGreaterThanOrEqual(0);
      expect(launchBox!.y + launchBox!.height).toBeLessThanOrEqual(
        viewport.height
      );
      const offsetBefore = await page.evaluate(() => window.scrollY);
      const previewBefore = await preview.boundingBox();
      expect(offsetBefore).toBeGreaterThan(0);
      expect(previewBefore).not.toBeNull();

      await launch.tap();
      await expect(page.locator(IMMERSIVE)).toBeVisible({ timeout: 90000 });
      // The body is pinned while the cabinet runs, so the page reads as scrollY 0.
      expect(await page.evaluate(() => window.scrollY)).toBe(0);
      expect((await page.locator(IMMERSIVE).boundingBox())?.y).toBeCloseTo(
        0,
        0
      );

      await page
        .getByRole("button", { name: "Reset / Power Off Cabinet" })
        .tap();
      await expect(launch).toBeVisible();
      // Exit returns to the exact offset the player left, with no layout shift.
      await expect
        .poll(() => page.evaluate(() => window.scrollY))
        .toBe(offsetBefore);
      const previewAfter = await preview.boundingBox();
      expect(Math.round(previewAfter!.y)).toBe(Math.round(previewBefore!.y));
      expect(Math.round(previewAfter!.height)).toBe(
        Math.round(previewBefore!.height)
      );
    });

    test("a rotation pauses a phone until Resume, and a tablet keeps playing", async ({
      page,
    }) => {
      await launchCabinet(page);
      const paused = page.getByTestId(PAUSE_OVERLAY);
      await expect(paused).toHaveCount(0);

      // Phones match PHONE_ORIENTATION_QUERY (short side at most 500px). Tablets
      // never pause on rotation (ADR 0061, 2026-10-13).
      const size = page.viewportSize()!;
      const phone = Math.min(size.width, size.height) <= 500;
      await page.setViewportSize({ width: size.height, height: size.width });
      await expect(page.locator(IMMERSIVE)).toBeVisible();
      if (phone) {
        await expect(paused).toBeVisible();
        await page.setViewportSize(size);
        await expect(paused).toBeVisible();
        await paused.getByRole("button", { name: "Resume", exact: true }).tap();
      }
      await page.setViewportSize(size);
      await expect(paused).toHaveCount(0);
      const start = await readPlayerGrid(page);
      const moves = ["Move Up", "Move Right", "Move Down", "Move Left"];
      let moved = false;
      for (let i = 0; i < moves.length && !moved; i++) {
        await page.getByRole("button", { name: moves[i] }).tap();
        moved = (await readPlayerGrid(page)) !== start;
      }
      expect(
        moved,
        "a move after Resume should change the player's grid cell"
      ).toBe(true);
    });

    test("no touch label is cut off with an ellipsis after a resize", async ({
      page,
    }) => {
      await launchCabinet(page);
      for (const [width, height] of RESULT_SIZES) {
        await page.setViewportSize({ width, height });
        await expect
          .poll(
            () => clippedControls(page),
            `clipped labels at ${width}x${height}`
          )
          .toEqual([]);
      }
    });

    test("lays the cabinet out on a phone or tablet stage inside the safe area (#2358)", async ({
      page,
      browserName,
    }) => {
      test.skip(browserName !== "chromium", "safe-area emulation needs CDP");
      const insets = { top: 0, left: 24, right: 32, bottom: 20 };
      const cdp = await page.context().newCDPSession(page);
      await cdp.send("Emulation.setSafeAreaInsetsOverride", { insets });
      await launchCabinet(page);

      const viewport = page.viewportSize()!;
      const stage = page.locator(`${PLAYFIELD} .arcade-stage`);
      await expect(stage).toHaveCount(1);
      // A phone, or an iPad window too narrow to be a tablet (PHONE_QUERY).
      const phone = viewport.width < 744 || viewport.height <= 500;
      const portrait = viewport.height >= viewport.width;
      await expect(stage).toHaveAttribute(
        "data-stage",
        phone ? "phone" : "tablet"
      );
      await expect(stage).toHaveAttribute(
        "data-stage-orientation",
        portrait ? "portrait" : "landscape"
      );

      const padding = await stage.evaluate((el) => {
        const body = el.querySelector(".arcade-stage-body")!;
        return {
          left: getComputedStyle(el).paddingLeft,
          right: getComputedStyle(el).paddingRight,
          bottom: getComputedStyle(body).paddingBottom,
        };
      });
      expect(padding.left).toBe(`${insets.left}px`);
      expect(padding.right).toBe(`${insets.right}px`);
      if (portrait) expect(padding.bottom).toBe(`${insets.bottom}px`);

      // The maze stays inside its slot, and the slot inside the viewport.
      const slot = await stage.locator("[data-stage-slot]").boundingBox();
      const canvas = await page
        .locator(`${PLAYFIELD} canvas`)
        .first()
        .boundingBox();
      expect(slot).not.toBeNull();
      expect(canvas).not.toBeNull();
      expect(canvas!.x).toBeGreaterThanOrEqual(slot!.x - 0.5);
      expect(canvas!.y).toBeGreaterThanOrEqual(slot!.y - 0.5);
      expect(canvas!.x + canvas!.width).toBeLessThanOrEqual(
        slot!.x + slot!.width + 0.5
      );
      expect(canvas!.y + canvas!.height).toBeLessThanOrEqual(
        slot!.y + slot!.height + 0.5
      );
      expect(slot!.x + slot!.width).toBeLessThanOrEqual(viewport.width);
      expect(slot!.y + slot!.height).toBeLessThanOrEqual(viewport.height);
      await assertNoHorizontalOverflow(page);
    });

    test("a phone plays on one HUD row with 12px text and the maze between the thumbs (#2918)", async ({
      page,
    }, testInfo) => {
      await launchCabinet(page);
      const viewport = page.viewportSize()!;
      test.skip(viewport.height > 500, "phone stage only");

      // One 44px HUD row: Room, HP, Crypto (or the boss) and RAM, then Options.
      const hud = page.getByTestId("phone-hud");
      await expect(hud).toBeVisible();
      const hudBox = (await hud.boundingBox())!;
      expect(hudBox.height).toBeLessThanOrEqual(45);
      for (const id of ["floor", "hp", "ram"]) {
        await expect(hud.getByTestId(`labyrinth-phone-${id}`)).toBeVisible();
      }
      await expect(
        hud
          .getByTestId("labyrinth-phone-crypto")
          .or(hud.getByTestId("labyrinth-phone-boss"))
      ).toBeVisible();
      await expect(
        hud.getByRole("button", { name: "Options", exact: true })
      ).toBeVisible();

      expect(await smallText(page)).toEqual([]);

      // The maze sits between the d-pad and the tool columns, and is the
      // largest thing on the screen.
      const canvas = (await page
        .locator(`${PLAYFIELD} canvas`)
        .first()
        .boundingBox())!;
      const dpad = (await page
        .getByRole("button", { name: "Move Right" })
        .boundingBox())!;
      const emp = (await page.getByRole("button", EMP_KEY).boundingBox())!;
      expect(dpad.x + dpad.width).toBeLessThanOrEqual(canvas.x + 1);
      expect(emp.x).toBeGreaterThanOrEqual(canvas.x + canvas.width - 1);
      const share =
        (canvas.width * canvas.height) / (viewport.width * viewport.height);
      // About 500x300 at 852x393; the smaller phones keep a smaller share,
      // the 568x320 one about 265x159 beside its 44px docks (#2919).
      let minShare = 0.25;
      if (viewport.width >= 800) minShare = 0.4;
      else if (viewport.width < 600) minShare = 0.22;
      expect(share).toBeGreaterThanOrEqual(minShare);
      await assertNoHorizontalOverflow(page);
      await shoot(page, testInfo, `phone-stage-${projectSize(page)}`);
    });

    test("has no blocking axe violations over the cabinet", async ({
      page,
    }) => {
      await launchCabinet(page);

      const results = await new AxeBuilder({ page })
        .include(IMMERSIVE)
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      const blocking = results.violations
        .filter((v) => BLOCKING.has(v.impact ?? ""))
        .map(
          (v) =>
            `${v.id} (${v.impact}): ${v.nodes.map((n) => `${n.target.join(" ")} ${n.html.slice(0, 160)}`).join(" / ")}`
        );
      expect(blocking).toEqual([]);
    });

    test("room 1 opens with its exit unlocked and no route nodes", async ({
      page,
    }) => {
      // Since #2048 the run opens on the DMZ Gateway; route nodes and the exit
      // lock arrive with the TSP room, fourth in the run.
      await launchCabinet(page);
      const group = page.locator("[data-grid]").first();
      await expect(group).toHaveAttribute("data-exit-locked", "false");
      const nodes = parseNodes((await group.getAttribute("data-nodes")) ?? "");
      expect(nodes).toEqual([]);
      await expect(page.getByText("Tap Next Room")).toHaveCount(0);
    });

    test("a lost run shows a result card that fits, and RETRY BREACH restarts it by touch", async ({
      page,
    }, testInfo) => {
      test.setTimeout(480000);
      await launchCabinet(page);

      // Patrols only move when the player does, so the run walks at the nearest
      // patrol until one traces the player and HP reaches zero.
      const retry = page.getByRole("button", { name: /RETRY BREACH/i });
      const moves = ["Move Up", "Move Right", "Move Down", "Move Left"];
      for (let step = 0; step < 900 && !(await retry.isVisible()); step++) {
        const from = await playerCell(page);
        const patrols = await patrolCells(page);
        if (from && patrols.length > 0) {
          const nearest = patrols.reduce((best, p) =>
            Math.abs(p.x - from.x) + Math.abs(p.y - from.y) <
            Math.abs(best.x - from.x) + Math.abs(best.y - from.y)
              ? p
              : best
          );
          const dx = nearest.x - from.x;
          const dy = nearest.y - from.y;
          const horizontal =
            dx !== 0 ? (dx > 0 ? "Move Right" : "Move Left") : null;
          const vertical = dy !== 0 ? (dy > 0 ? "Move Down" : "Move Up") : null;
          const ordered =
            Math.abs(dx) >= Math.abs(dy)
              ? [horizontal, vertical]
              : [vertical, horizontal];
          // When walls block both greedy moves, step aside so the walker
          // doesn't stand still for the rest of the test.
          const tries = [
            ...ordered.filter((n): n is string => n !== null),
            moves[step % 4],
          ];
          for (const name of tries) {
            await page
              .getByRole("button", { name })
              .tap({ timeout: 5000 })
              .catch(() => undefined);
            const now = await playerCell(page);
            if (now && (now.x !== from.x || now.y !== from.y)) break;
          }
        } else {
          await page
            .getByRole("button", { name: moves[step % 4] })
            .tap({ timeout: 5000 })
            .catch(() => undefined);
        }
        const next = page.getByRole("button", { name: /^Next Room$/ });
        if (await next.isVisible()) await next.tap({ timeout: 5000 });
      }
      await expect(retry).toBeVisible({ timeout: 15000 });

      const box = await retry.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(MIN_TARGET_PX);
      expect(box!.width).toBeGreaterThanOrEqual(MIN_TARGET_PX);
      const field = await page.locator(PLAYFIELD).boundingBox();
      expect(box!.y).toBeGreaterThanOrEqual(field!.y);
      expect(box!.y + box!.height).toBeLessThanOrEqual(
        field!.y + field!.height
      );
      await assertNoHorizontalOverflow(page);
      await shoot(page, testInfo, `result-card-${projectSize(page)}`);

      await retry.tap();
      await expect(retry).toHaveCount(0);
      const start = await readPlayerGrid(page);
      let moved = false;
      for (let i = 0; i < moves.length && !moved; i++) {
        await page.getByRole("button", { name: moves[i] }).tap();
        moved = (await readPlayerGrid(page)) !== start;
      }
      expect(moved, "the restarted run should take a move").toBe(true);
    });

    test("the darknet market is a dialog with 44px controls", async ({
      page,
    }, testInfo) => {
      await launchCabinet(page);

      // A roguelike run trades only at its rest stop, so the Market is shut in
      // Room 01 (#2291). The classic subnets have no route and keep it open:
      // switch to Subnet 01 from the options sheet to reach it.
      const market = page.getByRole("button", {
        name: "Market: open the darknet market",
      });
      await showMarketKey(page);
      await expect(
        page.getByRole("button", {
          name: "Market: Market opens at the rest stop",
        })
      ).toBeDisabled();
      await hideMarketKey(page);
      const sheet = page.getByTestId("labyrinth-options-sheet");
      await expect(async () => {
        if ((await sheet.count()) === 0) {
          await page
            .getByRole("button", { name: "Options", exact: true })
            .tap({ timeout: 2000 });
        }
        await sheet
          .getByRole("button", { name: "Subnet 01", exact: true })
          .tap({ timeout: 2000 });
        if ((await sheet.count()) > 0) {
          await sheet
            .getByRole("button", { name: "Close options" })
            .tap({ timeout: 2000 });
        }
        await expect(sheet).toHaveCount(0, { timeout: 2000 });
        await showMarketKey(page);
        await expect(market).toBeEnabled({ timeout: 2000 });
      }).toPass({ timeout: 15000 });
      await expect(page.getByTestId("labyrinth-phone-floor")).toHaveText(
        floorBadge("Subnet", "01")
      );

      const dialog = page.getByRole("dialog", {
        name: /DARKNET EXPLOIT BLACK-MARKET/,
      });
      await expect(async () => {
        if ((await dialog.count()) === 0) {
          await showMarketKey(page);
          await market.tap({ timeout: 2000 });
        }
        await expect(dialog).toBeVisible({ timeout: 2000 });
      }).toPass({ timeout: 15000 });
      await expect(
        page.getByRole("heading", { level: 2, name: /DARKNET/ })
      ).toBeVisible();

      const results = await new AxeBuilder({ page })
        .include('[role="dialog"]')
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      const blocking = results.violations
        .filter((v) => BLOCKING.has(v.impact ?? ""))
        .map(
          (v) =>
            `${v.id} (${v.impact}): ${v.nodes.map((n) => `${n.target.join(" ")} ${n.html.slice(0, 160)}`).join(" / ")}`
        );
      expect(blocking).toEqual([]);

      const controls = dialog.locator("button");
      const count = await controls.count();
      expect(count).toBeGreaterThanOrEqual(2);
      for (let i = 0; i < count; i++) {
        const box = await controls.nth(i).boundingBox();
        expect(box, `market control ${i}`).not.toBeNull();
        expect(
          box!.height,
          `market control ${i} height`
        ).toBeGreaterThanOrEqual(MIN_TARGET_PX - 0.5);
        expect(box!.width, `market control ${i} width`).toBeGreaterThanOrEqual(
          MIN_TARGET_PX - 0.5
        );
      }

      const list = dialog.getByRole("region", { name: "Market items" });
      await list.evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });
      await expect(
        dialog.getByRole("button", { name: "🪙 " }).last()
      ).toBeVisible();
      await shoot(page, testInfo, `market-${projectSize(page)}`);

      await page.getByRole("button", { name: "Close Darknet Market" }).tap();
      await expect(dialog).toHaveCount(0);
    });

    test("the phone's More sheet is a dialog with 44px controls, and closing it hands focus back to More (#2919)", async ({
      page,
    }) => {
      await launchCabinet(page);
      const more = page.getByRole("button", { name: "More", exact: true });
      test.skip((await more.count()) === 0, "the tablet has no More sheet");

      // A key press would hide the touch controls (ADR 0061), so this works
      // by touch alone; the unit suite checks Escape.
      await more.tap();
      const sheet = page.getByRole("dialog", { name: "More" });
      await expect(sheet).toBeVisible();
      await expect(sheet.getByRole("button", { name: /tool 4/ })).toBeVisible();
      await expect(sheet.getByRole("button", { name: /tool 5/ })).toBeVisible();
      await expect(
        sheet.getByRole("button", { name: /^Market: / })
      ).toBeVisible();
      const controls = sheet.getByRole("button");
      const count = await controls.count();
      for (let i = 0; i < count; i++) {
        const box = (await controls.nth(i).boundingBox())!;
        expect(box.width, `More control ${i} width`).toBeGreaterThanOrEqual(
          MIN_TARGET_PX - 0.5
        );
        expect(box.height, `More control ${i} height`).toBeGreaterThanOrEqual(
          MIN_TARGET_PX - 0.5
        );
      }
      const results = await new AxeBuilder({ page })
        .include('[role="dialog"]')
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      expect(
        results.violations
          .filter((v) => BLOCKING.has(v.impact ?? ""))
          .map((v) => v.id)
      ).toEqual([]);

      await sheet.getByRole("button", { name: "Close More" }).tap();
      await expect(sheet).toHaveCount(0);
      await expect(more).toBeFocused();
    });

    test("walks Room 1 along the solved route to the exit and reaches Room 02", async ({
      page,
    }, testInfo) => {
      test.setTimeout(300000);
      // The patrols step on the game clock, once per ENEMY_STEP_INTERVAL_MS of
      // play. Once the game is up the walk pauses the clock, so the patrols move
      // only when the walk steps them: one tick per move. The live patrols have
      // ticked in real time since the room was generated, so the walk starts the
      // solver from the patrol cells it can see, not from the generated room.
      await launchCabinet(page);
      const start = new Date();
      await page.clock.install({ time: start });
      await page.clock.pauseAt(new Date(start.getTime() + 1000));
      // Consecutive patrol states, one tick apart, pin down the patrols. Four
      // usually do; when they match more than one state of the room, or the
      // patrols stand where no route clears it yet, the walk watches another
      // tick and tries again rather than failing (#3463).
      // Room 1 is the DMZ Gateway since #2048: no route nodes or moving walls,
      // two patrols to walk around.
      const generated = generateRoguelikeCampaign()[0];
      const observed = [await readPatrolCells(page)];
      let room: ReturnType<typeof tspSyncRoomToPatrols> = null;
      let moves: ReturnType<typeof solveTspRoom> = null;
      while (observed.length <= MAX_OBSERVED_TICKS) {
        await stepUntilPatrolTicks(page);
        observed.push(await readPatrolCells(page));
        if (observed.length < 4) continue;
        room = tspSyncRoomToPatrols(generated, observed);
        moves = room && solveTspRoom(room);
        if (moves) break;
      }
      await shoot(page, testInfo, `room-start-${projectSize(page)}`);
      expect(
        room,
        `the patrols match one state of the generated room after ${observed.length} ticks`
      ).not.toBeNull();
      expect(moves, "Room 1 has a clearing route").not.toBeNull();
      for (let i = 0; i < moves!.length; i++) {
        const expected = replayTspMoves(room!, moves!.slice(0, i + 1))!;
        await page.getByRole("button", { name: `Move ${moves![i]}` }).tap();
        await expect
          .poll(() => readPlayerCell(page), `player after move ${i + 1}`)
          .toEqual({ x: expected.px, y: expected.py });
        // The patrols stop once the walker is on the exit, so the last move has
        // no tick after it.
        if (i < moves!.length - 1) {
          await stepUntilPatrolTicks(page);
          const patrols = await readPatrolCells(page);
          const modelPatrols = expected.enemies.map((e) => `${e.x},${e.y}`);
          expect(patrols, `patrols after move ${i + 1} (${moves![i]})`).toEqual(
            modelPatrols
          );
        }
      }
      await expect(page.getByText("Tap Next Room")).toBeVisible();
      await shoot(page, testInfo, `room-cleared-${projectSize(page)}`);

      await page.getByRole("button", { name: /^Next Room$/ }).tap();
      await runGameClock(page, 500);
      await expect(page.getByTestId("labyrinth-phone-floor")).toHaveText(
        floorBadge("Room", "02")
      );
      // Entering Room 02 saves the run at its first room after Room 01 (#3466).
      const save = await page.evaluate(() =>
        JSON.parse(localStorage.getItem("retro_labyrinth_run_v1") ?? "null")
      );
      expect(save).toMatchObject({ version: 1, roomIndex: 1 });
      expect(save.route).toHaveLength(2);
      expect(save.seed).toMatch(/^LAB-[0-9A-Z]{6}$/);
      await page.getByRole("button", EMP_KEY).tap();
      await expect(page.getByTestId("labyrinth-phone-toast")).toContainText(
        "EMP: "
      );
    });
  });
}
