/**
 * Draws a For Better or Bulk level onto a 2D canvas, top down. Pure over the
 * engine state, so it can be tested against a mocked context; the game calls
 * it once per animation frame with the context already scaled to logical
 * units.
 */

import {
  ARRANGE_SECONDS,
  BIN_HOLD_SECONDS,
  BURN_SECONDS,
  COOK_SECONDS,
  CRATE_NAMES,
  PATIO_ROWS,
  PETAL_SECONDS,
  SIMPLIFY_SECONDS,
  VENUE_MAP,
  bankText,
  frontTile,
  getCoachStep,
  getPrompt,
  interactTile,
  type GameState,
  type ItemKind,
  type Player,
  type PlayerId,
  type Station,
  type SupplyKind,
  type Target,
  type Tile,
} from "@/lib/for-better-or-bulk";
import { clamp, GAME_FONT_FALLBACK_STACK } from "@/lib/game-utils";

/** Logical pixels per tile. */
export const TILE = 40;
export const VENUE_WIDTH = (VENUE_MAP[0]?.length ?? 20) * TILE;
export const VENUE_HEIGHT = VENUE_MAP.length * TILE;

/**
 * Label size. It never drops below 10px: a label too wide for its tile is
 * squeezed to the tile width by the canvas instead of shrinking the type.
 */
const LABEL_PX = 10;

/**
 * A game-time burst's lifetime, in game seconds: a few frames at any speed.
 * Bursts are timed on the game clock, so at 8x each lasts an eighth as long
 * in real time.
 */
export const BURST_SECONDS = 0.5;
/** Smoke from the grill hangs a little longer than a flash. */
const SMOKE_SECONDS = 1.5;
/** A crumpled note stays up long enough to see it crumple. */
const CRUMPLE_SECONDS = 1.2;
/** The roses cover the car for the length of the "Yes" joke. */
const ROSES_SECONDS = 8;
/** The car in the top row, and the coat-room hanger in the corner (map edge). */
const CAR = { x: 0.12, y: 2.2, width: 1.76, height: 0.66 } as const;
const COAT_TILE = { x: 19, y: 0 } as const;

const COLORS = {
  hedge: "#1c2a1b",
  hedgeLeaf: "#253824",
  patio: "#4a4640",
  patioLine: "#3c3934",
  lawn: "#34502f",
  lawnAlt: "#3a5734",
  outline: "rgba(244, 244, 246, 0.55)",
  label: "#f4f4f6",
  dim: "rgba(244, 244, 246, 0.6)",
  crate: "#7a5a3a",
  crateEdge: "#5b4229",
  table: "#8a6a48",
  tableCloth: "#e9e4d8",
  grill: "#26282c",
  grillHot: "#f59e0b",
  bin: "#5d636b",
  bucket: "#9aa3ad",
  progressTrack: "rgba(13, 14, 17, 0.7)",
  progress: "#10b981",
  burning: "#ef4444",
  /** Steel at low alpha: static hairline rain on the wet lawn. */
  rain: "rgba(148, 163, 184, 0.6)",
  fred: "#1f2a44",
  fredEdge: "#94a3b8",
  abbi: "#f4f0e6",
  abbiEdge: "#d6c7a8",
  active: "#f59e0b",
  busy: "#f4f4f6",
  /** Steel smoke: light enough to read against the dark grill and stage. */
  smoke: "#94a3b8",
  carBody: "#13151a",
  carWheel: "#0d0e11",
  carGlass: "#94a3b8",
  hanger: "#94a3b8",
  suit: "#f4f4f6",
  suitLapel: "#13151a",
  badge: "rgba(13, 14, 17, 0.88)",
} as const;

/** A one-shot canvas burst, timed on the game clock (state.time). */
export interface CanvasBurst {
  /**
   * A ring on a filled target, smoke at the grill, a crumpled note on a
   * simplified target, or roses across the car. Roses are drawn over the car
   * wherever `x` and `y` put them, so their position is not used.
   */
  readonly kind: "ring" | "charcoal" | "crumple" | "roses";
  readonly x: number;
  readonly y: number;
  /** The game time the burst started, in seconds. */
  readonly startedAt: number;
}

