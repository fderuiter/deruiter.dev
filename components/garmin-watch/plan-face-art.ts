/**
 * The Training Plan screens on the watch face (#1994): the Morning Report,
 * the map, a Recovery Hut and the card after a workout. Static drawings, so
 * reduced motion changes nothing here.
 */

import { CANVAS_SIZE } from "@/lib/garmin/engine";
import { gameFont } from "@/lib/game-utils";
import { FINISHER_CARD_NAMES } from "@/lib/garmin/finisher";
import {
  BAG_SIZE,
  GEAR_ITEM_NAMES,
  PLAN_NODES,
  hutItems,
  nextWorkout,
  nodeStatus,
  planNode,
  trainingReadiness,
  type GearItem,
  type PlanNode,
  type PlanNodeId,
  type PlanSave,
} from "@/lib/garmin/plan";

type Ctx = CanvasRenderingContext2D;

const CENTER = CANVAS_SIZE / 2;
const RADIUS = CANVAS_SIZE / 2 - 2;

const COLORS = {
  bg: "#0d0e11",
  identity: "#22d3ee",
  good: "#10b981",
  warn: "#f59e0b",
  danger: "#ef4444",
  steel: "#94a3b8",
  text: "#f4f4f6",
  dim: "#a1a1aa",
  locked: "#27272a",
  track: "rgba(148, 163, 184, 0.3)",
} as const;

/** What a workout's card says (#1994). */
export interface PlanOutcome {
  kind: "cleared" | "finisher" | "practice" | "dnf";
  node: PlanNodeId;
  /** Up to three short lines for the face. */
  lines: string[];
  /** The same in a sentence, for the announcer and the panel. */
  text: string;
}

/** Which Training Plan screen is showing. */
export type PlanScreen =
  | { kind: "report" }
  | { kind: "map" }
  | {
      kind: "hut";
      hut: PlanNodeId;
      /** The slot the cursor is on, 0 to 2. */
      slot: number;
      /** The item taken, once a slot is opened. */
      picked: GearItem | null;
      /** The item fitted in the bag. */
      stored: boolean;
    }
  | { kind: "result"; outcome: PlanOutcome };

/** Short day names for the map. */
const DAY_SHORT: Record<string, string> = {
  Monday: "MON",
  Tuesday: "TUE",
  Wednesday: "WED",
  Thursday: "THU",
  Friday: "FRI",
  Saturday: "SAT",
  Sunday: "SUN",
};

/** The letter on each kind of node. */
const NODE_GLYPH: Record<PlanNode["kind"], string> = {
  easy: "E",
  tempo: "T",
  intervals: "I",
  long: "L",
  hut: "H",
  raceday: "R",
};

/** Where a node sits on the face. */
function nodePoint(node: PlanNode): { x: number; y: number } {
  return { x: 64 + node.col * 51, y: 112 + node.row * 58 };
}

const NODE_R = 13;

function text(
  ctx: Ctx,
  value: string,
  x: number,
  y: number,
  px: number,
  color: string,
  weight: "normal" | "bold" = "bold"
) {
  ctx.font = gameFont(px, weight);
  ctx.textAlign = "center";
  ctx.fillStyle = color;
  ctx.fillText(value, x, y);
}

/** The colour of a Training Readiness level. */
function readinessColor(score: number): string {
  if (score >= 75) return COLORS.good;
  if (score >= 50) return COLORS.warn;
  return COLORS.danger;
}

/** The Finisher Cards held towards the next set (#1996), or null when none. */
function cardsLine(save: PlanSave): string | null {
  if (save.cards.length === 0) return null;
  return `CARDS: ${save.cards.map((c) => FINISHER_CARD_NAMES[c].toUpperCase()).join(" · ")}`;
}

/** The first line of the face's plan readout: lives, continues and the bag. */
function statusLine(save: PlanSave): string {
  return `LIVES ${save.lives} · CONT ${save.continues} · BAG ${save.bag.length + save.packed.length}/${BAG_SIZE}`;
}

function drawReport(ctx: Ctx, save: PlanSave) {
  const ready = trainingReadiness(save);
  const next = nextWorkout(save);
  text(ctx, "MORNING REPORT", CENTER, 62, 11, COLORS.identity);
  text(ctx, String(ready.score), CENTER, 112, 34, readinessColor(ready.score));
  text(
    ctx,
    `TRAINING READINESS · ${ready.level.toUpperCase()}`,
    CENTER,
    132,
    8,
    COLORS.text
  );
  const nextLine = next
    ? `NEXT: ${next.name.toUpperCase()} · ${DAY_SHORT[next.day]}`
    : save.finished
      ? "PLAN COMPLETE · FINISHER"
      : "NEXT: A RECOVERY HUT";
  text(ctx, nextLine, CENTER, 158, 10, COLORS.warn);
  text(ctx, statusLine(save), CENTER, 178, 8, COLORS.dim, "normal");
  text(
    ctx,
    save.packed.length > 0
      ? `SCORE ${save.score} · PACKED ${save.packed.map((item) => ITEM_SHORT[item]).join(" ")}`
      : `SCORE ${save.score}`,
    CENTER,
    192,
    8,
    COLORS.dim,
    "normal"
  );
  const cards = cardsLine(save);
  if (cards) text(ctx, cards, CENTER, 206, 8, COLORS.warn, "normal");
  text(ctx, "SPACE: TO THE MAP · X: BAG", CENTER, 222, 7.5, COLORS.steel);
}

