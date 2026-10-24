import { clamp } from "@/lib/game-utils";
import { renderCRTEffects } from "@/lib/arcade/crt-pipeline";
import {
  formatCampaignRoomBadge,
  getExitLockState,
  renderWireframeMesh,
} from "@/lib/dungeon";
import {
  GRID_COLS,
  GRID_ROWS,
  LABYRINTH_INK,
  TILE,
  boardSafeColor,
  clampLabelCenter,
  enemySprite,
  enemyTint,
  fitFontSize,
  floorVariant,
  isSolidWallRow,
  itemArt,
  plateOnWall,
  roomPlateText,
  routeDots,
  routeTiles,
  tilePaletteFor,
  wallEdgeMask,
} from "@/components/retro-labyrinth/labyrinth-art";
import {
  ATLAS,
  drawPlate,
  drawSprite,
  drawTile,
  getTileAtlas,
  labyrinthFont,
  paintFogCanvas,
} from "@/components/retro-labyrinth/labyrinth-atlas";
import { isCrtIdle } from "@/components/retro-labyrinth/labyrinth-crt";
import {
  EXIT_X,
  EXIT_Y,
  type LabyrinthFrame,
} from "@/components/retro-labyrinth/useRetroLabyrinthSession";

/**
 * The fog texture and the maps it was painted from, rebuilt only when the
 * field of view changes. Each canvas keeps its own.
 */
export interface FogCache {
  canvas: HTMLCanvasElement | null;
  visible: boolean[][] | null;
  explored: boolean[][] | null;
  hasFog: boolean;
}

/** A fog cache with nothing painted yet. */
export function createFogCache(): FogCache {
  return { canvas: null, visible: null, explored: null, hasFog: false };
}

/**
 * Paints one frame of the maze (#1522). Everything is drawn in art pixels (16
 * per tile) under one scale: tiles and sprites are stamped from offscreen
 * canvases with nearest-neighbour sampling, and text is drawn at the full
 * backing resolution. The painter also advances the frame's particles and
 * floating lines, which fade as they are drawn.
 *
 * @param canvas - The maze canvas, at its backing size.
 * @param frame - The session's frame.
 * @param fog - This canvas's fog cache.
 */