const ITEM_COLORS: Readonly<Record<ItemKind, string>> = {
  roses: "#e0607e",
  arrangement: "#e8879c",
  petals: "#f2a7b8",
  "hotdogs-raw": "#d77a7a",
  hotdogs: "#c98d4c",
  "wings-raw": "#e09a8a",
  wings: "#b5652e",
  mac: "#f2c94c",
  quinoa: "#c7c08a",
  burnt: "#1b1b1b",
  lantern: "#f7d774",
  chairs: "#b9bec6",
};

function font(size: number): string {
  return `700 ${size}px ${GAME_FONT_FALLBACK_STACK}`;
}

/** Where each rain streak starts across a lawn tile, as a share of its width. */
const RAIN_STARTS = [0.12, 0.4, 0.68, 0.9] as const;

/** Diagonal hairlines across one lawn tile: the shower, drawn static. */
function drawRain(ctx: CanvasRenderingContext2D, px: number, py: number): void {
  ctx.strokeStyle = COLORS.rain;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (const start of RAIN_STARTS) {
    const x = px + start * TILE;
    ctx.moveTo(x, py);
    ctx.lineTo(x + TILE * 0.22, py + TILE);
  }
  ctx.stroke();
}

function drawGround(ctx: CanvasRenderingContext2D, raining: boolean): void {
  VENUE_MAP.forEach((row, y) => {
    [...row].forEach((char, x) => {
      const px = x * TILE;
      const py = y * TILE;
      if (char === "#") {
        ctx.fillStyle = COLORS.hedge;
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = COLORS.hedgeLeaf;
        ctx.beginPath();
        ctx.arc(px + TILE / 2, py + TILE / 2, TILE * 0.38, 0, Math.PI * 2);
        ctx.fill();
        return;
      }
      if (y <= PATIO_ROWS) {
        ctx.fillStyle = COLORS.patio;
        ctx.fillRect(px, py, TILE, TILE);
        ctx.strokeStyle = COLORS.patioLine;
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
      } else {
        ctx.fillStyle = (x + y) % 2 === 0 ? COLORS.lawn : COLORS.lawnAlt;
        ctx.fillRect(px, py, TILE, TILE);
        if (raining) drawRain(ctx, px, py);
      }
    });
  });
}

/** A small picture of an item, centred on a point. */
export function drawItem(
  ctx: CanvasRenderingContext2D,
  kind: ItemKind,
  cx: number,
  cy: number,
  size: number
): void {
  ctx.fillStyle = ITEM_COLORS[kind];
  const r = size / 2;
  switch (kind) {
    case "roses":
    case "arrangement":
      for (const [dx, dy] of [
        [-0.35, -0.2],
        [0.35, -0.2],
        [0, 0.25],
        [0, -0.45],
      ]) {
        ctx.beginPath();
        ctx.arc(cx + dx * r, cy + dy * r, r * 0.42, 0, Math.PI * 2);
        ctx.fill();
      }
      if (kind === "arrangement") {
        ctx.fillStyle = "#4f7d4a";
        ctx.fillRect(cx - r * 0.12, cy + r * 0.45, r * 0.24, r * 0.55);
      }
      return;
    case "petals":
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(
          cx + Math.cos(a) * r * 0.55,
          cy + Math.sin(a) * r * 0.55,
          r * 0.22,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
      return;
    case "lantern":
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.75, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#8a6d2f";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.75, cy);
      ctx.lineTo(cx + r * 0.75, cy);
      ctx.stroke();
      return;
    case "chairs":
      for (let i = 0; i < 3; i++) {
        ctx.fillRect(
          cx - r * 0.7 + i * 2,
          cy - r * 0.7 + i * 3,
          r * 1.2,
          r * 0.35
        );
      }
      return;
    default:
      ctx.beginPath();
      ctx.roundRect(cx - r * 0.8, cy - r * 0.55, r * 1.6, r * 1.1, r * 0.25);
      ctx.fill();
  }
}

function drawProgress(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  fraction: number,
  color: string
): void {
  const width = TILE - 8;
  ctx.fillStyle = COLORS.progressTrack;
  ctx.fillRect(x + 4, y + TILE - 7, width, 4);
  ctx.fillStyle = color;
  ctx.fillRect(x + 4, y + TILE - 7, width * clamp(fraction, 0, 1), 4);
}

/**
 * Draws a label centred on cx. Every label is light text at 10px, squeezed to
 * the tile width if it is wider. A plate puts a dark badge behind the text so
 * it keeps at least 4.5:1 contrast on any ground, including lawn and patio.
 */
function drawLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  y: number,
  plate = false,
  span = TILE - 2
): void {
  ctx.font = font(LABEL_PX);
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const width = Math.min(ctx.measureText(text).width, span);
  if (plate) {
    ctx.fillStyle = COLORS.badge;
    ctx.beginPath();
    ctx.roundRect(cx - width / 2 - 3, y - 2, width + 6, LABEL_PX + 4, 3);
    ctx.fill();
  }
  ctx.fillStyle = COLORS.label;
  ctx.fillText(text, cx, y, span);
}

