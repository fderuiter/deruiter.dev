import { describe, it, expect } from "vitest";
import {
  EDGE_E,
  EDGE_N,
  EDGE_S,
  EDGE_W,
  FOG_REMEMBERED,
  FOG_UNSEEN,
  LABYRINTH_INK,
  LOGICAL_HEIGHT,
  LOGICAL_WIDTH,
  PLATE_HEIGHT,
  TILE,
  boardSafeColor,
  clampLabelCenter,
  computeIntegerCanvasSize,
  enemySprite,
  enemyTint,
  fitFontSize,
  floorVariant,
  fogAlpha,
  isSolidWallRow,
  itemArt,
  mixHex,
  plateOnWall,
  roomPlateText,
  routeDots,
  routeTiles,
  tilePaletteFor,
  walkablePath,
  wallEdgeMask,
} from "@/components/retro-labyrinth/labyrinth-art";
import {
  ATLAS,
  SPRITES,
  parseSprite,
  spriteOutline,
} from "@/components/retro-labyrinth/labyrinth-atlas";
import {
  LABYRINTH_CRT_OFF,
  LABYRINTH_CRT_SOFT,
  isCrtIdle,
  resolveLabyrinthCrt,
} from "@/components/retro-labyrinth/labyrinth-crt";
import { CRT_PRESETS } from "@/lib/arcade/crt-pipeline";
import { CRT_THEMES, STAGE_1_MAZE } from "@/lib/dungeon";

describe("integer-scale canvas sizing (#1522)", () => {
  it("uses the largest whole scale that fits, in device pixels", () => {
    // 1280x800 cabinet: about 773 x 464 CSS px available.
    const size = computeIntegerCanvasSize(773, 464, 1);
    expect(size.scale).toBe(3);
    expect(size.backingWidth).toBe(LOGICAL_WIDTH * 3);
    expect(size.backingHeight).toBe(LOGICAL_HEIGHT * 3);
    expect(size.cssWidth).toBe(720);
    expect(size.cssHeight).toBe(432);
  });

  it("maps each art pixel to whole device pixels on HiDPI screens", () => {
    const size = computeIntegerCanvasSize(773, 464, 2);
    expect(size.scale).toBe(6);
    expect(size.cssWidth * 2).toBe(size.backingWidth);
    const fractional = computeIntegerCanvasSize(773, 464, 1.5);
    expect(Number.isInteger(fractional.scale)).toBe(true);
    expect(fractional.cssWidth * 1.5).toBeCloseTo(fractional.backingWidth);
  });

  it("is limited by the shorter side of the box", () => {
    expect(computeIntegerCanvasSize(2000, 300, 1).scale).toBe(2);
  });

  it("keeps an exact multiple at that multiple", () => {
    expect(computeIntegerCanvasSize(480, 288, 1).scale).toBe(2);
  });

  it("falls back to 1x, shown shrunk, when the box is too small", () => {
    const size = computeIntegerCanvasSize(200, 100, 1);
    expect(size.scale).toBe(1);
    expect(size.backingWidth).toBe(LOGICAL_WIDTH);
    expect(size.cssWidth).toBe(200);
    expect(size.cssHeight).toBeCloseTo((200 * LOGICAL_HEIGHT) / LOGICAL_WIDTH);
  });

  it("survives zero, negative and non-finite input", () => {
    for (const [w, h, dpr] of [
      [0, 0, 1],
      [-5, 10, 1],
      [Number.NaN, 400, 2],
      [800, 600, 0],
      [800, 600, Number.POSITIVE_INFINITY],
    ]) {
      const size = computeIntegerCanvasSize(w, h, dpr);
      expect(size.scale).toBeGreaterThanOrEqual(1);
      expect(Number.isFinite(size.cssWidth)).toBe(true);
    }
  });
});

