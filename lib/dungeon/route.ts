/**
 * The branching route map for a roguelike run (#2084).
 *
 * A run draws its rooms from a room library, the list
 * `generateRoguelikeCampaign()` returns. The library's first room opens every
 * run and its boss rooms close it, in library order. Between them, after each
 * room the player picks one of two next rooms, drawn from a seeded PRNG so a
 * seed reproduces the same map. The route leaves one middle room out of a run
 * once there are three or more different ones, so every pick is a real fork.
 */

import { drawInt } from "@/lib/utils/prng";
import type { DungeonRoom, RoomThemeId } from "./types";

/**
 * Where a room sits in a run: the opening rooms, the middle rooms, the rest
 * stop with the market, and the bosses that close the run.
 */
export type RouteTier = "opening" | "middle" | "rest" | "boss";

const ROOM_TIERS: Partial<Record<RoomThemeId, RouteTier>> = {
  dmz_gateway: "opening",
  active_directory: "opening",
  classic_1: "opening",
  classic_2: "opening",
  blinkbrowse: "middle",
  tsp: "middle",
  zero_trust_core: "middle",
  billable_hours: "rest",
  darknet_vault: "rest",
  faceforge: "boss",
  neural_warden: "boss",
};

const ROOM_NAMES: Partial<Record<RoomThemeId, string>> = {
  dmz_gateway: "DMZ Gateway",
  active_directory: "Active Directory",
  blinkbrowse: "BlinkBrowse",
  tsp: "TSP Enclave",
  zero_trust_core: "Zero-Trust Core",
  billable_hours: "Darknet Vault",
  darknet_vault: "Darknet Vault",
  faceforge: "FaceForge",
  neural_warden: "Neural Warden",
};

/**
 * The route tier of a room. A room with a boss is a boss room whatever its
 * id; an unknown id counts as a middle room.
 *
 * @param room - The room, or its id and boss.
 * @returns The room's tier.
 */
export function routeTierOf(room: Pick<DungeonRoom, "id" | "boss">): RouteTier {
  if (room.boss) return "boss";
  return ROOM_TIERS[room.id] ?? "middle";
}

/**
 * The short name the route map shows for a room, such as "TSP Enclave".
 *
 * @param room - The room.
 * @returns The room's short name, or its title for a room without one.
 */
export function routeRoomName(room: Pick<DungeonRoom, "id" | "title">): string {
  return ROOM_NAMES[room.id] ?? room.title;
}

/** A run's seed and the rooms played so far, as room-library positions. */
export interface RunRoute {
  /** The run seed, such as "LAB-3F9K2Q". */
  readonly seed: string;
  /** Library positions of the rooms entered so far; the last is the current room. */
  readonly path: readonly number[];
}

/** How a room library splits into a run. */
export interface RoutePlan {
  /** Library position of the room every run opens on. */
  readonly start: number;
  /** Library positions the route picks from between the start and the bosses. */
  readonly middle: readonly number[];
  /** Library positions of the boss rooms that close every run, in order. */
  readonly bosses: readonly number[];
  /** How many middle rooms a run visits. */
  readonly middleSteps: number;
  /** Rooms in a run, start and bosses included. */
  readonly length: number;
}

/**
 * Splits a room library into the start room, the middle pool and the bosses.
 *
 * @param library - The rooms a run draws from, in their baseline order.
 * @returns The plan every route over this library follows.
 */
export function planRoute(library: readonly DungeonRoom[]): RoutePlan {
  if (library.length === 0) {
    return { start: 0, middle: [], bosses: [], middleSteps: 0, length: 0 };
  }
  const middle: number[] = [];
  const bosses: number[] = [];
  library.forEach((room, i) => {
    if (i === 0) return;
    (routeTierOf(room) === "boss" ? bosses : middle).push(i);
  });
  const distinct = new Set(middle.map((i) => library[i].id)).size;
  const middleSteps = distinct >= 3 ? middle.length - 1 : middle.length;
  return {
    start: 0,
    middle,
    bosses,
    middleSteps,
    length: 1 + middleSteps + bosses.length,
  };
}

/**
 * The number of rooms in a run over this library.
 *
 * @param library - The room library.
 * @returns The run length.
 */
export function routeRunLength(library: readonly DungeonRoom[]): number {
  return planRoute(library).length;
}

/**
 * A new route at the run's first room.
 *
 * @param seed - The run seed.
 * @returns The route, standing in the opening room.
 */
export function startRunRoute(seed: string): RunRoute {
  return { seed, path: [0] };
}

/** Keeps the lowest library position of each room id. */
function distinctById(
  library: readonly DungeonRoom[],
  positions: readonly number[]
): number[] {
  const seen = new Set<RoomThemeId>();
  const out: number[] = [];
  for (const i of positions) {
    if (seen.has(library[i].id)) continue;
    seen.add(library[i].id);
    out.push(i);
  }
  return out;
}

/** Draws up to `count` distinct entries of `pool`, kept in pool order. */
function drawDistinct(
  seed: string,
  pool: readonly number[],
  count: number
): number[] {
  const remaining = [...pool];
  const picked: number[] = [];
  for (let k = 0; k < count && remaining.length > 0; k++) {
    picked.push(remaining.splice(drawInt(seed, k, remaining.length), 1)[0]);
  }
  return picked.sort((a, b) => a - b);
}

/**
 * The rooms offered as the next step of a run, as library positions in
 * library order. Middle steps offer two rooms where there are two to offer;
 * the first middle step pairs an opening room with a middle room and keeps
 * the rest stop back, so the run ramps up. Boss steps offer their boss alone.
 * After the run's last room there is nothing to offer.
 *
 * @param library - The room library.
 * @param route - The route so far.
 * @returns The next-room options, or an empty list after the last room.
 */
