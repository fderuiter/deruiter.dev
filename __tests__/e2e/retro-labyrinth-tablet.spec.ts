import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { assertNoHorizontalOverflow } from "./mobile-harness";

// Retro Labyrinth on a touch tablet (ADR 0061, #2032). The iPad projects set
// the viewport, so each spec plays at whatever size its project gives it, in
// both orientations. Phone-class widths (Split View panes, Small Phone) show
// the desktop-only notice first; these specs press "Try it anyway" there.
const ROUTE = "/arcade/retro-labyrinth";
const IMMERSIVE = '[data-arcade-cabinet][data-immersive="true"]';
const PLAYFIELD = ".arcade-labyrinth-playfield";
const STAGE = `${IMMERSIVE} .arcade-cabinet-stage`;
const BLOCKING = new Set(["critical", "serious", "moderate"]);
// The touch target floor (ADR 0061, rule 4).
const MIN_TARGET_PX = 44;

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
  await expect(
    page.getByRole("button", { name: "EMP: fire an EMP burst" })
  ).toBeVisible({ timeout: 90000 });
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

/** The score and floor as the phone HUD shows them. */
async function readHud(page: Page) {
  return {
    score: (
      await page.getByTestId("labyrinth-phone-score").textContent()
    )?.trim(),
    floor: (
      await page.getByTestId("labyrinth-phone-floor").textContent()
    )?.trim(),
  };
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

type Cell = { x: number; y: number };
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

/** Each d-pad button, with the grid step it takes. Y grows downwards. */
const STEPS: ReadonlyArray<{ button: string; dx: number; dy: number }> = [
  { button: "Move Up", dx: 0, dy: -1 },
  { button: "Move Down", dx: 0, dy: 1 },
  { button: "Move Left", dx: -1, dy: 0 },
  { button: "Move Right", dx: 1, dy: 0 },
];

/** The shortest route over open cells, excluding the start. Null if none. */
function planRoute(open: boolean[][], from: Cell, to: Cell): Cell[] | null {
  const key = (c: Cell) => `${c.x},${c.y}`;
  const cameFrom = new Map<string, Cell>();
  const seen = new Set<string>([key(from)]);
  const queue: Cell[] = [from];
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head];
    if (current.x === to.x && current.y === to.y) {
      const route: Cell[] = [];
      let at: Cell | undefined = current;
      while (at && key(at) !== key(from)) {
        route.unshift(at);
        at = cameFrom.get(key(at));
      }
      return route;
    }
    for (const step of STEPS) {
      const next = { x: current.x + step.dx, y: current.y + step.dy };
      if (!open[next.y]?.[next.x] || seen.has(key(next))) continue;
      seen.add(key(next));
      cameFrom.set(key(next), current);
      queue.push(next);
    }
  }
  return null;
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

