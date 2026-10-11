/**
 * Draws a For Better or Bulk level onto a 2D canvas, top down. Pure over the
 * engine state, so it can be tested against a mocked context; the game calls
 * it once per animation frame with the context already scaled to logical
 * units.
 */

import {
  ARRANGE_SECONDS,
  BURN_SECONDS,
  COOK_SECONDS,
  PETAL_SECONDS,
  SIMPLIFY_SECONDS,
  VENUE_MAP,
  type GameState,
  type ItemKind,
  type Player,
  type PlayerId,
  type Station,
  type SupplyKind,
  type Target,
} from "@/lib/for-better-or-bulk";
import { clamp, GAME_FONT_FALLBACK_STACK } from "@/lib/game-utils";

/** Logical pixels per tile. */
export const TILE = 40;
export const VENUE_WIDTH = (VENUE_MAP[0]?.length ?? 20) * TILE;
export const VENUE_HEIGHT = VENUE_MAP.length * TILE;

/** The rows of paving at the top of the map; everything below is lawn. */
const PATIO_ROWS = 4;

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
  fred: "#1f2a44",
  fredEdge: "#94a3b8",
  abbi: "#f4f0e6",
  abbiEdge: "#d6c7a8",
  active: "#f59e0b",
  busy: "#f4f4f6",
} as const;

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

const CRATE_LABELS: Readonly<Record<SupplyKind, string>> = {
  roses: "ROSE",
  "hotdogs-raw": "DOGS",
  "wings-raw": "WING",
  mac: "MAC",
  quinoa: "QUIN",
  lantern: "LAMP",
  chairs: "CHAIR",
};

function font(size: number): string {
  return `700 ${size}px ${GAME_FONT_FALLBACK_STACK}`;
}

function drawGround(ctx: CanvasRenderingContext2D): void {
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

function drawLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  y: number,
  color: string = COLORS.label
): void {
  ctx.font = font(8);
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillStyle = color;
  ctx.fillText(text, cx, y);
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
      drawLabel(ctx, "ARRANGE", cx, py + 1);
      break;
    case "petals":
      ctx.fillStyle = COLORS.bucket;
      ctx.beginPath();
      ctx.arc(cx, cy, TILE * 0.36, 0, Math.PI * 2);
      ctx.fill();
      drawLabel(ctx, "PETALS", cx, py + 1);
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
      drawLabel(ctx, "GRILL", cx, py + 1);
      break;
    }
    case "bin":
      ctx.fillStyle = COLORS.bin;
      ctx.fillRect(px + 9, py + 7, TILE - 18, TILE - 12);
      drawLabel(ctx, "BIN", cx, py + 1);
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
        (station.progress - COOK_SECONDS) / (BURN_SECONDS - COOK_SECONDS),
        COLORS.burning
      );
  }
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
    drawLabel(ctx, "BARE", cx, cy - 4, "rgba(13, 14, 17, 0.55)");
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
    if (filled.length === 0) {
      ctx.globalAlpha = 0.35;
      drawItem(ctx, target.wants, cx, cy, TILE * 0.42);
      ctx.globalAlpha = 1;
    }
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
    ctx.fillStyle = COLORS.busy;
    ctx.beginPath();
    ctx.roundRect(cx + r * 0.4, cy - r * 2.3, 22, 13, 4);
    ctx.fill();
    ctx.fillStyle = COLORS.fred;
    ctx.font = font(9);
    ctx.fillText("…", cx + r * 0.4 + 11, cy - r * 2.3 + 6);
  }
}

/** Draws the whole venue for one frame. */
export function drawVenue(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  active: PlayerId | null
): void {
  ctx.clearRect(0, 0, VENUE_WIDTH, VENUE_HEIGHT);
  drawGround(ctx);
  for (const supply of state.supplies) {
    const px = supply.x * TILE;
    const py = supply.y * TILE;
    const left = state.stock[supply.kind];
    ctx.fillStyle = COLORS.crate;
    ctx.strokeStyle = COLORS.crateEdge;
    ctx.lineWidth = 2;
    ctx.fillRect(px + 3, py + 3, TILE - 6, TILE - 6);
    ctx.strokeRect(px + 3, py + 3, TILE - 6, TILE - 6);
    ctx.globalAlpha = left > 0 ? 1 : 0.3;
    drawItem(ctx, supply.kind, px + TILE / 2, py + TILE / 2 + 2, TILE * 0.38);
    ctx.globalAlpha = 1;
    drawLabel(ctx, CRATE_LABELS[supply.kind], px + TILE / 2, py + 4);
    drawLabel(
      ctx,
      String(left),
      px + TILE / 2,
      py + TILE - 13,
      left > 0 ? COLORS.label : COLORS.dim
    );
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
  drawPlayer(ctx, state.players.fred, active === "fred");
  drawPlayer(ctx, state.players.abbi, active === "abbi");
}
