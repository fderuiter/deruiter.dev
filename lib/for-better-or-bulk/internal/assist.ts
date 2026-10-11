/**
 * The solo assist (ADR 0060, F6): a deterministic policy for the partner the
 * player is not controlling. It walks the venue grid to the same places that
 * `getHint` names, using the rules in `gates.ts` that `getHint` also uses, so
 * roses and fetches agree with the hints. Where the hints only name a step,
 * the assist also takes it, and it can put down an item nothing wants.
 *
 * The assist rests on most ticks (see `assistRests`), so its walks and presses
 * run at about 40% of a skilled player's pace. Its held work keeps its bin or
 * table hold on those ticks but pauses, so the simulation advances work only
 * on its active ticks. It keeps out of the player's way: it never goes for a
 * tile the person it helps is facing, or a place that person is carrying an
 * item to. It has no randomness, no clock and no say in presence: it never
 * answers the brothers, never acts for someone who is out or busy, and never
 * changes presence.
 *
 * This module does not import the simulation, which imports it.
 */

import { CRATE_NAMES, FLOOR_CAP, VENUE_MAP, WALKABLE_TILES } from "../presets";
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
import {
  FLOOR_TILES,
  roseStation,
  stationsOf,
  usable,
  wantsItem,
} from "./gates";
import {
  CRATE_ITEM_NAMES,
  ITEM_NAMES,
  STATION_NAMES,
  TARGET_NAMES,
} from "./words";

/** The assist acts on this many ticks out of every PACE_PERIOD: 2 of 5, about 40%. */
const PACE_PERIOD = 5;
const PACE_ACTIVE = 2;

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

/**
 * A tile to face, the button to press on it, and the phrase the status line
 * uses for it (such as "carrying the roses to the ARRANGE table").
 */
