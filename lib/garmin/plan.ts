/**
 * The Training Plan for Monkey C Mayhem (#1994): a coach's calendar of
 * workouts on paths, Recovery Huts, and Race Day at the end.
 *
 * - Each workout plays one stage of the plan's fixed course, so a workout is
 *   the same every time it is run.
 * - Clearing a node opens the nodes its paths lead to.
 * - A Recovery Hut hides three items; the player takes one into the gear bag.
 * - A cleared workout can be run again as practice, which changes nothing.
 * - Losing every life is a DNF: back to the map, paid for with a continue.
 *
 * This module is pure. The engine imports only {@link PlanRun}; the save lives
 * in `lib/garmin/plan-store.ts`, away from the standalone watch bundle.
 */

import { courseRandom } from "./course";
import type { FinisherCard } from "./engine";
import { cardsOf } from "./finisher";
import { START_LIVES } from "./powerups";
import { clamp } from "../game-utils";

/** A Training Plan workout as the engine runs it. */
export interface PlanRun {
  /** The one stage the workout plays, 1 to 5. */
  stage: number;
  /** The course seed. Every workout uses {@link PLAN_SEED}. */
  seed: number;
  /** Race Day: a steady race pace and The Wall at the end. */
  raceDay: boolean;
}

/** The course seed of every workout, so a workout is the same each time. */
export const PLAN_SEED = 1_994_000;

/** The kinds of node on the map. */
export type PlanNodeKind =
  "easy" | "tempo" | "intervals" | "long" | "hut" | "raceday";

/** The nodes of the map. */
export type PlanNodeId =
  "easy" | "tempo" | "intervals" | "long" | "hut-1" | "hut-2" | "raceday";

/** One node of the map. */
export interface PlanNode {
  id: PlanNodeId;
  kind: PlanNodeKind;
  name: string;
  /** The calendar day it sits on, e.g. "Wednesday". */
  day: string;
  /** The week it sits in, 1 or 2. */
  week: number;
  /** Map column, 0 to 3. */
  col: number;
  /** Map row: 0 for week 1, 1 for week 2. */
  row: number;
  /** The stage a workout plays; null for a hut. */
  stage: number | null;
  /** The nodes clearing this one opens. */
  next: readonly PlanNodeId[];
}

/**
 * The map, in plan order. Week 1 runs along the top row and week 2 along the
 * bottom; every path joins nodes next to each other, so the arrow keys follow
 * them.
 */
export const PLAN_NODES: readonly PlanNode[] = [
  {
    id: "easy",
    kind: "easy",
    name: "Easy Run",
    day: "Monday",
    week: 1,
    col: 0,
    row: 0,
    stage: 1,
    next: ["tempo"],
  },
  {
    id: "tempo",
    kind: "tempo",
    name: "Tempo",
    day: "Wednesday",
    week: 1,
    col: 1,
    row: 0,
    stage: 2,
    next: ["intervals", "hut-1"],
  },
  {
    id: "intervals",
    kind: "intervals",
    name: "Intervals",
    day: "Friday",
    week: 1,
    col: 2,
    row: 0,
    stage: 3,
    next: ["long", "hut-2"],
  },
  {
    id: "long",
    kind: "long",
    name: "Long Run",
    day: "Sunday",
    week: 1,
    col: 3,
    row: 0,
    stage: 4,
    next: ["raceday"],
  },
  {
    id: "hut-1",
    kind: "hut",
    name: "Recovery Hut",
    day: "Tuesday",
    week: 2,
    col: 1,
    row: 1,
    stage: null,
    next: [],
  },
  {
    id: "hut-2",
    kind: "hut",
    name: "Recovery Hut",
    day: "Thursday",
    week: 2,
    col: 2,
    row: 1,
    stage: null,
    next: [],
  },
  {
    id: "raceday",
    kind: "raceday",
    name: "Race Day",
    day: "Saturday",
    week: 2,
    col: 3,
    row: 1,
    stage: 5,
    next: [],
  },
];

