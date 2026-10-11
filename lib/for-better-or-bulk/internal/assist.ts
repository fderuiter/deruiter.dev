/**
 * The solo assist (ADR 0060, F6): a deterministic policy for the partner the
 * player is not controlling. It chooses the same kind of next step that
 * `getHint` names, walks there over the venue grid, and acts on only some
 * ticks, so it works at about 60% of a skilled player's pace. It has no
 * randomness, no clock and no say in presence: it never answers the brothers,
 * never acts for someone who is out or busy, and never changes presence.
 *
 * This module does not import the simulation, which imports it.
 */

import { VENUE_MAP, WALKABLE_TILES } from "../presets";
import type {
  GameState,
  Item,
  ItemKind,
  Player,
  PlayerId,
  PlayerInput,
  Station,
  SupplyKind,
  Target,
  Tile,
} from "../types";

/** The assist acts on this many ticks out of every PACE_PERIOD. */
export const ASSIST_PACE_PERIOD = 5;
export const ASSIST_PACE_ACTIVE = 3;

/** How far off a tile's centre a person may be before they line up again. */
const ALIGN_EPSILON = 0.08;

const NO_INPUT: PlayerInput = {
  moveX: 0,
  moveY: 0,
  interact: false,
  work: false,
};

/** Right, left, down, up: the order every BFS expands in. */
const DIRECTIONS: readonly { readonly dx: number; readonly dy: number }[] = [
  { dx: 1, dy: 0 },
  { dx: -1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: 0, dy: -1 },
];

const COOKED: Readonly<Partial<Record<ItemKind, ItemKind>>> = {
  "hotdogs-raw": "hotdogs",
  "wings-raw": "wings",
};

const RAW_CRATES = ["hotdogs-raw", "wings-raw"] as const;
const FRESH_CRATES = ["mac", "quinoa", "chairs", "lantern"] as const;

/** A tile to face, and the button to press on it. */
interface Goal {
  readonly x: number;
  readonly y: number;
  readonly act: "interact" | "work";
}

/** The first move toward a goal; null when the person already faces it. */
interface Step {
  readonly dx: number;
  readonly dy: number;
  /** False when the step only turns the person to face a blocked tile. */
  readonly moves: boolean;
}

interface Route {
  readonly goal: Goal;
  readonly step: Step | null;
}

const WIDTH = Math.max(...VENUE_MAP.map((row) => row.length));
const HEIGHT = VENUE_MAP.length;

function tileAt(x: number, y: number): string {
  return VENUE_MAP[y]?.[x] ?? "#";
}

function walkable(x: number, y: number): boolean {
  return WALKABLE_TILES.includes(tileAt(x, y));
}

function at(tile: Tile, act: Goal["act"]): Goal {
  return { x: tile.x, y: tile.y, act };
}

function stationsOf(state: GameState, kind: Station["kind"]): Station[] {
  return state.stations.filter((s) => s.kind === kind);
}

function freeStations(state: GameState, kind: Station["kind"]): Station[] {
  return stationsOf(state, kind).filter((s) => s.item === null);
}

function openTargets(state: GameState, wants: ItemKind): Target[] {
  return state.targets.filter((t) => t.status === "open" && t.wants === wants);
}

function cratesOf(state: GameState, kind: SupplyKind): Goal[] {
  return state.supplies
    .filter((s) => s.kind === kind)
    .map((s) => at(s, "interact"));
}

/**
 * The goals for someone carrying an item, in the order getHint tries them.
 * Each inner list is one tier: the first tier with a reachable goal wins.
 */
function carryTiers(state: GameState, held: Item): Goal[][] {
  switch (held.kind) {
    case "roses": {
      const arrangement = openTargets(state, "arrangement").length > 0;
      const petals = openTargets(state, "petals").length > 0;
      if (!arrangement && !petals) return [];
      const tiers = [
        freeStations(state, "arrange").map((s) => at(s, "interact")),
      ];
      if (petals)
        tiers.push(freeStations(state, "petals").map((s) => at(s, "interact")));
      return tiers;
    }
    case "hotdogs-raw":
    case "wings-raw": {
      const cooked = COOKED[held.kind];
      if (!cooked || openTargets(state, cooked).length === 0) return [];
      return [freeStations(state, "grill").map((s) => at(s, "interact"))];
    }
    case "burnt":
      return [stationsOf(state, "bin").map((s) => at(s, "work"))];
    default:
      return [openTargets(state, held.kind).map((t) => at(t, "interact"))];
  }
}