export function paintMaze(
  canvas: HTMLCanvasElement,
  frame: LabyrinthFrame,
  fog: FogCache
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { timestamp, campaignRooms, particlesRef, floatingTextsRef, cursor } =
    frame;
  const {
    wallTelegraph,
    reducedMotion,
    currentMaze,
    playerPosition,
    visibleMap,
    exploredMap,
    enemies,
    drones,
    dronesStunned,
    items,
    boss,
    tspNodes,
    tspTour,
    gameMode,
    roomIndex,
    gameStatus,
    currentTheme,
    crtCalibration,
  } = frame.state;
  const exitLocked =
    gameMode === "roguelike" && getExitLockState(boss, tspNodes).locked;

  const width = canvas.width;
  const height = canvas.height;
  const cols = currentMaze[0]?.length || GRID_COLS;
  const rows = currentMaze.length || GRID_ROWS;
  const scale = width / (cols * TILE);
  const palette = tilePaletteFor(currentTheme);
  const atlas = getTileAtlas(palette);
  const hasFog = gameMode === "roguelike";

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = LABYRINTH_INK.stage;
  ctx.fillRect(0, 0, width, height);
  ctx.scale(scale, scale);

  // Tiles from the atlas
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const cell = currentMaze[y][x];
      let slot: number = ATLAS.FLOOR + floorVariant(x, y);
      if (cell === "#") {
        slot = ATLAS.WALL + wallEdgeMask(currentMaze, x, y);
      } else if (cell === "W") {
        slot = ATLAS.AIRGAP;
      } else if (cell === "H") {
        slot = ATLAS.TERMINAL;
      } else if (cell === "T") {
        slot = ATLAS.CHEST;
      } else if (x === EXIT_X && y === EXIT_Y) {
        slot = exitLocked ? ATLAS.EXIT_LOCKED : ATLAS.EXIT_OPEN;
      }
      if (atlas) drawTile(ctx, atlas, slot, x, y);
    }
  }

  // Fog of war: flat inside, soft only at its edge
  if (
    fog.visible !== visibleMap ||
    fog.explored !== exploredMap ||
    fog.hasFog !== hasFog
  ) {
    fog.canvas = paintFogCanvas(
      fog.canvas,
      exploredMap,
      visibleMap,
      hasFog,
      cols,
      rows
    );
    fog.visible = visibleMap;
    fog.explored = exploredMap;
    fog.hasFog = hasFog;
  }
  if (hasFog && fog.canvas) {
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(
      fog.canvas,
      0,
      0,
      fog.canvas.width,
      fog.canvas.height,
      0,
      0,
      cols * TILE,
      rows * TILE
    );
    ctx.imageSmoothingEnabled = false;
  }

  // C: the exit stays marked through the fog so there is always a goal
  if (hasFog && !(exploredMap[EXIT_Y]?.[EXIT_X] ?? true)) {
    ctx.save();
    ctx.globalAlpha = 0.55;
    if (atlas) {
      drawTile(
        ctx,
        atlas,
        exitLocked ? ATLAS.EXIT_LOCKED : ATLAS.EXIT_OPEN,
        EXIT_X,
        EXIT_Y
      );
    }
    ctx.restore();
  }

  // TSP route: a dotted path along the floor, stop by stop
  if (gameMode === "roguelike" && tspNodes.length > 0) {
    ctx.fillStyle = currentTheme.accentColor;
    ctx.save();
    ctx.globalAlpha = 0.55;
    const tour = tspTour;
    routeDots(routeTiles(currentMaze, tour)).forEach((dot) => {
      ctx.fillRect(dot.x - 1, dot.y - 1, 2, 2);
    });
    ctx.restore();

    tspNodes.forEach((node) => {
      drawSprite(
        ctx,
        "node",
        node.visited ? LABYRINTH_INK.emerald : LABYRINTH_INK.amber,
        node.x * TILE + TILE / 2,
        node.y * TILE + TILE / 2
      );
    });
  }

  // Pickups
  items.forEach((item) => {
    if (item.collected) return;
    const art = itemArt(item.itemId);
    drawSprite(
      ctx,
      art.sprite,
      art.tint,
      item.x * TILE + TILE / 2,
      item.y * TILE + TILE / 2
    );
  });

  // Wall telegraph: drawn over the fog, so the next shift shows even in
  // unexplored rooms: a dashed amber ghost where a wall will appear, and
  // a dim over the walls the next move takes away (flickers unless
  // reduced motion).
  if (wallTelegraph) {
    ctx.save();
    ctx.strokeStyle = LABYRINTH_INK.amber;
    ctx.lineWidth = TILE * 0.09;
    ctx.setLineDash([TILE * 0.25, TILE * 0.2]);
    ctx.globalAlpha = 0.6;
    for (const cell of wallTelegraph.appearing) {
      const [gx, gy] = cell.split(",").map(Number);
      ctx.strokeRect(
        gx * TILE + TILE * 0.12,
        gy * TILE + TILE * 0.12,
        TILE * 0.76,
        TILE * 0.76
      );
    }
    ctx.restore();
    if (wallTelegraph.vanishing.length > 0) {
      const dimOn = reducedMotion
        ? true
        : Math.floor(timestamp / 250) % 2 === 0;
      ctx.save();
      ctx.fillStyle = LABYRINTH_INK.stage;
      ctx.globalAlpha = dimOn ? 0.7 : 0.35;
      for (const cell of wallTelegraph.vanishing) {
        const [gx, gy] = cell.split(",").map(Number);
        ctx.fillRect(gx * TILE, gy * TILE, TILE, TILE);
      }
      ctx.restore();
    }
  }

  // Enemies, coloured by what they are doing, with CVE plates
  ctx.font = labyrinthFont(5);
  enemies.forEach((enemy) => {
    const ex = enemy.x * TILE + TILE / 2;
    const ey = enemy.y * TILE + TILE / 2;
    drawSprite(ctx, enemySprite(enemy.type), enemyTint(enemy.state), ex, ey);

    if (enemy.cveExposed && enemy.cve) {
      const label = enemy.cve.substring(0, 4);
      const labelWidth = ctx.measureText(label).width;
      const box = {
        x: Math.round(
          clampLabelCenter(ex, labelWidth + 4, cols * TILE) -
            (labelWidth + 4) / 2
        ),
        y: Math.max(0, Math.round(ey - TILE / 2 - 6)),
        width: Math.ceil(labelWidth + 4),
        height: 7,
      };
      drawPlate(ctx, box, label, LABYRINTH_INK.red);
    }
  });

  // Sweeping security drones (Classic Stage 2 and the middle rooms,
  // #2273), each over a faint track of its sweep so the timing reads.
  drones.forEach((d) => {
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = LABYRINTH_INK.red;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(d.minX * TILE + 2, d.y * TILE + TILE - 2);
    ctx.lineTo(d.maxX * TILE + TILE - 2, d.y * TILE + TILE - 2);
    ctx.stroke();
    ctx.restore();
  });
  drones.forEach((d) => {
    drawSprite(
      ctx,
      "drone",
      dronesStunned ? LABYRINTH_INK.ice : LABYRINTH_INK.red,
      d.x * TILE + TILE / 2,
      d.y * TILE + TILE / 2
    );
  });

  // The wireframe 3D boss, the room's showpiece
  if (boss && !boss.defeated && gameMode === "roguelike") {
    const bossCenterX = boss.x * TILE + TILE / 2;
    const bossCenterY = boss.y * TILE + TILE / 2;
    // The Neural Warden lights the lanes of its next lattice volley
    // first, so dodging it is a read (#2178).
    if (boss.telegraph) {
      const reach = Math.max(cols, rows) * TILE;
      const lanes =
        boss.telegraph === "cross"
          ? [
              [1, 0],
              [-1, 0],
              [0, 1],
              [0, -1],
            ]
          : [
              [1, 1],
              [1, -1],
              [-1, 1],
              [-1, -1],
            ];
      ctx.save();
      ctx.strokeStyle = boss.mesh.color;
      ctx.globalAlpha = 0.45;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      for (const [lx, ly] of lanes) {
        // A lane ends at the first wall, where its shots stop.
        let steps = 0;
        while (
          steps * TILE < reach &&
          currentMaze[boss.y + ly * (steps + 1)]?.[
            boss.x + lx * (steps + 1)
          ] !== undefined &&
          currentMaze[boss.y + ly * (steps + 1)][boss.x + lx * (steps + 1)] !==
            "#"
        ) {
          steps++;
        }
        const len = (steps + 0.5) * TILE;
        ctx.moveTo(bossCenterX, bossCenterY);
        ctx.lineTo(bossCenterX + lx * len, bossCenterY + ly * len);
      }
      ctx.stroke();
      ctx.restore();
    }
    renderWireframeMesh(ctx, boss.mesh, bossCenterX, bossCenterY, true);

    boss.projectiles.forEach((p) => {
      if (!p.alive) return;
      const pX = p.x * TILE + TILE / 2;
      const pY = p.y * TILE + TILE / 2;
      renderWireframeMesh(ctx, p.mesh, pX, pY, false);
    });
  }

  // The player: a hooded netrunner sprite, unlike any node, enemy
  // or pickup
  drawSprite(
    ctx,
    "player",
    LABYRINTH_INK.text,
    playerPosition.x * TILE + TILE / 2,
    playerPosition.y * TILE + TILE / 2
  );

  // Plates on the outer wall: the room name on top, and the exit's
  // state just below the exit, so no label sits inside a 16px tile
  ctx.font = labyrinthFont(6);
  const roomBadge =
    gameMode === "roguelike"
      ? formatCampaignRoomBadge(
          campaignRooms[roomIndex]?.badge ?? "",
          roomIndex
        )
      : "";
  if (roomBadge && isSolidWallRow(currentMaze, 0)) {
    const roomText = roomPlateText(roomBadge);
    drawPlate(
      ctx,
      plateOnWall((cols * TILE) / 2, ctx.measureText(roomText).width, 0),
      roomText,
      currentTheme.primaryColor
    );
  }
  if (
    currentMaze.some((row) => row.includes("W")) &&
    isSolidWallRow(currentMaze, 0)
  ) {
    const airgapText = "AIRGAP";
    const airgapBox = plateOnWall(
      cols * TILE - TILE * 2,
      ctx.measureText(airgapText).width + 5,
      0
    );
    // A swatch keys the plate to the striped airgap tiles.
    drawPlate(
      ctx,
      airgapBox,
      airgapText,
      LABYRINTH_INK.steel,
      LABYRINTH_INK.text,
      LABYRINTH_INK.steel
    );
  }
  if (EXIT_Y + 1 < rows) {
    const exitText = exitLocked ? "LOCK" : "EXIT";
    drawPlate(
      ctx,
      plateOnWall(
        EXIT_X * TILE + TILE / 2,
        ctx.measureText(exitText).width,
        EXIT_Y + 1
      ),
      exitText,
      exitLocked ? LABYRINTH_INK.red : currentTheme.primaryColor,
      exitLocked ? LABYRINTH_INK.red : currentTheme.textColor
    );
  }

  // Particles: square art pixels, fading out after each event
  particlesRef.current = particlesRef.current.filter((p) => {
    p.x += p.vx * 0.05;
    p.y += p.vy * 0.05;
    p.alpha -= p.decay;

    if (p.alpha <= 0) return false;

    const partX = p.x * TILE + TILE / 2;
    const partY = p.y * TILE + TILE / 2;
    const color = boardSafeColor(p.color);

    ctx.save();
    ctx.globalAlpha = clamp(p.alpha, 0, 1);
    ctx.fillStyle = color;
    if (p.char) {
      ctx.font = labyrinthFont(5);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(p.char, partX, partY);
    } else {
      const size = Math.max(1, Math.round(p.radius));
      ctx.fillRect(
        Math.round(partX - size / 2),
        Math.round(partY - size / 2),
        size,
        size
      );
    }
    ctx.restore();

    return true;
  });

  // Floating text, outlined and kept inside the board
  ctx.font = labyrinthFont(7);
  floatingTextsRef.current = floatingTextsRef.current.filter((ft) => {
    ft.y += ft.vy;
    ft.alpha -= 0.02;

    if (ft.alpha <= 0) return false;

    ctx.font = labyrinthFont(7);
    let textWidth = ctx.measureText(ft.text).width;
    const maxTextWidth = cols * TILE - 8;
    const fitted = fitFontSize(7, textWidth, maxTextWidth);
    if (fitted !== 7) {
      ctx.font = labyrinthFont(fitted);
      textWidth = ctx.measureText(ft.text).width;
    }
    const tX = clampLabelCenter(
      ft.x * TILE + TILE / 2,
      Math.min(textWidth, maxTextWidth),
      cols * TILE
    );
    const tY = Math.max(6, ft.y * TILE + TILE / 2);

    ctx.save();
    ctx.globalAlpha = clamp(ft.alpha, 0, 1);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.strokeStyle = LABYRINTH_INK.stage;
    ctx.strokeText(ft.text, tX, tY, maxTextWidth);
    ctx.fillStyle = boardSafeColor(ft.color);
    ctx.fillText(ft.text, tX, tY, maxTextWidth);
    ctx.restore();

    return true;
  });

  // Draw Cursor Hover Highlight Tile
  if (
    cursor &&
    gameMode === "roguelike" &&
    campaignRooms[roomIndex]?.id === "tsp" &&
    gameStatus === "playing"
  ) {
    const { x: hx, y: hy } = cursor;
    if (hx >= 0 && hx < cols && hy >= 0 && hy < rows) {
      const hpx = hx * TILE;
      const hpy = hy * TILE;
      ctx.save();
      ctx.fillStyle = "rgba(34, 211, 238, 0.2)";
      ctx.fillRect(hpx, hpy, TILE, TILE);
      ctx.strokeStyle = currentTheme.accentColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(hpx + 0.5, hpy + 0.5, TILE - 1, TILE - 1);
      ctx.restore();
    }
  }

  ctx.restore();

  // The CRT polish layer, at the backing resolution. The default is
  // Soft: a faint raster and vignette, no phosphor mask or bloom.
  if (!isCrtIdle(crtCalibration)) {
    renderCRTEffects(
      ctx,
      width,
      height,
      crtCalibration,
      currentTheme,
      frame.crtFrame
    );
  }
}