test.describe("Retro Labyrinth on a tablet (#2032)", () => {
  // A cold game chunk on a dev server can take most of a minute to compile.
  test.setTimeout(240000);

  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(!testInfo.project.use.hasTouch, "touch projects only");
    await page.emulateMedia({ reducedMotion: "reduce" });
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
    const canvas = await page
      .locator(`${PLAYFIELD} canvas`)
      .first()
      .boundingBox();
    expect(canvas).not.toBeNull();
    expect(canvas!.width).toBeGreaterThanOrEqual(viewport.width * 0.5);
    expect(canvas!.height).toBeGreaterThanOrEqual(viewport.height * 0.3);
  });

  test("every control is at least 44px square", async ({ page }) => {
    await launchCabinet(page);

    const field = page.locator(PLAYFIELD);
    const controls = field
      .locator("[data-touch-button], [data-hold-dpad] button")
      .or(field.getByRole("button", { name: "Options", exact: true }));
    const count = await controls.count();
    expect(count).toBeGreaterThanOrEqual(11);
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
    const emp = await page
      .getByRole("button", { name: "EMP: fire an EMP burst" })
      .boundingBox();
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
        await page
          .getByRole("button", { name: "EMP: fire an EMP burst" })
          .tap();
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
    expect(changed, "a tap-only run should change the score or the floor").toBe(
      true
    );
  });

  test("a drag across the maze moves one step, and a tap does nothing", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", "touch swipes use the CDP touch API");
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
    test.skip(browserName !== "chromium", "touch holds use the CDP touch API");
    await launchCabinet(page);

    const arrow = page.getByRole("button", { name: "Move Right" });
    const box = await arrow.boundingBox();
    expect(box).not.toBeNull();
    const cx = box!.x + box!.width / 2;
    const cy = box!.y + box!.height / 2;
    const before = await readPlayerGrid(page);

    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: cx, y: cy }],
    });
    await page.waitForTimeout(900);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    const held = await readPlayerGrid(page);
    expect(held, "a held arrow should walk more than one cell").not.toBe(
      before
    );

    await page.waitForTimeout(600);
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
    await expect(page.getByText("PAUSED", { exact: true })).toBeVisible();
    await expect(page.getByText("Tap Resume")).toBeVisible();

    await page.evaluate(() => {
      // @ts-expect-error restoring the browser's own property
      delete document.visibilityState;
    });
    await page.getByRole("button", { name: "Resume", exact: true }).tap();
    await expect(page.getByText("PAUSED", { exact: true })).toHaveCount(0);
  });

  test("the options sheet opens over the maze, pauses the room, and closes", async ({
    page,
  }) => {
    await launchCabinet(page);

    await page.getByRole("button", { name: "Options", exact: true }).tap();
    const sheet = page.getByTestId("labyrinth-options-sheet");
    await expect(sheet).toBeVisible();
    await expect(page.getByText("PAUSED", { exact: true })).toBeVisible();

    await sheet.getByRole("button", { name: "Close options" }).tap();
    await expect(sheet).toHaveCount(0);
  });

  test("launch keeps the preview still, and leaving restores the same offset", async ({
    page,
  }) => {
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
    expect(await page.evaluate(() => window.scrollY)).toBe(offsetBefore);
    expect((await page.locator(IMMERSIVE).boundingBox())?.y).toBeCloseTo(0, 0);

    await page.getByRole("button", { name: "Reset / Power Off Cabinet" }).tap();
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

  test("a rotation mid-run keeps the room paused, and it resumes only on Resume", async ({
    page,
  }) => {
    await launchCabinet(page);
    const paused = page.getByText("PAUSED", { exact: true });
    await expect(paused).toHaveCount(0);

    const size = page.viewportSize()!;
    await page.setViewportSize({ width: size.height, height: size.width });
    await expect(page.locator(IMMERSIVE)).toBeVisible();
    await expect(paused).toBeVisible();

    await page.setViewportSize(size);
    await expect(paused).toBeVisible();

    await page.getByRole("button", { name: "Resume", exact: true }).tap();
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

  test("has no blocking axe violations over the cabinet", async ({ page }) => {
    await launchCabinet(page);

    const results = await new AxeBuilder({ page })
      .include(IMMERSIVE)
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const blocking = results.violations
      .filter((v) => BLOCKING.has(v.impact ?? ""))
      .map((v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s)`);
    expect(blocking).toEqual([]);
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
        for (const name of ordered.filter((n): n is string => n !== null)) {
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
    expect(box!.y + box!.height).toBeLessThanOrEqual(field!.y + field!.height);
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

    await page
      .getByRole("button", { name: "Market: open the darknet market" })
      .tap();
    const dialog = page.getByRole("dialog", {
      name: /DARKNET EXPLOIT BLACK-MARKET/,
    });
    await expect(dialog).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 2, name: /DARKNET/ })
    ).toBeVisible();

    const results = await new AxeBuilder({ page })
      .include('[role="dialog"]')
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const blocking = results.violations
      .filter((v) => BLOCKING.has(v.impact ?? ""))
      .map((v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s)`);
    expect(blocking).toEqual([]);

    const controls = dialog.locator("button");
    const count = await controls.count();
    expect(count).toBeGreaterThanOrEqual(2);
    for (let i = 0; i < count; i++) {
      const box = await controls.nth(i).boundingBox();
      expect(box, `market control ${i}`).not.toBeNull();
      expect(box!.height, `market control ${i} height`).toBeGreaterThanOrEqual(
        MIN_TARGET_PX - 0.5
      );
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

  test("walks every route node and opens the exit", async ({
    page,
  }, testInfo) => {
    test.setTimeout(420000);
    await launchCabinet(page);

    const exitRaw = await page
      .locator("[data-exit-cell]")
      .first()
      .getAttribute("data-exit-cell");
    const [exitX, exitY] = (exitRaw ?? "").split(",").map(Number);
    const exit: Cell = { x: exitX, y: exitY };

    let arrived = false;
    let nodesDone = false;
    let plan: Cell[] = [];
    let retries = 0;
    // Steps the walk may spend without a route before it gives up. Each step
    // into an open cell shifts the walls, so the next pass sees a new maze.
    let stalled = 0;
    const deadline = Date.now() + 360000;

    while (!arrived && Date.now() < deadline) {
      const retry = page.getByRole("button", { name: /RETRY BREACH/i });
      if (await retry.isVisible()) {
        retries += 1;
        if (retries > 3)
          throw new Error("the run was lost before the walk finished");
        await retry.tap();
        plan = [];
        nodesDone = false;
        stalled = 0;
        continue;
      }
      if (await page.getByText("Tap Next Room").isVisible()) {
        arrived = true;
        break;
      }

      let room = await readRoom(page);
      if (!room.player) throw new Error("the player cell is not on the page");

      // A patrol close by: give it time to pass before stepping.
      if (room.threat === "amber" || room.threat === "red") {
        await expect
          .poll(async () => (await readRoom(page)).threat, { timeout: 4000 })
          .toBe("none")
          .catch(() => undefined);
        room = await readRoom(page);
        if (!room.player) throw new Error("the player cell is not on the page");
      }

      const unvisited = room.nodes.filter((node) => !node.visited);
      if (unvisited.length > 0) {
        expect(
          room.exitLocked,
          "the exit stays locked while nodes remain"
        ).toBe("true");
      } else if (!nodesDone) {
        nodesDone = true;
        await expect
          .poll(async () => (await readRoom(page)).exitLocked, {
            timeout: 5000,
          })
          .toBe("false");
        await expect(page.getByTestId("labyrinth-phone-toast")).toContainText(
          "Exit open"
        );
      }

      const targets = unvisited.length > 0 ? unvisited : [exit];
      const player = room.player;
      // Keep following the current plan while its next cell is open.
      let route: Cell[] | null =
        plan.length > 0 &&
        room.open[plan[0].y]?.[plan[0].x] &&
        Math.abs(plan[0].x - player.x) + Math.abs(plan[0].y - player.y) === 1 &&
        targets.some(
          (t) =>
            t.x === plan[plan.length - 1].x && t.y === plan[plan.length - 1].y
        )
          ? plan
          : null;
      for (const target of route ? [] : targets) {
        const candidate = planRoute(
          stalled > 8 ? room.raw : room.open,
          player,
          target
        );
        if (candidate && (!route || candidate.length < route.length)) {
          route = candidate;
        }
      }

      if (!route || route.length === 0) {
        // No open route: the walls move on the player's steps, so take a
        // step to any open neighbour and plan again. With patrols on every
        // side, wait for them to move on instead.
        stalled += 1;
        const open = STEPS.filter(
          (s) => room.open[player.y + s.dy]?.[player.x + s.dx]
        );
        if (open.length === 0) {
          await page.waitForTimeout(400);
          continue;
        }
        const pick = open[stalled % open.length];
        await page.getByRole("button", { name: pick.button }).tap();
        await page.waitForTimeout(150);
        plan = [];
        continue;
      }
      stalled = 0;

      const next = route[0];
      plan = route.slice(1);
      const move = STEPS.find(
        (s) => s.dx === next.x - player.x && s.dy === next.y - player.y
      );
      if (!move) throw new Error("the route left the grid's neighbours");
      await page.getByRole("button", { name: move.button }).tap();
      // A blocked step leaves the cell as it was; the next pass re-plans.
      await expect
        .poll(async () => playerCell(page), { timeout: 2000 })
        .not.toEqual(player)
        .catch(() => undefined);
    }

    expect(arrived, "the walk should reach the room-cleared card").toBe(true);
    expect(nodesDone, "the walk should visit every route node first").toBe(
      true
    );
    await expect(page.getByText("Tap Next Room")).toBeVisible();
    await shoot(page, testInfo, `room-cleared-${projectSize(page)}`);

    await page.getByRole("button", { name: /^Next Room$/ }).tap();
    await expect(page.getByTestId("labyrinth-phone-floor")).toHaveText(
      "ROOM 02",
      { timeout: 30000 }
    );
    await page.getByRole("button", { name: "EMP: fire an EMP burst" }).tap();
    await expect(page.getByTestId("labyrinth-phone-toast")).toContainText(
      "EMP: "
    );
  });
});