/** Draws a station's word once for its run, or nothing if a neighbour draws it. */
function drawRunLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  station: Station,
  stations: readonly Station[],
  y: number
): void {
  const label = stationLabel(station, stations);
  if (label) drawLabel(ctx, text, label.cx, y, false, label.span);
}

/**
 * The label for a station that may sit in a run of identical neighbours (two
 * ARRANGE tables side by side). Only the left-most tile of a run draws the
 * label, centred over the whole run, so the words never repeat or spill.
 */
function stationLabel(
  station: Station,
  stations: readonly Station[]
): { readonly cx: number; readonly span: number } | null {
  const sameRun = (x: number) =>
    stations.some(
      (s) => s.kind === station.kind && s.y === station.y && s.x === x
    );
  if (sameRun(station.x - 1)) return null;
  let end = station.x;
  while (sameRun(end + 1)) end += 1;
  const span = (end - station.x + 1) * TILE;
  return { cx: station.x * TILE + span / 2, span: span - 2 };
}

/**
 * The word on a station, drawn in its own pass after every prop on the venue,
 * so a table, bucket, grill or bowl never covers the word that names it.
 */
function drawStationLabel(
  ctx: CanvasRenderingContext2D,
  station: Station,
  stations: readonly Station[]
): void {
  const px = station.x * TILE;
  const py = station.y * TILE;
  switch (station.kind) {
    case "arrange":
      drawRunLabel(ctx, "ARRANGE", station, stations, py + 1);
      break;
    case "petals":
      drawRunLabel(ctx, "PETALS", station, stations, py + 1);
      break;
    case "grill":
      drawRunLabel(ctx, "GRILL", station, stations, py + 1);
      break;
    case "bin":
      drawLabel(ctx, "BIN", px + TILE / 2, py + 1);
      break;
  }
}