export function drawRouteOptions(
  library: readonly DungeonRoom[],
  route: RunRoute
): number[] {
  const plan = planRoute(library);
  const step = route.path.length;
  if (step >= plan.length) return [];
  if (step > plan.middleSteps)
    return [plan.bosses[step - 1 - plan.middleSteps]];

  const visited = new Set(route.path);
  const candidates = distinctById(
    library,
    plan.middle.filter((i) => !visited.has(i))
  );
  if (candidates.length <= 2) return candidates;

  const drawSeed = `${route.seed}|route|${step}`;
  const tier = (i: number) => routeTierOf(library[i]);
  if (step === 1) {
    const notRest = candidates.filter((i) => tier(i) !== "rest");
    const pool = notRest.length >= 2 ? notRest : candidates;
    const opening = pool.filter((i) => tier(i) === "opening");
    const rest = pool.filter((i) => tier(i) !== "opening");
    if (opening.length > 0 && rest.length > 0) {
      return [opening[0], ...drawDistinct(drawSeed, rest, 1)].sort(
        (a, b) => a - b
      );
    }
    return drawDistinct(drawSeed, pool, 2);
  }
  return drawDistinct(drawSeed, candidates, 2);
}

/**
 * Moves the route on to the chosen room.
 *
 * @param library - The room library.
 * @param route - The route so far.
 * @param choice - The library position of the chosen room.
 * @returns The route with the chosen room as its current room.
 * @throws RangeError when the choice is not one of the offered rooms.
 */
export function chooseRouteRoom(
  library: readonly DungeonRoom[],
  route: RunRoute,
  choice: number
): RunRoute {
  if (!drawRouteOptions(library, route).includes(choice)) {
    throw new RangeError(`room ${choice} is not on offer at this step`);
  }
  return { seed: route.seed, path: [...route.path, choice] };
}

/**
 * The rooms of a route, numbered by their one-based position in the run.
 *
 * @param library - The room library.
 * @param route - The route.
 * @returns One room per step taken, in play order.
 */
export function routeRooms(
  library: readonly DungeonRoom[],
  route: RunRoute
): DungeonRoom[] {
  return route.path
    .filter((i) => library[i] !== undefined)
    .map((i, step) => ({ ...library[i], index: step + 1 }));
}

/** One room on the route map. */
export interface RouteMapRoom {
  /** The room's library position. */
  readonly libraryIndex: number;
  /** The room's id. */
  readonly id: RoomThemeId;
  /** Its short name. */
  readonly name: string;
  /** Its route tier. */
  readonly tier: RouteTier;
}

/** One step of the route map. */
export interface RouteMapStep {
  /** Zero-based position in the run. */
  readonly step: number;
  /**
   * `cleared` for rooms already behind the player, `current` for the room
   * just played, `choice` for the next step's options and `ahead` for later
   * steps: a known boss, or no rooms when the route has not reached it.
   */
  readonly state: "cleared" | "current" | "choice" | "ahead";
  /** The rooms at this step; empty for an undrawn step ahead. */
  readonly rooms: readonly RouteMapRoom[];
}

/**
 * The whole run as a map: the rooms played, the next choice, and the steps
 * ahead with their bosses named.
 *
 * @param library - The room library.
 * @param route - The route so far.
 * @returns One entry per step of the run.
 */
export function describeRouteMap(
  library: readonly DungeonRoom[],
  route: RunRoute
): RouteMapStep[] {
  const plan = planRoute(library);
  const toRoom = (i: number): RouteMapRoom => ({
    libraryIndex: i,
    id: library[i].id,
    name: routeRoomName(library[i]),
    tier: routeTierOf(library[i]),
  });
  const steps: RouteMapStep[] = [];
  const current = route.path.length - 1;
  const options = drawRouteOptions(library, route);
  for (let step = 0; step < plan.length; step++) {
    if (step < current) {
      steps.push({ step, state: "cleared", rooms: [toRoom(route.path[step])] });
    } else if (step === current) {
      steps.push({ step, state: "current", rooms: [toRoom(route.path[step])] });
    } else if (step === current + 1) {
      steps.push({ step, state: "choice", rooms: options.map(toRoom) });
    } else {
      const boss =
        step > plan.middleSteps
          ? plan.bosses[step - 1 - plan.middleSteps]
          : undefined;
      steps.push({
        step,
        state: "ahead",
        rooms: boss === undefined ? [] : [toRoom(boss)],
      });
    }
  }
  return steps;
}

const SEED_ALPHABET = "0123456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const SEED_LENGTH = 6;

/**
 * A new run seed, such as "LAB-3F9K2Q". The seed only names the run; the
 * route and rewards are drawn from it with the seeded PRNG.
 *
 * @param entropy - A 32-bit number to build the seed from. Left out, the
 *   browser's crypto source is used, or the clock where there is none.
 * @returns The seed.
 */
export function createRunSeed(entropy?: number): string {
  let value = entropy;
  if (value === undefined) {
    const source = globalThis.crypto;
    if (source && typeof source.getRandomValues === "function") {
      value = source.getRandomValues(new Uint32Array(1))[0];
    } else {
      value = Date.now();
    }
  }
  let n = Math.abs(Math.trunc(value)) >>> 0;
  let code = "";
  for (let i = 0; i < SEED_LENGTH; i++) {
    code = SEED_ALPHABET[n % SEED_ALPHABET.length] + code;
    n = Math.floor(n / SEED_ALPHABET.length);
  }
  return `LAB-${code}`;
}