/** The goals for someone with free hands, in the order getHint tries them. */
function fetchTiers(state: GameState): Goal[][] {
  const grills = stationsOf(state, "grill");
  const arrangeOpen = openTargets(state, "arrangement").length > 0;
  const petalsOpen = openTargets(state, "petals").length > 0;
  const tiers: Goal[][] = [
    grills
      .filter((g) => g.item?.kind === "hotdogs" || g.item?.kind === "wings")
      .map((g) => at(g, "interact")),
    grills
      .filter((g) => g.item?.kind === "burnt")
      .map((g) => at(g, "interact")),
    arrangeOpen
      ? stationsOf(state, "arrange")
          .filter((s) => s.item?.kind === "arrangement")
          .map((s) => at(s, "interact"))
      : [],
    petalsOpen
      ? stationsOf(state, "petals")
          .filter((s) => s.item?.kind === "petals")
          .map((s) => at(s, "interact"))
      : [],
    state.floor.map((f) => at(f, "interact")),
    stationsOf(state, "arrange")
      .filter((s) => s.item?.kind === "roses")
      .map((s) => at(s, "work")),
    stationsOf(state, "petals")
      .filter((s) => s.item?.kind === "roses")
      .map((s) => at(s, "work")),
  ];
  const rosesWanted = arrangeOpen || petalsOpen;
  const rosesFit =
    freeStations(state, "arrange").length > 0 ||
    (petalsOpen && freeStations(state, "petals").length > 0);
  tiers.push(
    rosesWanted && state.stock.roses > 0 && rosesFit
      ? cratesOf(state, "roses")
      : []
  );
  for (const raw of RAW_CRATES) {
    const cooked = COOKED[raw];
    const fits =
      cooked !== undefined &&
      openTargets(state, cooked).length > 0 &&
      freeStations(state, "grill").length > 0;
    tiers.push(state.stock[raw] > 0 && fits ? cratesOf(state, raw) : []);
  }
  for (const kind of FRESH_CRATES) {
    tiers.push(
      state.stock[kind] > 0 && openTargets(state, kind).length > 0
        ? cratesOf(state, kind)
        : []
    );
  }
  return tiers;
}

/**
 * The nearest goal reachable from where the person stands, found by BFS over
 * (tile, facing) states. Turning to face a blocked tile costs one step, the
 * same as walking, so the route reproduces what the keys would do.
 */
function route(player: Player, goals: readonly Goal[]): Route | null {
  const goalAt = new Map(goals.map((g) => [`${g.x},${g.y}`, g] as const));
  if (goalAt.size === 0) return null;
  const stateIndex = (x: number, y: number, dir: number) =>
    (y * WIDTH + x) * 4 + dir;
  const startDir = Math.max(
    0,
    DIRECTIONS.findIndex(
      (d) => d.dx === player.facingX && d.dy === player.facingY
    )
  );
  const start = stateIndex(
    Math.floor(player.x),
    Math.floor(player.y),
    startDir
  );
  const seen = new Uint8Array(WIDTH * HEIGHT * 4);
  const firstStep: (Step | null | undefined)[] = [];
  const queue: number[] = [start];
  seen[start] = 1;
  firstStep[start] = null;
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head];
    const dir = current % 4;
    const tile = (current - dir) / 4;
    const x = tile % WIDTH;
    const y = Math.floor(tile / WIDTH);
    const ahead = DIRECTIONS[dir];
    const goal = goalAt.get(`${x + ahead.dx},${y + ahead.dy}`);
    if (goal) return { goal, step: firstStep[current] ?? null };
    DIRECTIONS.forEach((next, k) => {
      const nx = x + next.dx;
      const ny = y + next.dy;
      const moves = walkable(nx, ny);
      const reached = moves ? stateIndex(nx, ny, k) : stateIndex(x, y, k);
      if (seen[reached]) return;
      seen[reached] = 1;
      firstStep[reached] = firstStep[current] ?? {
        dx: next.dx,
        dy: next.dy,
        moves,
      };
      queue.push(reached);
    });
  }
  return null;
}

function sign(value: number): number {
  return value > 0 ? 1 : value < 0 ? -1 : 0;
}

/** The input for one tick, given the route and whether this tick acts. */
function actionFor(
  player: Player,
  found: Route,
  onShift: boolean
): PlayerInput {
  const { goal, step } = found;
  if (!step) {
    // Work at a station keeps going on every tick, so a held bin or grill
    // timer is not reset by the pace.
    if (goal.act === "work") return { ...NO_INPUT, work: true };
    return onShift ? { ...NO_INPUT, interact: true } : NO_INPUT;
  }
  if (!onShift) return NO_INPUT;
  if (!step.moves) return { ...NO_INPUT, moveX: step.dx, moveY: step.dy };
  // Walk on tile centres: line up across the tile first, so the body never
  // grazes a wall on the way to the next tile.
  if (step.dx !== 0) {
    const offset = player.y - (Math.floor(player.y) + 0.5);
    if (Math.abs(offset) > ALIGN_EPSILON)
      return { ...NO_INPUT, moveY: -sign(offset) };
    return { ...NO_INPUT, moveX: step.dx };
  }
  const offset = player.x - (Math.floor(player.x) + 0.5);
  if (Math.abs(offset) > ALIGN_EPSILON)
    return { ...NO_INPUT, moveX: -sign(offset) };
  return { ...NO_INPUT, moveY: step.dy };
}

/**
 * The input the solo assist gives `id` on this tick. Pure: the same state
 * always gives the same input. It returns nothing for someone who is out,
 * busy on a call or re-tying shoes, or who has no useful step.
 */
export function assistInput(state: GameState, id: PlayerId): PlayerInput {
  const player = state.players[id];
  if (player.presence === "away" || player.busyFor > 0) return NO_INPUT;
  const onShift = state.tick % ASSIST_PACE_PERIOD < ASSIST_PACE_ACTIVE;
  const tiers = player.holding
    ? carryTiers(state, player.holding)
    : fetchTiers(state);
  for (const goals of tiers) {
    if (goals.length === 0) continue;
    const found = route(player, goals);
    if (found) return actionFor(player, found, onShift);
  }
  return NO_INPUT;
}