function drawStation(ctx: CanvasRenderingContext2D, station: Station): void {
  const px = station.x * TILE;
  const py = station.y * TILE;
  const cx = px + TILE / 2;
  const cy = py + TILE / 2;
  switch (station.kind) {
    case "arrange":
      ctx.fillStyle = COLORS.table;
      ctx.fillRect(px + 2, py + 4, TILE - 4, TILE - 8);
      break;
    case "petals":
      ctx.fillStyle = COLORS.bucket;
      ctx.beginPath();
      ctx.arc(cx, cy, TILE * 0.36, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "grill": {
      const hot = station.item !== null && station.item.kind !== "burnt";
      ctx.fillStyle = COLORS.grill;
      ctx.fillRect(px + 3, py + 3, TILE - 6, TILE - 6);
      ctx.strokeStyle = hot ? COLORS.grillHot : COLORS.bin;
      ctx.lineWidth = 2;
      for (let i = 1; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(px + 6, py + (i * TILE) / 4);
        ctx.lineTo(px + TILE - 6, py + (i * TILE) / 4);
        ctx.stroke();
      }
      break;
    }
    case "bin":
      ctx.fillStyle = COLORS.bin;
      ctx.fillRect(px + 9, py + 7, TILE - 18, TILE - 12);
      break;
  }
  if (station.item) drawItem(ctx, station.item.kind, cx, cy + 3, TILE * 0.45);
  if (
    (station.kind === "arrange" || station.kind === "petals") &&
    station.progress > 0
  ) {
    const seconds =
      station.kind === "arrange" ? ARRANGE_SECONDS : PETAL_SECONDS;
    drawProgress(ctx, px, py, station.progress / seconds, COLORS.progress);
  }
  if (
    station.kind === "grill" &&
    station.item &&
    station.item.kind !== "burnt"
  ) {
    const raw = station.item.kind.endsWith("-raw");
    if (raw)
      drawProgress(
        ctx,
        px,
        py,
        station.progress / COOK_SECONDS,
        COLORS.progress
      );
    else
      drawProgress(
        ctx,
        px,
        py,
        station.progress / (BURN_SECONDS - COOK_SECONDS),
        COLORS.burning
      );
  }
}

/**
 * A small badge in the corner of an open target, showing the item it wants,
 * so the outline says what goes there without reading the side panel.
 */
function drawWantBadge(ctx: CanvasRenderingContext2D, target: Target): void {
  const size = TILE * 0.36;
  const x = target.x * TILE + TILE - size - 4;
  const y = target.y * TILE + 4;
  ctx.fillStyle = COLORS.badge;
  ctx.beginPath();
  ctx.roundRect(x, y, size, size, 4);
  ctx.fill();
  drawItem(ctx, target.wants, x + size / 2, y + size / 2, size * 0.8);
}

function drawTarget(ctx: CanvasRenderingContext2D, target: Target): void {
  if (target.status === "unplanned") return;
  const px = target.x * TILE;
  const py = target.y * TILE;
  const cx = px + TILE / 2;
  const cy = py + TILE / 2;
  if (target.kind === "table") {
    ctx.fillStyle = COLORS.tableCloth;
    ctx.beginPath();
    ctx.arc(cx, cy, TILE * 0.42, 0, Math.PI * 2);
    ctx.fill();
  } else if (target.kind === "buffet") {
    ctx.fillStyle = COLORS.tableCloth;
    ctx.fillRect(px + 1, py + 6, TILE - 2, TILE - 12);
  }
  if (target.status === "simplified") {
    drawLabel(ctx, "BARE", cx, cy - 4, true);
    return;
  }
  const filled = target.filled;
  if (filled.length > 0) {
    filled.forEach((item, i) => {
      const offset = filled.length > 1 ? (i - 0.5) * TILE * 0.35 : 0;
      drawItem(ctx, item.kind, cx + offset, cy, TILE * 0.5);
    });
  }
  if (target.status === "open") {
    ctx.save();
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = COLORS.outline;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(px + 3.5, py + 3.5, TILE - 7, TILE - 7);
    ctx.restore();
    drawWantBadge(ctx, target);
    // A target that takes several items shows items placed out of its slots,
    // so a half-filled basket reads as part done, never as none.
    if (target.simplifyProgress > 0) {
      drawProgress(
        ctx,
        px,
        py,
        target.simplifyProgress / SIMPLIFY_SECONDS,
        COLORS.dim
      );
    }
  }
}

function drawPlayer(
  ctx: CanvasRenderingContext2D,
  player: Player,
  active: boolean
): void {
  if (player.presence === "away") return;
  const cx = player.x * TILE;
  const cy = player.y * TILE;
  const r = TILE * 0.3;
  if (active) {
    ctx.strokeStyle = COLORS.active;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 4, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = player.id === "fred" ? COLORS.fred : COLORS.abbi;
  ctx.strokeStyle = player.id === "fred" ? COLORS.fredEdge : COLORS.abbiEdge;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = player.id === "fred" ? COLORS.label : COLORS.fred;
  ctx.font = font(11);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(player.id === "fred" ? "F" : "A", cx, cy + 0.5);
  // A nub on the side the person faces.
  ctx.fillStyle = player.id === "fred" ? COLORS.fredEdge : COLORS.abbiEdge;
  ctx.beginPath();
  ctx.arc(cx + player.facingX * r, cy + player.facingY * r, 3, 0, Math.PI * 2);
  ctx.fill();
  if (player.holding) {
    drawItem(
      ctx,
      player.holding.kind,
      cx + player.facingX * r * 1.4,
      cy + player.facingY * r * 1.4 - 2,
      TILE * 0.4
    );
  }
  if (player.busyFor > 0) {
    drawBubble(ctx, player.busyReason ?? "…", cx, cy - r * 2.3 - 14);
  }
}

/**
 * One tile outlined in the venue's active colour. Every highlight uses this,
 * so the tile an interact would use and the tile the coach points at look the
 * same. Solid when the action is available, faint and dashed when it is not.
 * There is no animation.
 */
function drawTileOutline(
  ctx: CanvasRenderingContext2D,
  tile: Tile,
  ready: boolean
): void {
  const columns = VENUE_MAP[0]?.length ?? 0;
  if (
    tile.x < 0 ||
    tile.y < 0 ||
    tile.x >= columns ||
    tile.y >= VENUE_MAP.length
  )
    return;
  ctx.save();
  ctx.strokeStyle = COLORS.active;
  ctx.lineWidth = 2;
  ctx.globalAlpha = ready ? 1 : 0.4;
  ctx.setLineDash(ready ? [] : [3, 3]);
  ctx.strokeRect(tile.x * TILE + 2, tile.y * TILE + 2, TILE - 4, TILE - 4);
  ctx.restore();
}

/**
 * The outlines for one person. The tile their interact would act on is
 * outlined as the engine resolves it: a station beside them can beat the floor
 * in front of them. When a press would do nothing, the faced tile is outlined
 * instead, solid when that interact is available now and faint and dashed when
 * it is not. The coach's tile is outlined solid, or dashed for a wait step. A
 * tile that is both is outlined once.
 */
function drawPersonOutlines(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  id: PlayerId,
  coop: boolean
): void {
  const player = state.players[id];
  const coach = getCoachStep(state, id, { coop });
  const coachTile = coach?.tile ?? null;
  const waiting = coach?.waiting === true;
  const interact =
    player.presence === "away"
      ? null
      : {
          tile: interactTile(state, id) ?? frontTile(player),
          ready: getPrompt(state, id).interact !== null,
        };
  if (interact && coachTile && sameTile(interact.tile, coachTile)) {
    drawTileOutline(ctx, interact.tile, interact.ready && !waiting);
    return;
  }
  if (coachTile) drawTileOutline(ctx, coachTile, !waiting);
  if (interact) drawTileOutline(ctx, interact.tile, interact.ready);
}

function sameTile(a: Tile, b: Tile): boolean {
  return a.x === b.x && a.y === b.y;
}

/**
 * The count of an open target that takes several items, drawn on a plate. It is
 * drawn after the outlines, so the outline never covers the plate.
 */
function drawTargetCount(ctx: CanvasRenderingContext2D, target: Target): void {
  if (target.status !== "open" || target.capacity <= 1) return;
  drawLabel(
    ctx,
    `${target.filled.length}/${target.capacity}`,
    target.x * TILE + TILE / 2,
    target.y * TILE + TILE - 13,
    true
  );
}

/** A bar on the bin while someone holds work there to throw an item out. */
function drawBinHold(ctx: CanvasRenderingContext2D, player: Player): void {
  if (player.binHold <= 0 || player.presence === "away") return;
  const { x, y } = frontTile(player);
  drawProgress(
    ctx,
    x * TILE,
    y * TILE,
    player.binHold / BIN_HOLD_SECONDS,
    COLORS.progress
  );
}

/**
 * The bursts the venue may draw this frame: all of them in the loud cabinet,
 * none otherwise. The one gate the game uses, so the rule is tested directly.
 */
export function canvasBurstsFor(
  loud: boolean,
  bursts: readonly CanvasBurst[]
): readonly CanvasBurst[] {
  return loud ? bursts : [];
}

/** How long one burst of each kind stays up, in game seconds. */
export function burstLifetime(kind: CanvasBurst["kind"]): number {
  switch (kind) {
    case "charcoal":
      return SMOKE_SECONDS;
    case "crumple":
      return CRUMPLE_SECONDS;
    case "roses":
      return ROSES_SECONDS;
    default:
      return BURST_SECONDS;
  }
}

/** Smoke puffs: a sideways offset in tiles, and when each one starts (0 to 1). */
const SMOKE_PUFFS = [
  [-0.2, 0],
  [0.18, 0.25],
  [0, 0.5],
] as const;

/**
 * The rose bunches across the car's roof line, as tile centres. They sit on
 * the top edge, so the body, glass and wheels stay in view under them.
 */
const CAR_ROSES = [
  [0.3, 2.2],
  [0.75, 2.2],
  [1.2, 2.2],
  [1.65, 2.2],
] as const;

/** The car's outline: a rounded body from the roof line down to the wheels. */
function carOutline(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  ctx.roundRect(
    CAR.x * TILE,
    CAR.y * TILE,
    CAR.width * TILE,
    CAR.height * TILE,
    6
  );
}

/** Draws the car on the patio row: a graphite body with steel windows. */
function drawCar(ctx: CanvasRenderingContext2D): void {
  const px = CAR.x * TILE;
  const py = CAR.y * TILE;
  const w = CAR.width * TILE;
  const h = CAR.height * TILE;
  ctx.save();
  ctx.fillStyle = COLORS.carBody;
  ctx.strokeStyle = COLORS.outline;
  ctx.lineWidth = 1.5;
  carOutline(ctx);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = COLORS.carGlass;
  ctx.beginPath();
  ctx.roundRect(px + w * 0.22, py + h * 0.12, w * 0.56, h * 0.38, 3);
  ctx.fill();
  ctx.fillStyle = COLORS.carWheel;
  for (const share of [0.25, 0.75]) {
    ctx.beginPath();
    ctx.arc(px + w * share, py + h, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Draws the suit on a hanger in the coat-room corner, on the hedge tile. */
function drawCoatHanger(ctx: CanvasRenderingContext2D): void {
  const cx = COAT_TILE.x * TILE + TILE / 2;
  ctx.save();
  ctx.strokeStyle = COLORS.hanger;
  ctx.lineWidth = 1.5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(cx, 6, 3, 0, Math.PI * 2);
  ctx.moveTo(cx, 9);
  ctx.lineTo(cx, 13);
  ctx.moveTo(cx, 13);
  ctx.lineTo(cx - 12, 20);
  ctx.lineTo(cx + 12, 20);
  ctx.lineTo(cx, 13);
  ctx.stroke();
  ctx.fillStyle = COLORS.suit;
  ctx.beginPath();
  ctx.moveTo(cx - 6, 20);
  ctx.lineTo(cx + 6, 20);
  ctx.lineTo(cx + 9, 37);
  ctx.lineTo(cx - 9, 37);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = COLORS.suitLapel;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx, 21);
  ctx.lineTo(cx - 3, 30);
  ctx.moveTo(cx, 21);
  ctx.lineTo(cx + 3, 30);
  ctx.stroke();
  ctx.restore();
}

/**
 * True when someone stands on the one walkable tile beside the coat hanger.
 * Players are read by their tile, so the tip shows only for a person next to it.
 */
function nextToCoatRack(state: GameState): boolean {
  return (["fred", "abbi"] as const).some((id) => {
    const player = state.players[id];
    return (
      player.presence !== "away" &&
      Math.abs(Math.floor(player.x) - COAT_TILE.x) <= 1 &&
      Math.abs(Math.floor(player.y) - COAT_TILE.y) <= 1
    );
  });
}

/**
 * One crumpled note: a jagged sheet that turns, then shrinks and fades into a
 * ball over its lifetime. Drawn around its own centre, so the caller's
 * save and restore keep the transform to this one note.
 */
function drawCrumple(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  t: number
): void {
  const radius = TILE * 0.36;
  ctx.globalAlpha = 1 - t * 0.4;
  ctx.translate(cx, cy);
  ctx.rotate(t * Math.PI * 0.75);
  ctx.scale(1 - 0.55 * t, 1 - 0.55 * t);
  ctx.fillStyle = COLORS.label;
  ctx.strokeStyle = COLORS.dim;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const r = i % 2 === 0 ? radius : radius * 0.6;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

/** One burst at its age on the game clock; expired or future bursts draw nothing. */
function drawBurst(
  ctx: CanvasRenderingContext2D,
  burst: CanvasBurst,
  now: number
): void {
  const life = burstLifetime(burst.kind);
  const age = now - burst.startedAt;
  if (age < 0 || age >= life) return;
  const t = age / life;
  const cx = burst.x * TILE + TILE / 2;
  const cy = burst.y * TILE + TILE / 2;
  ctx.save();
  if (burst.kind === "ring") {
    ctx.globalAlpha = 1 - t;
    ctx.strokeStyle = COLORS.active;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, TILE * (0.35 + 0.45 * t), 0, Math.PI * 2);
    ctx.stroke();
  } else if (burst.kind === "charcoal") {
    ctx.fillStyle = COLORS.smoke;
    for (const [offset, start] of SMOKE_PUFFS) {
      if (t < start) continue;
      const local = (t - start) / (1 - start);
      ctx.globalAlpha = 0.75 * (1 - local);
      ctx.beginPath();
      ctx.arc(
        cx + offset * TILE,
        cy - TILE * (0.2 + 0.7 * local),
        TILE * (0.18 + 0.22 * local),
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
  } else if (burst.kind === "crumple") {
    drawCrumple(ctx, cx, cy, t);
  } else {
    ctx.globalAlpha = t < 0.7 ? 1 : (1 - t) / 0.3;
    for (const [x, y] of CAR_ROSES) {
      drawItem(ctx, "roses", x * TILE, y * TILE, TILE * 0.5);
    }
    // The outline goes back over the roses so the car still reads as a car.
    ctx.strokeStyle = COLORS.outline;
    ctx.lineWidth = 1.5;
    carOutline(ctx);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * A bubble over a person on the phone or re-tying shoes: the line they
 * are frozen by, sized to its text and kept inside the canvas.
 */
function drawBubble(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  top: number
): void {
  const height = LABEL_PX + 6;
  ctx.save();
  ctx.font = font(LABEL_PX);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const width = Math.min(ctx.measureText(text).width + 10, VENUE_WIDTH - 8);
  const left = clamp(cx - width / 2, 4, VENUE_WIDTH - width - 4);
  ctx.fillStyle = COLORS.busy;
  ctx.beginPath();
  ctx.roundRect(left, top, width, height, 4);
  ctx.fill();
  ctx.fillStyle = COLORS.fred;
  ctx.fillText(text, left + width / 2, top + height / 2, width - 6);
  ctx.restore();
}

/**
 * Draws the whole venue for one frame. `active` is the person playing in
 * solo; null means co-op, where both people's facing tiles are outlined.
 * `bursts` are drawn only when the caller passes them (the cabinet passes
 * none unless it is loud), timed on `state.time`.
 */
export function drawVenue(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  active: PlayerId | null,
  bursts: readonly CanvasBurst[] = []
): void {
  ctx.clearRect(0, 0, VENUE_WIDTH, VENUE_HEIGHT);
  const raining = state.seeded.some(
    (event) =>
      event.id === "shower" &&
      state.time >= event.at &&
      state.time < event.until
  );
  drawGround(ctx, raining);
  drawCoatHanger(ctx);
  if (state.setup.cart.roses === "yes") drawCar(ctx);
  // Crates of one kind share a stock, so its count is written once, on the
  // first crate (the top-left one); the others say the stock is shared.
  const countedKinds = new Set<SupplyKind>();
  for (const supply of state.supplies) {
    const px = supply.x * TILE;
    const py = supply.y * TILE;
    const left = state.stock[supply.kind];
    const countText = countedKinds.has(supply.kind) ? "shared" : String(left);
    countedKinds.add(supply.kind);
    ctx.fillStyle = COLORS.crate;
    ctx.strokeStyle = COLORS.crateEdge;
    ctx.lineWidth = 2;
    ctx.fillRect(px + 3, py + 3, TILE - 6, TILE - 6);
    ctx.strokeRect(px + 3, py + 3, TILE - 6, TILE - 6);
    ctx.globalAlpha = left > 0 ? 1 : 0.3;
    drawItem(ctx, supply.kind, px + TILE / 2, py + TILE / 2 + 2, TILE * 0.38);
    ctx.globalAlpha = 1;
    drawLabel(ctx, CRATE_NAMES[supply.kind], px + TILE / 2, py + 4);
    drawLabel(ctx, countText, px + TILE / 2, py + TILE - 13);
  }
  for (const target of state.targets) drawTarget(ctx, target);
  for (const station of state.stations) drawStation(ctx, station);
  for (const spot of state.floor) {
    drawItem(
      ctx,
      spot.item.kind,
      spot.x * TILE + TILE / 2,
      spot.y * TILE + TILE / 2,
      TILE * 0.45
    );
  }
  // The outlines sit above the props and below the station words and counts.
  const people = active ? [active] : (["fred", "abbi"] as const);
  for (const id of people) drawPersonOutlines(ctx, state, id, active === null);
  for (const target of state.targets) drawTargetCount(ctx, target);
  for (const station of state.stations) {
    drawStationLabel(ctx, station, state.stations);
  }
  for (const burst of bursts) drawBurst(ctx, burst, state.time);
  drawPlayer(ctx, state.players.fred, active === "fred");
  drawPlayer(ctx, state.players.abbi, active === "abbi");
  drawBinHold(ctx, state.players.fred);
  drawBinHold(ctx, state.players.abbi);
  if (nextToCoatRack(state)) {
    drawBubble(
      ctx,
      bankText("joke-suit-tip"),
      COAT_TILE.x * TILE + TILE / 2,
      TILE + 4
    );
  }
}