interface Goal {
  readonly x: number;
  readonly y: number;
  readonly act: "interact" | "work";
  readonly text: string;
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

/** The helper's current plan: where it is headed, and in what words. */
interface Plan {
  readonly route: Route;
  readonly text: string;
}

const WIDTH = Math.max(...VENUE_MAP.map((row) => row.length));
const HEIGHT = VENUE_MAP.length;

function tileAt(x: number, y: number): string {
  return VENUE_MAP[y]?.[x] ?? "#";
}

function walkable(x: number, y: number): boolean {
  return WALKABLE_TILES.includes(tileAt(x, y));
}

function keyOf(x: number, y: number): string {
  return `${x},${y}`;
}

function at(tile: Tile, act: Goal["act"], text: string): Goal {
  return { x: tile.x, y: tile.y, act, text };
}

function freeStations(state: GameState, kind: Station["kind"]): Station[] {
  return stationsOf(state, kind).filter((s) => s.item === null);
}

function openTargets(state: GameState, wants: ItemKind): Target[] {
  return state.targets.filter((t) => t.status === "open" && t.wants === wants);
}

function grabText(kind: SupplyKind): string {
  return `fetching ${CRATE_ITEM_NAMES[kind]} from the ${CRATE_NAMES[kind]} crate`;
}

function cratesOf(state: GameState, kind: SupplyKind): Goal[] {
  return state.supplies
    .filter((s) => s.kind === kind)
    .map((s) => at(s, "interact", grabText(kind)));
}

/**
 * Every empty floor tile a dropped item may rest on, found by scanning the
 * venue. A tile holding a station, crate, target or floor item is taken.
 */
function freeFloorGoals(state: GameState, item: ItemKind): Goal[] {
  const taken = new Set<string>();
  for (const tile of [
    ...state.stations,
    ...state.targets,
    ...state.supplies,
    ...state.floor,
  ]) {
    taken.add(keyOf(tile.x, tile.y));
  }
  const goals: Goal[] = [];
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      if (!FLOOR_TILES.includes(tileAt(x, y))) continue;
      if (taken.has(keyOf(x, y))) continue;
      goals.push({
        x,
        y,
        act: "interact",
        text: `putting ${ITEM_NAMES[item]} down`,
      });
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
  if (state.floor.length < FLOOR_CAP)
    tiers.push(freeFloorGoals(state, held.kind));
  if (held.kind in CRATE_ITEM_NAMES) {
    const kind = held.kind as SupplyKind;
    tiers.push(
      cratesOf(state, kind).map((g) => ({
        ...g,
        text: `putting ${ITEM_NAMES[held.kind]} back in its crate`,
      }))
    );
  }
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
      const text = `carrying the roses to ${STATION_NAMES[station]}`;
      return [freeStations(state, station).map((s) => at(s, "interact", text))];
    }
    case "hotdogs-raw":
    case "wings-raw": {
      const text = `carrying ${ITEM_NAMES[held.kind]} to ${STATION_NAMES.grill}`;
      return [freeStations(state, "grill").map((s) => at(s, "interact", text))];
    }
    case "burnt": {
      const text = `carrying ${ITEM_NAMES.burnt} to ${STATION_NAMES.bin}`;
      return [stationsOf(state, "bin").map((s) => at(s, "work", text))];
    }
    default:
      return [
        openTargets(state, held.kind).map((t) =>
          at(
            t,
            "interact",
            `carrying ${ITEM_NAMES[held.kind]} to ${TARGET_NAMES[t.kind]}`
          )
        ),
      ];
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
    grills.flatMap((g) =>
      g.item?.kind === "hotdogs" || g.item?.kind === "wings"
        ? usable(state, g.item.kind)
          ? [
              at(
                g,
                "interact",
                `taking ${ITEM_NAMES[g.item.kind]} off the grill`
              ),
            ]
          : []
        : []
    ),
    grills
      .filter((g) => g.item?.kind === "burnt")
      .map((g) =>
        at(g, "interact", `taking ${ITEM_NAMES.burnt} off the grill`)
      ),
    stationsOf(state, "arrange")
      .filter(
        (s) => s.item?.kind === "arrangement" && usable(state, "arrangement")
      )
      .map((s) =>
        at(
          s,
          "interact",
          `taking the arrangement from ${STATION_NAMES.arrange}`
        )
      ),
    stationsOf(state, "petals")
      .filter((s) => s.item?.kind === "petals" && usable(state, "petals"))
      .map((s) =>
        at(s, "interact", `taking the petals from ${STATION_NAMES.petals}`)
      ),
    state.floor
      .filter((f) => usable(state, f.item.kind))
      .map((f) =>
        at(
          f,
          "interact",
          `picking up ${ITEM_NAMES[f.item.kind]} from the floor`
        )
      ),
    wantsItem(state, "arrangement")
      ? stationsOf(state, "arrange")
          .filter((s) => s.item?.kind === "roses")
          .map((s) => at(s, "work", "arranging the roses"))
      : [],
    wantsItem(state, "petals")
      ? stationsOf(state, "petals")
          .filter((s) => s.item?.kind === "roses")
          .map((s) => at(s, "work", "plucking petals"))
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
 * The tiles the other person is working on right now: the tile they face, and
 * where their held item is going. The helper keeps out of these so the person
 * it helps stays the main actor. Empty when the other person is out.
 */
function claimedTiles(state: GameState, other: Player): Set<string> {
  const claimed = new Set<string>();
  if (other.presence !== "here") return claimed;
  claimed.add(
    keyOf(
      Math.floor(other.x) + other.facingX,
      Math.floor(other.y) + other.facingY
    )
  );
  if (other.holding) {
    for (const goal of carryTiers(state, other.holding)[0] ?? []) {
      claimed.add(keyOf(goal.x, goal.y));
    }
  }
  return claimed;
}

/**
 * The nearest goal reachable from where the person stands, found by BFS over
 * (tile, facing) states. Turning to face a blocked tile costs one step, the
 * same as walking, so the route reproduces what the keys would do. Goals on
 * `avoid` tiles are not considered, though the route may walk past them.
 */
function route(
  player: Player,
  goals: readonly Goal[],
  avoid: ReadonlySet<string>
): Route | null {
  const goalAt = new Map(
    goals
      .filter((g) => !avoid.has(keyOf(g.x, g.y)))
      .map((g) => [keyOf(g.x, g.y), g] as const)
  );
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
    const goal = goalAt.get(keyOf(x + ahead.dx, y + ahead.dy));
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
 * The helper's plan for `id` on this state: the first tier with a reachable
 * goal, route and all. Goals the other person is working on come last: the
 * helper takes one only when nothing else is open, so a stall can never leave
 * it holding an item it cannot place. Null when there is nothing it may do.
 * Pure.
 */
function planFor(state: GameState, id: PlayerId): Plan | null {
  const player = state.players[id];
  const other = id === "fred" ? "abbi" : "fred";
  const claimed = claimedTiles(state, state.players[other]);
  const tiers = player.holding
    ? carryTiers(state, player.holding)
    : fetchTiers(state);
  for (const avoid of [claimed, new Set<string>()]) {
    for (const goals of tiers) {
      if (goals.length === 0) continue;
      const found = route(player, goals, avoid);
      if (found) return { route: found, text: found.goal.text };
    }
  }
  return null;
}

/**
 * The input the solo assist gives `id` on this tick. Pure: the same state
 * always gives the same input. It returns nothing for someone who is out,
 * busy on a call or re-tying shoes, or who has no useful step.
 */
export function assistInput(state: GameState, id: PlayerId): PlayerInput {
  const player = state.players[id];
  if (player.presence === "away" || player.busyFor > 0) return NO_INPUT;
  const plan = planFor(state, id);
  if (!plan) return NO_INPUT;
  return actionFor(player, plan.route, !assistRests(state.tick));
}

/**
 * The status line for the helper working for `id`, in plain words, derived
 * from the same plan `assistInput` follows. Pure.
 */
export function assistStatus(state: GameState, id: PlayerId): string {
  const name = id === "fred" ? "Fred" : "Abbi";
  const player = state.players[id];
  if (player.presence === "away")
    return `Helper: waiting for ${name} to be back.`;
  if (player.busyFor > 0) return `Helper: waiting for ${name} to be free.`;
  const plan = planFor(state, id);
  return plan
    ? `Helper: ${plan.text}.`
    : "Helper: nothing useful to do right now.";
}