/** The node every plan starts on. */
export const START_NODE: PlanNodeId = "easy";

/** The node with `id`. */
export function planNode(id: PlanNodeId): PlanNode {
  return PLAN_NODES.find((n) => n.id === id) ?? PLAN_NODES[0];
}

/** Whether `value` is the id of a map node. */
export function isPlanNodeId(value: unknown): value is PlanNodeId {
  return PLAN_NODES.some((n) => n.id === value);
}

/**
 * The items the gear bag holds (#1995): three power-ups that set the next
 * workout's starting tier, a Runner's High, an Energy Gel, a Pre-Workout, and
 * the map-only Rest Day. What each does is in lib/garmin/bag.ts.
 */
export type GearItem =
  "protein" | "heatmap" | "cape" | "high" | "gel" | "preworkout" | "restday";

/** Every gear item, in display order. */
export const GEAR_ITEMS: readonly GearItem[] = [
  "protein",
  "heatmap",
  "cape",
  "high",
  "gel",
  "preworkout",
  "restday",
];

/** Display names of the gear items. */
export const GEAR_ITEM_NAMES: Record<GearItem, string> = {
  protein: "Protein Shake",
  heatmap: "Heat Map",
  cape: "Compression Cape",
  high: "Runner's High",
  gel: "Energy Gel",
  preworkout: "Pre-Workout",
  restday: "Rest Day",
};

/** The gear bag holds at most this many items. */
export const BAG_SIZE = 8;

/** Continues a new plan starts with. */
export const START_CONTINUES = 2;

/** A Training Plan in progress: everything the save keeps. */
export interface PlanSave {
  /** Nodes cleared: workouts finished and huts visited. */
  cleared: PlanNodeId[];
  /** The item taken at each visited hut. */
  huts: Partial<Record<PlanNodeId, GearItem>>;
  /** The node the map cursor is on. */
  cursor: PlanNodeId;
  lives: number;
  continues: number;
  /** Points from every workout cleared. */
  score: number;
  bag: GearItem[];
  /** Items out of the bag, packed for the next workout (#1995). */
  packed: GearItem[];
  /** Nodes a Rest Day opened without clearing the workout before them (#1995). */
  unlocked: PlanNodeId[];
  /** Finisher Cards collected towards the next set of three (#1996). */
  cards: FinisherCard[];
  /** Race Day has been won: the finisher medal. */
  finished: boolean;
  /** DNFs since the last cleared workout. */
  dnfs: number;
  /** Training Effect of the last cleared workout, if any. */
  lastTe: number | null;
  /** Shuffles what each hut hides. */
  seed: number;
}

/** A fresh plan. `seed` shuffles what the huts hide. */
export function newPlan(seed: number): PlanSave {
  return {
    cleared: [],
    huts: {},
    cursor: START_NODE,
    lives: START_LIVES,
    continues: START_CONTINUES,
    score: 0,
    bag: [],
    packed: [],
    unlocked: [],
    cards: [],
    finished: false,
    dnfs: 0,
    lastTe: null,
    seed: Number.isFinite(seed) ? Math.floor(seed) >>> 0 : 0,
  };
}

/** Whether `id` has been cleared. */
export function isCleared(save: PlanSave, id: PlanNodeId): boolean {
  return save.cleared.includes(id);
}

/**
 * Whether `id` is open: the start node, a node a Rest Day opened, or on a
 * path from a cleared node.
 */
export function isOpen(save: PlanSave, id: PlanNodeId): boolean {
  if (id === START_NODE || save.unlocked.includes(id)) return true;
  return PLAN_NODES.some((n) => n.next.includes(id) && isCleared(save, n.id));
}

/** The arrow-key directions on the map. */
export type MapDirection = "up" | "down" | "left" | "right";

const STEP: Record<MapDirection, { col: number; row: number }> = {
  up: { col: 0, row: -1 },
  down: { col: 0, row: 1 },
  left: { col: -1, row: 0 },
  right: { col: 1, row: 0 },
};