describe("tile atlas rules", () => {
  const maze = [
    ["#", "#", "#"],
    ["#", " ", "#"],
    ["#", "#", "#"],
  ];

  it("marks only the wall sides that face floor", () => {
    expect(wallEdgeMask(maze, 1, 0)).toBe(EDGE_S);
    expect(wallEdgeMask(maze, 1, 2)).toBe(EDGE_N);
    expect(wallEdgeMask(maze, 0, 1)).toBe(EDGE_E);
    expect(wallEdgeMask(maze, 2, 1)).toBe(EDGE_W);
    // Corners touch the floor only diagonally; the board edge counts as wall.
    expect(wallEdgeMask(maze, 0, 0)).toBe(0);
  });

  it("gives every wall mask its own atlas slot", () => {
    const slots = new Set<number>();
    for (let mask = 0; mask < 16; mask++) slots.add(ATLAS.WALL + mask);
    expect(slots.size).toBe(16);
    expect(ATLAS.AIRGAP).toBe(ATLAS.WALL + 16);
    expect(ATLAS.COUNT).toBe(ATLAS.EXIT_LOCKED + 1);
  });

  it("picks a stable floor variant in range", () => {
    for (let y = 0; y < 9; y++) {
      for (let x = 0; x < 15; x++) {
        const v = floorVariant(x, y);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(3);
        expect(floorVariant(x, y)).toBe(v);
      }
    }
    const used = new Set(
      Array.from({ length: 30 }, (_, i) => floorVariant(i, i * 3))
    );
    expect(used.size).toBeGreaterThan(1);
  });

  it("mixes hex colours", () => {
    expect(mixHex("#000000", "#ffffff", 0)).toBe("#000000");
    expect(mixHex("#000000", "#ffffff", 1)).toBe("#ffffff");
    expect(mixHex("#000000", "#ffffff", 0.5)).toBe("#808080");
    expect(mixHex("#000", "#fff", 2)).toBe("#ffffff");
  });

  it("puts walls on neutral graphite floor, lit in the theme hue", () => {
    const emerald = tilePaletteFor(CRT_THEMES.emerald);
    expect(emerald.floor).toBe(LABYRINTH_INK.stage);
    expect(emerald.wallRim).toBe(CRT_THEMES.emerald.primaryColor);
    const luminance = (hex: string) =>
      [1, 3, 5]
        .map((i) => parseInt(hex.slice(i, i + 2), 16))
        .reduce((a, b) => a + b, 0);
    expect(luminance(emerald.wallTop)).toBeGreaterThan(
      luminance(emerald.floor) + 60
    );
    expect(tilePaletteFor(CRT_THEMES.amber).wallRim).toBe("#f59e0b");
  });
});

