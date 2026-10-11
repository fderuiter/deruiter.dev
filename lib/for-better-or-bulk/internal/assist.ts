/**
 * The solo assist (ADR 0060, F6): a deterministic policy for the partner the
 * player is not controlling. It walks the venue grid to the same places that
 * `getHint` names, using the rules in `gates.ts` that `getHint` also uses, so
 * roses and fetches agree with the hints. Where the hints only name a step,
 * the assist also takes it, and it can put down an item nothing wants.
 *
 * The assist rests on some ticks (see `assistRests`), so its walks and presses
 * run at about 60% of a skilled player's pace. Its held work keeps its bin or
 * table hold on those ticks but pauses, so the simulation advances work only
 * on its active ticks. It has no randomness, no clock and no say in presence:
 * it never answers the brothers, never acts for someone who is out or busy,
 * and never changes presence.
 *
 * This module does not import the simulation, which imports it.
 */

import { FLOOR_CAP, VENUE_MAP, WALKABLE_TILES } from "../presets";
import type {
  GameState,
  Item,
  ItemKind,
  Player,
  PlayerId,
  PlayerInput,
  Station,
  Target,
  Tile,
} from "../types";
import {
  FLOOR_TILES,
  roseStation,
  stationsOf,
  usable,
  wantsItem,
} from "./gates";

/** The assist acts on this many ticks out of every PACE_PERIOD. */
const PACE_PERIOD = 5;
const PACE_ACTIVE = 3;

/**
 * Whether the assist rests on this tick. Its walks and presses wait, and its
 * held work pauses without letting go. Pure: the same tick always gives the
 * same answer.
 */
export function assistRests(tick: number): boolean {
  return tick % PACE_PERIOD >= PACE_ACTIVE;
}

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

function freeStations(state: GameState, kind: Station["kind"]): Station[] {
  return stationsOf(state, kind).filter((s) => s.item === null);
}

function openTargets(state: GameState, wants: ItemKind): Target[] {
  return state.targets.filter((t) => t.status === "open" && t.wants === wants);
}

function cratesOf(state: GameState, kind: ItemKind): Goal[] {
  return state.supplies
    .filter((s) => s.kind === kind)
    .map((s) => at(s, "interact"));
}

/**
 * Every empty floor tile a dropped item may rest on, found by scanning the
 * venue. A tile holding a station, crate, target or floor item is taken.
 */
function freeFloorGoals(state: GameState): Goal[] {
  const taken = new Set<string>();
  for (const tile of [
    ...state.stations,
    ...state.targets,
    ...state.supplies,
    ...state.floor,
  ]) {
    taken.add(`${tile.x},${tile.y}`);
  }
  const goals: Goal[] = [];
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      if (!FLOOR_TILES.includes(tileAt(x, y))) continue;
      if (taken.has(`${x},${y}`)) continue;
      goals.push({ x, y, act: "interact" });
    }
  }
  return goals;
}

/**
 * The goals for someone holding an item that no open place wants: put it on
 * a free floor tile while the floor has room, or else back in its own crate.
 * Burnt food never lands here, because the bin always wants it.
 */
function dropTiers(state: GameState, held: Item): Goal[][] {
  const tiers: Goal[][] = [];
  if (state.floor.length < FLOOR_CAP) tiers.push(freeFloorGoals(state));
  tiers.push(cratesOf(state, held.kind));
  return tiers;
}

/**
 * The goals for someone carrying an item, in the order getHint tries them.
 * Each inner list is one tier: the first tier with a reachable goal wins.
 */
function carryTiers(state: GameState, held: Item): Goal[][] {
  if (!wantsItem(state, held.kind)) return dropTiers(state, held);
  switch (held.kind) {
    case "roses": {
      const station = roseStation(state);
      if (station === null) return [];
      return [freeStations(state, station).map((s) => at(s, "interact"))];
    }
    case "hotdogs-raw":
    case "wings-raw":
      return [freeStations(state, "grill").map((s) => at(s, "interact"))];
    case "burnt":
      return [stationsOf(state, "bin").map((s) => at(s, "work"))];
    default:
      return [openTargets(state, held.kind).map((t) => at(t, "interact"))];
  }
}

/**
 * The goals for someone with free hands, in the order getHint tries them.
 * Each item is fetched only when `usable` says an open place can take it now,
 * so the assist never lifts an item that nothing wants.
 */
function fetchTiers(state: GameState): Goal[][] {
  const grills = stationsOf(state, "grill");
  const tiers: Goal[][] = [
    grills
      .filter(
        (g) =>
          (g.item?.kind === "hotdogs" || g.item?.kind === "wings") &&
          usable(state, g.item.kind)
      )
      .map((g) => at(g, "interact")),
    grills
      .filter((g) => g.item?.kind === "burnt")
      .map((g) => at(g, "interact")),
    stationsOf(state, "arrange")
      .filter(
        (s) => s.item?.kind === "arrangement" && usable(state, "arrangement")
      )
      .map((s) => at(s, "interact")),
    stationsOf(state, "petals")
      .filter((s) => s.item?.kind === "petals" && usable(state, "petals"))
      .map((s) => at(s, "interact")),
    state.floor
      .filter((f) => usable(state, f.item.kind))
      .map((f) => at(f, "interact")),
    wantsItem(state, "arrangement")
      ? stationsOf(state, "arrange")
          .filter((s) => s.item?.kind === "roses")
          .map((s) => at(s, "work"))
      : [],
    wantsItem(state, "petals")
      ? stationsOf(state, "petals")
          .filter((s) => s.item?.kind === "roses")
          .map((s) => at(s, "work"))
      : [],
    state.stock.roses > 0 && usable(state, "roses")
      ? cratesOf(state, "roses")
      : [],
  ];
  for (const raw of RAW_CRATES) {
    tiers.push(
      state.stock[raw] > 0 && usable(state, raw) ? cratesOf(state, raw) : []
    );
  }
  for (const kind of FRESH_CRATES) {
    tiers.push(
      state.stock[kind] > 0 && usable(state, kind) ? cratesOf(state, kind) : []
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

/** The input for one tick, given the route and whether this tick is active. */
function actionFor(player: Player, found: Route, active: boolean): PlayerInput {
  const { goal, step } = found;
  if (!step) {
    // Work at a station keeps going on every tick, so a held bin or table
    // hold is not reset by the rest. The simulation paces the progress.
    if (goal.act === "work") return { ...NO_INPUT, work: true };
    return active ? { ...NO_INPUT, interact: true } : NO_INPUT;
  }
  if (!active) return NO_INPUT;
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
  const active = !assistRests(state.tick);
  const tiers = player.holding
    ? carryTiers(state, player.holding)
    : fetchTiers(state);
  for (const goals of tiers) {
    if (goals.length === 0) continue;
    const found = route(player, goals);
    if (found) return actionFor(player, found, active);
  }
  return NO_INPUT;
}