/** Whether a path joins `a` and `b`, either way. */
function joined(a: PlanNode, b: PlanNode): boolean {
  return a.next.includes(b.id) || b.next.includes(a.id);
}

/**
 * The node the cursor moves to from `from` in `dir`: the neighbour that way,
 * when a path joins them and it is open. Otherwise the cursor stays.
 */
export function moveCursor(
  save: PlanSave,
  from: PlanNodeId,
  dir: MapDirection
): PlanNodeId {
  const here = planNode(from);
  const step = STEP[dir];
  const there = PLAN_NODES.find(
    (n) => n.col === here.col + step.col && n.row === here.row + step.row
  );
  if (!there || !joined(here, there) || !isOpen(save, there.id)) return from;
  return there.id;
}

/**
 * The open node `step` places from `from` in plan order, wrapping round: the
 * watch's UP and DOWN buttons step through the map this way.
 */
export function cycleCursor(
  save: PlanSave,
  from: PlanNodeId,
  step: 1 | -1
): PlanNodeId {
  const open = PLAN_NODES.filter((n) => isOpen(save, n.id));
  const at = open.findIndex((n) => n.id === from);
  if (open.length === 0) return from;
  if (at === -1) return open[0].id;
  return open[(at + step + open.length) % open.length].id;
}

/** The workout run for a node, or null for a hut. */
export function planRunFor(node: PlanNode): PlanRun | null {
  if (node.stage === null) return null;
  return {
    stage: node.stage,
    seed: PLAN_SEED,
    raceDay: node.kind === "raceday",
  };
}

/** What a cleared workout carries back to the plan. */
export interface WorkoutResult {
  /** Lives left at the finish. */
  lives: number;
  /** Points scored in the workout. */
  score: number;
  /** The stage's Training Effect, if graded. */
  trainingEffect: number | null;
  /**
   * The Finisher Cards held at the finish (#1996). Unset for a run that
   * collects none, Race Day's, which leaves the plan's cards as they are.
   */
  cards?: readonly FinisherCard[];
}

/**
 * The plan after clearing workout `id`: it is cleared (opening its paths),
 * the lives left and the points come back, and Race Day wins the medal.
 * A practice run never comes here. A locked node or a hut changes nothing.
 */
export function clearWorkout(
  save: PlanSave,
  id: PlanNodeId,
  result: WorkoutResult
): PlanSave {
  const node = planNode(id);
  if (node.stage === null || !isOpen(save, id)) return save;
  return {
    ...save,
    cleared: isCleared(save, id) ? save.cleared : [...save.cleared, id],
    lives: clamp(Math.floor(result.lives), 1, 99),
    score: save.score + Math.max(0, Math.floor(result.score)),
    cards: result.cards ? cardsOf(result.cards) : save.cards,
    finished: save.finished || node.kind === "raceday",
    dnfs: 0,
    lastTe: result.trainingEffect,
  };
}

/** A DNF and what it cost. */
export interface DnfOutcome {
  save: PlanSave;
  /** No continue was left: the plan's score went with it. */
  outOfContinues: boolean;
}

/**
 * The plan after a DNF: the lives refill, paid for with a continue. With no
 * continue left the continues refill and the plan's score is lost instead.
 * Map progress and the bag are always kept.
 */
export function dnfWorkout(save: PlanSave): DnfOutcome {
  const outOfContinues = save.continues <= 0;
  return {
    save: {
      ...save,
      lives: START_LIVES,
      continues: outOfContinues ? START_CONTINUES : save.continues - 1,
      score: outOfContinues ? 0 : save.score,
      dnfs: save.dnfs + 1,
    },
    outOfContinues,
  };
}

/** The three items hut `id` hides, in slot order, drawn by the plan's seed. */
export function hutItems(save: PlanSave, id: PlanNodeId): GearItem[] {
  const salt = PLAN_NODES.findIndex((n) => n.id === id) + 1;
  const rand = courseRandom(save.seed + salt * 7919);
  const items = GEAR_ITEMS.slice();
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items.slice(0, 3);
}