function drawNode(ctx: Ctx, save: PlanSave, node: PlanNode, cursor: boolean) {
  const { x, y } = nodePoint(node);
  const status = nodeStatus(save, node.id);
  const race = node.kind === "raceday";
  const r = race ? NODE_R + 2 : NODE_R;
  if (cursor) {
    ctx.strokeStyle = COLORS.warn;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(x, y, r + 5, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle =
    status === "cleared"
      ? COLORS.good
      : status === "open"
        ? COLORS.bg
        : COLORS.locked;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle =
    status === "locked" ? COLORS.locked : race ? COLORS.warn : COLORS.identity;
  ctx.stroke();
  text(
    ctx,
    NODE_GLYPH[node.kind],
    x,
    y + 4,
    11,
    status === "cleared"
      ? COLORS.bg
      : status === "open"
        ? COLORS.text
        : COLORS.dim
  );
  text(ctx, DAY_SHORT[node.day], x, y + r + 15, 7, COLORS.dim, "normal");
}

function drawMap(ctx: Ctx, save: PlanSave) {
  text(ctx, "TRAINING PLAN", CENTER, 52, 11, COLORS.identity);
  text(ctx, statusLine(save), CENTER, 68, 7.5, COLORS.dim, "normal");
  const cards = cardsLine(save);
  if (cards) text(ctx, cards, CENTER, 80, 7, COLORS.warn, "normal");
  text(ctx, "WK 1", 20, 115, 7, COLORS.dim, "normal");
  text(ctx, "WK 2", 20, 173, 7, COLORS.dim, "normal");
  // Paths first, under the nodes: lit once the node they leave is cleared.
  for (const node of PLAN_NODES) {
    const from = nodePoint(node);
    for (const id of node.next) {
      const to = nodePoint(planNode(id));
      ctx.strokeStyle =
        nodeStatus(save, node.id) === "cleared" ? COLORS.good : COLORS.track;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    }
  }
  for (const node of PLAN_NODES) {
    drawNode(ctx, save, node, node.id === save.cursor);
  }
  const here = planNode(save.cursor);
  const status = nodeStatus(save, here.id);
  const stage = here.stage === null ? "" : ` · STAGE ${here.stage}`;
  text(
    ctx,
    `${here.name.toUpperCase()} · ${DAY_SHORT[here.day]}${stage}`,
    CENTER,
    214,
    9,
    COLORS.text
  );
  const hint =
    here.kind === "hut"
      ? status === "cleared"
        ? `VISITED · ${GEAR_ITEM_NAMES[save.huts[here.id] ?? "gel"].toUpperCase()}`
        : "SPACE: PICK AN ITEM"
      : status === "cleared"
        ? "CLEARED · SPACE: PRACTICE"
        : "SPACE: GO · X: GEAR BAG";
  text(ctx, hint, CENTER, 230, 7.5, COLORS.warn);
}

/** Short names of the hut items, to fit a box. */
const ITEM_SHORT: Record<GearItem, string> = {
  protein: "SHAKE",
  heatmap: "HEAT MAP",
  cape: "CAPE",
  high: "HIGH",
  gel: "GEL",
  preworkout: "PRE",
  restday: "REST DAY",
};

function drawHut(
  ctx: Ctx,
  save: PlanSave,
  screen: Extract<PlanScreen, { kind: "hut" }>
) {
  text(ctx, "RECOVERY HUT", CENTER, 66, 11, COLORS.identity);
  text(
    ctx,
    screen.picked ? "YOU TOOK" : "PICK ONE OF THREE",
    CENTER,
    86,
    8,
    COLORS.dim,
    "normal"
  );
  const items = hutItems(save, screen.hut);
  for (let i = 0; i < 3; i++) {
    const x = 80 + i * 60;
    const y = 140;
    const chosen = screen.slot === i;
    ctx.fillStyle = screen.picked && chosen ? COLORS.good : COLORS.locked;
    ctx.beginPath();
    ctx.roundRect(x - 22, y - 22, 44, 44, 6);
    ctx.fill();
    ctx.lineWidth = chosen ? 2.5 : 1.5;
    ctx.strokeStyle = chosen ? COLORS.warn : COLORS.steel;
    ctx.stroke();
    // Face down until one is opened; then every box shows what it held.
    const label = screen.picked ? ITEM_SHORT[items[i]] : "?";
    text(
      ctx,
      label,
      x,
      y + (screen.picked ? 3 : 6),
      screen.picked ? 8 : 18,
      screen.picked && chosen ? COLORS.bg : COLORS.text
    );
  }
  const footer = screen.picked
    ? screen.stored
      ? `${GEAR_ITEM_NAMES[screen.picked].toUpperCase()} · INTO THE BAG`
      : "BAG FULL · LEFT AT THE HUT"
    : "◀ ▶ CHOOSE · SPACE: OPEN";
  text(ctx, footer, CENTER, 192, 8, COLORS.warn);
  if (screen.picked) {
    text(ctx, "SPACE: BACK TO THE MAP", CENTER, 212, 7.5, COLORS.steel);
  }
}

function drawMedal(ctx: Ctx, x: number, y: number) {
  ctx.fillStyle = COLORS.danger;
  ctx.beginPath();
  ctx.moveTo(x - 9, y - 26);
  ctx.lineTo(x - 2, y - 8);
  ctx.lineTo(x + 2, y - 8);
  ctx.lineTo(x + 9, y - 26);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = COLORS.warn;
  ctx.beginPath();
  ctx.arc(x, y, 11, 0, Math.PI * 2);
  ctx.fill();
  text(ctx, "5K", x, y + 3.5, 8, COLORS.bg);
}

function drawResult(ctx: Ctx, outcome: PlanOutcome) {
  const title: Record<PlanOutcome["kind"], [string, string]> = {
    cleared: ["WORKOUT DONE", COLORS.good],
    finisher: ["FINISHER", COLORS.warn],
    practice: ["PRACTICE", COLORS.steel],
    dnf: ["DNF · BACK TO TRAINING", COLORS.danger],
  };
  const [label, color] = title[outcome.kind];
  let y = 84;
  if (outcome.kind === "finisher") {
    drawMedal(ctx, CENTER, 86);
    y = 124;
  }
  text(ctx, label, CENTER, y, outcome.kind === "dnf" ? 10 : 13, color);
  outcome.lines.slice(0, 3).forEach((line, i) => {
    text(ctx, line, CENTER, y + 24 + i * 16, 9, COLORS.text, "normal");
  });
  text(ctx, "SPACE / START: MORNING REPORT", CENTER, 222, 7.5, COLORS.steel);
}

/** Draws a Training Plan screen over the whole face. */
export function renderPlanFace(
  ctx: Ctx,
  save: PlanSave,
  screen: PlanScreen
): void {
  ctx.save();
  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  ctx.beginPath();
  ctx.arc(CENTER, CENTER, RADIUS, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  if (screen.kind === "report") drawReport(ctx, save);
  else if (screen.kind === "map") drawMap(ctx, save);
  else if (screen.kind === "hut") drawHut(ctx, save, screen);
  else drawResult(ctx, screen.outcome);
  ctx.restore();
}

/** The Finisher Cards held, as a sentence with a leading space, or "". */
function cardsSentence(save: PlanSave): string {
  return save.cards.length > 0
    ? ` Finisher cards: ${save.cards.map((c) => FINISHER_CARD_NAMES[c]).join(", ")}.`
    : "";
}

/** What a Training Plan screen shows, in words, for the screen's label. */
export function planScreenLabel(save: PlanSave, screen: PlanScreen): string {
  if (screen.kind === "report") {
    const ready = trainingReadiness(save);
    const next = nextWorkout(save);
    return `Morning Report. Training Readiness ${ready.score}, ${ready.level}. ${
      next
        ? `Next workout: ${next.name}, ${next.day}.`
        : save.finished
          ? "Plan complete."
          : "Next: a Recovery Hut."
    } Lives ${save.lives}, continues ${save.continues}, bag ${save.bag.length + save.packed.length} of ${BAG_SIZE}.${
      save.packed.length > 0
        ? ` Packed: ${save.packed.map((item) => GEAR_ITEM_NAMES[item]).join(", ")}.`
        : ""
    }${cardsSentence(save)} X opens the gear bag.`;
  }
  if (screen.kind === "map") {
    return `Training Plan map. On ${planNode(save.cursor).name}, ${planNode(save.cursor).day}.${cardsSentence(save)}`;
  }
  if (screen.kind === "hut") {
    return screen.picked
      ? `Recovery Hut. You took the ${GEAR_ITEM_NAMES[screen.picked]}.`
      : `Recovery Hut. Box ${screen.slot + 1} of 3 selected.`;
  }
  return screen.outcome.text;
}