describe("sprites", () => {
  it("are 1-bit bitmaps of a fixed size: 12px actors, 8px pickups", () => {
    const actors = ["player", "bug", "drone", "slime", "daemon"] as const;
    for (const [name, rows] of Object.entries(SPRITES)) {
      const bitmap = parseSprite(rows);
      const size = (actors as readonly string[]).includes(name) ? 12 : 8;
      expect(bitmap.width, name).toBe(size);
      expect(bitmap.height, name).toBe(size);
      expect(
        rows.every((row) => /^[#.]+$/.test(row)),
        name
      ).toBe(true);
      expect(bitmap.ink.flat().some(Boolean), name).toBe(true);
    }
  });

  it("outlines the ink one pixel out, never over it", () => {
    const bitmap = parseSprite(["#"]);
    const outline = spriteOutline(bitmap);
    expect(outline).toEqual([
      [false, true, false],
      [true, false, true],
      [false, true, false],
    ]);
    const player = parseSprite(SPRITES.player);
    const ring = spriteOutline(player);
    player.ink.forEach((row, y) =>
      row.forEach((on, x) => {
        if (on) expect(ring[y + 1][x + 1]).toBe(false);
      })
    );
  });

  it("draws each enemy type with a sprite and each state with a signal", () => {
    expect(enemySprite("drone")).toBe("drone");
    expect(enemySprite("slime")).toBe("slime");
    expect(enemySprite("sentinel_daemon")).toBe("daemon");
    expect(enemySprite("zombie")).toBe("bug");
    expect(enemyTint("chase")).toBe(LABYRINTH_INK.red);
    expect(enemyTint("attack")).toBe(LABYRINTH_INK.red);
    expect(enemyTint("patrol")).toBe(LABYRINTH_INK.amber);
    expect(enemyTint("frozen")).toBe(LABYRINTH_INK.ice);
    expect(enemyTint("confused")).toBe(LABYRINTH_INK.steel);
  });

  it("never tints a pickup purple or pink", () => {
    const ids = [
      "coffee",
      "node_modules",
      "todo_shield",
      "commit_token",
      "hotfix_key",
      "git_stash",
      "ram_expansion",
      "zero_day_payload",
      "bypass_chip",
      "crypto_stash",
      "firmware_patch",
    ] as const;
    const signals = new Set<string>([
      LABYRINTH_INK.amber,
      LABYRINTH_INK.emerald,
      LABYRINTH_INK.red,
      LABYRINTH_INK.steel,
    ]);
    for (const id of ids) {
      const art = itemArt(id);
      expect(SPRITES[art.sprite], id).toBeDefined();
      expect(signals.has(art.tint), id).toBe(true);
    }
  });

  it("swaps purple and pink text colours for amber", () => {
    expect(boardSafeColor("#a855f7")).toBe(LABYRINTH_INK.amber);
    expect(boardSafeColor("#EC4899")).toBe(LABYRINTH_INK.amber);
    expect(boardSafeColor("#ef4444")).toBe("#ef4444");
  });
});

describe("fog", () => {
  it("is clear where visible, dim where remembered and black where unseen", () => {
    expect(fogAlpha(true, true, true)).toBe(0);
    expect(fogAlpha(true, false, true)).toBe(FOG_REMEMBERED);
    expect(fogAlpha(false, false, true)).toBe(FOG_UNSEEN);
    expect(fogAlpha(false, false, false)).toBe(0);
  });
});

describe("dotted floor route", () => {
  it("walks corridors instead of cutting diagonals through walls", () => {
    const path = walkablePath(STAGE_1_MAZE, { x: 1, y: 1 }, { x: 13, y: 7 });
    expect(path[0]).toEqual({ x: 1, y: 1 });
    expect(path[path.length - 1]).toEqual({ x: 13, y: 7 });
    for (let i = 1; i < path.length; i++) {
      const step =
        Math.abs(path[i].x - path[i - 1].x) +
        Math.abs(path[i].y - path[i - 1].y);
      expect(step).toBe(1);
      expect(STAGE_1_MAZE[path[i].y][path[i].x]).not.toBe("#");
    }
  });

  it("returns only the start when the target is walled off or off the grid", () => {
    const sealed = [
      ["#", "#", "#", "#"],
      ["#", " ", "#", " "],
      ["#", "#", "#", "#"],
    ];
    expect(walkablePath(sealed, { x: 1, y: 1 }, { x: 3, y: 1 })).toEqual([
      { x: 1, y: 1 },
    ]);
    expect(walkablePath(sealed, { x: 1, y: 1 }, { x: 9, y: 9 })).toEqual([
      { x: 1, y: 1 },
    ]);
  });

  it("joins tour legs without repeating tiles", () => {
    const tiles = routeTiles(STAGE_1_MAZE, [
      { x: 1, y: 1 },
      { x: 3, y: 3 },
      { x: 1, y: 1 },
    ]);
    const ids = tiles.map((t) => `${t.x},${t.y}`);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain("3,3");
  });

  it("puts a dot on each tile centre and half way between neighbours", () => {
    const dots = routeDots([
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ]);
    expect(dots).toEqual([
      { x: TILE * 1.5, y: TILE * 1.5 },
      { x: TILE * 2, y: TILE * 1.5 },
      { x: TILE * 2.5, y: TILE * 1.5 },
    ]);
  });
});

describe("plates and labels", () => {
  it("keeps a long label inside the board", () => {
    expect(clampLabelCenter(0, 100)).toBe(52);
    expect(clampLabelCenter(LOGICAL_WIDTH, 100)).toBe(LOGICAL_WIDTH - 52);
    expect(clampLabelCenter(120, 20)).toBe(120);
    expect(clampLabelCenter(10, 1000)).toBe(LOGICAL_WIDTH / 2);
  });

  it("sits a plate on the wall row, inside the board, whole-pixel aligned", () => {
    const plate = plateOnWall(LOGICAL_WIDTH / 2, 100.4, 0);
    expect(plate.y).toBeGreaterThanOrEqual(0);
    expect(plate.y + plate.height).toBeLessThanOrEqual(TILE);
    expect(plate.height).toBe(PLATE_HEIGHT);
    expect(plate.width).toBeGreaterThanOrEqual(100.4);
    expect(Number.isInteger(plate.x)).toBe(true);
    const edge = plateOnWall(LOGICAL_WIDTH - 2, 30, 8);
    expect(edge.x + edge.width).toBeLessThanOrEqual(LOGICAL_WIDTH);
    expect(edge.y).toBeGreaterThanOrEqual(8 * TILE);
  });

  it("only plates a row that is solid wall", () => {
    expect(isSolidWallRow(STAGE_1_MAZE, 0)).toBe(true);
    expect(isSolidWallRow(STAGE_1_MAZE, 1)).toBe(false);
    expect(isSolidWallRow(STAGE_1_MAZE, 42)).toBe(false);
  });

  it("formats the room plate from the badge", () => {
    expect(roomPlateText("ROOM 01 :: AIRGAP ENCLAVE")).toBe(
      "ROOM 01 · AIRGAP ENCLAVE"
    );
    expect(roomPlateText("Subnet 01")).toBe("SUBNET 01");
  });
});

describe("CRT settings", () => {
  it("defaults to Soft: no mask, no bloom, no curvature, no flicker", () => {
    const soft = resolveLabyrinthCrt(undefined, null);
    expect(soft).toBe(LABYRINTH_CRT_SOFT);
    expect(soft.phosphorMask).toBe("none");
    expect(soft.bloomIntensity).toBe(0);
    expect(soft.curvature).toBe(0);
    expect(soft.flickerShimmer).toBe(false);
    expect(resolveLabyrinthCrt("soft", null)).toBe(LABYRINTH_CRT_SOFT);
  });

  it("follows the cabinet's Setup Wizard filter", () => {
    expect(resolveLabyrinthCrt("off", null)).toBe(LABYRINTH_CRT_OFF);
    expect(resolveLabyrinthCrt("arcade", null)).toBe(
      CRT_PRESETS["authentic-arcade"].config
    );
    const heavy = resolveLabyrinthCrt("scanlines", null);
    expect(heavy.scanlineIntensity).toBeGreaterThan(
      LABYRINTH_CRT_SOFT.scanlineIntensity
    );
    expect(heavy.phosphorMask).toBe("none");
  });

  it("lets the player's saved calibration win", () => {
    const saved = { ...LABYRINTH_CRT_SOFT, curvature: 0.4 };
    expect(resolveLabyrinthCrt("off", saved)).toBe(saved);
  });

  it("skips the CRT pass when it would draw nothing", () => {
    expect(isCrtIdle(LABYRINTH_CRT_OFF)).toBe(true);
    expect(isCrtIdle(LABYRINTH_CRT_SOFT)).toBe(false);
  });
});

describe("floating text fit", () => {
  it("shrinks a line wider than the board, within limits", () => {
    expect(fitFontSize(7, 100, 236)).toBe(7);
    expect(fitFontSize(7, 472, 236)).toBe(4);
    expect(fitFontSize(7, 300, 236)).toBe(5);
    expect(fitFontSize(7, 0, 236)).toBe(7);
  });
});