/** What taking a hut item did. */
export interface HutPick {
  save: PlanSave;
  /** The item behind the picked slot, or null when nothing could be taken. */
  item: GearItem | null;
  /** The item went into the bag; false when the bag was full. */
  stored: boolean;
}

/**
 * Takes the item behind `slot` (0 to 2) at hut `id`: the hut is cleared and
 * the item goes into the bag when there is room. A hut gives one item, and
 * only when it is open.
 */
export function takeHutItem(
  save: PlanSave,
  id: PlanNodeId,
  slot: number
): HutPick {
  const node = planNode(id);
  if (
    node.kind !== "hut" ||
    !isOpen(save, id) ||
    isCleared(save, id) ||
    !Number.isInteger(slot) ||
    slot < 0 ||
    slot > 2
  ) {
    return { save, item: null, stored: false };
  }
  const item = hutItems(save, id)[slot];
  // Packed gear still counts towards the bag's eight (#1995).
  const stored = save.bag.length + save.packed.length < BAG_SIZE;
  return {
    save: {
      ...save,
      cleared: [...save.cleared, id],
      huts: { ...save.huts, [id]: item },
      bag: stored ? [...save.bag, item] : save.bag,
    },
    item,
    stored,
  };
}

/** Garmin's Training Readiness levels. */
export type ReadinessLevel = "Poor" | "Low" | "Moderate" | "High" | "Prime";

/** Training Readiness, 1 to 100, with its level. */
export interface Readiness {
  score: number;
  level: ReadinessLevel;
}

/**
 * Training Readiness for the Morning Report: lives and the bag raise it,
 * DNFs since the last cleared workout lower it, and the last workout's
 * Training Effect adds a little.
 */
export function trainingReadiness(save: PlanSave): Readiness {
  const raw =
    45 +
    10 * Math.min(save.lives, 5) +
    5 * Math.min(save.bag.length, 4) -
    15 * save.dnfs +
    Math.round(4 * (save.lastTe ?? 0));
  const score = clamp(raw, 1, 100);
  const level: ReadinessLevel =
    score >= 95
      ? "Prime"
      : score >= 75
        ? "High"
        : score >= 50
          ? "Moderate"
          : score >= 25
            ? "Low"
            : "Poor";
  return { score, level };
}

/** The next workout to run: the first open, uncleared workout in plan order. */
export function nextWorkout(save: PlanSave): PlanNode | null {
  return (
    PLAN_NODES.find(
      (n) => n.stage !== null && isOpen(save, n.id) && !isCleared(save, n.id)
    ) ?? null
  );
}

/** What a node is to the player right now. */
export type NodeStatus = "locked" | "open" | "cleared";

/** The status of node `id`. */
export function nodeStatus(save: PlanSave, id: PlanNodeId): NodeStatus {
  if (isCleared(save, id)) return "cleared";
  return isOpen(save, id) ? "open" : "locked";
}

/**
 * The accessible label of a node, e.g. "Tempo, week 1 Wednesday, stage 2:
 * cleared, Space or START runs it as practice".
 */
export function nodeLabel(save: PlanSave, id: PlanNodeId): string {
  const node = planNode(id);
  const where = `${node.name}, week ${node.week} ${node.day}`;
  const what = node.stage === null ? "" : `, stage ${node.stage}`;
  const status = nodeStatus(save, id);
  if (status === "locked") return `${where}${what}: locked`;
  if (node.kind === "hut") {
    const item = save.huts[id];
    return status === "cleared" && item
      ? `${where}: visited, you took the ${GEAR_ITEM_NAMES[item]}`
      : `${where}: open, pick one of three hidden items`;
  }
  if (status === "cleared") {
    return `${where}${what}: cleared, Space or START runs it as practice`;
  }
  return `${where}${what}: open, Space or START starts it`;
}
