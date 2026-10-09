import { ACTION_COSTS, OVERTIME_ENERGY_FACTOR, lateMinutes } from "./clock";
import { CRO_FLOOR, isWalkable, roomAt, stepFrom, tileAt } from "./floor";
import {
  HARD_STOP,
  type DirectoryTarget,
  type Facing,
  type Route,
  type TilePoint,
  type WorldMap,
  type WorldResult,
  type WorldState,
} from "../types";

/** Clock minutes one tile of walking costs: four tiles a minute. */
export const WALK_MINUTES_PER_TILE = ACTION_COSTS.walk.minutes;

/** Tiles of walking per point of energy, matching `actionCost("walk")`. */
const TILES_PER_ENERGY = 40;

/** Neighbour order for routing. Fixed, so routes are deterministic. */
const DIRECTIONS: readonly Facing[] = ["up", "left", "right", "down"];

const key = (x: number, y: number) => `${x},${y}`;

function occupied(people: readonly TilePoint[], x: number, y: number) {
  return people.some((p) => p.x === x && p.y === y);
}

/** True when nobody can stand on the tile: walls, furniture, stations, people. */
export function isBlocked(
  map: WorldMap,
  x: number,
  y: number,
  people: readonly TilePoint[] = []
): boolean {
  return !isWalkable(map, x, y) || occupied(people, x, y);
}

/** Which way to face to look from one tile at a neighbouring one. */
export function facingToward(from: TilePoint, to: TilePoint): Facing {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) >= Math.abs(dy)) return dx < 0 ? "left" : "right";
  return dy < 0 ? "up" : "down";
}

/**
 * One press of an arrow key. The player turns to face the direction and, if
 * the tile there is free, steps onto it. A step costs a quarter of a clock
 * minute (fractional, so short walks are not rounded up), every fortieth
 * tile of the day costs a point of energy, and steps after the office day
 * are overtime. Turning into a wall or a person costs nothing.
 */
export function step(
  world: WorldState,
  facing: Facing,
  map: WorldMap = CRO_FLOOR,
  people: readonly TilePoint[] = []
): WorldResult<{ moved: boolean }> {
  if (world.study.status !== "running")
    return { ok: false, reason: "study-complete" };
  const turned: WorldState = {
    ...world,
    player: { ...world.player, facing },
  };
  const next = stepFrom(world.player, facing);
  if (isBlocked(map, next.x, next.y, people))
    return { ok: true, moved: false, world: turned };
  const end = world.minute + WALK_MINUTES_PER_TILE;
  if (end > HARD_STOP) return { ok: false, reason: "too-late" };
  const late = lateMinutes(world.minute, end);
  const base =
    Math.floor((world.walked + 1) / TILES_PER_ENERGY) -
    Math.floor(world.walked / TILES_PER_ENERGY);
  const energy = late > 0 ? Math.round(base * OVERTIME_ENERGY_FACTOR) : base;
  if (energy > world.energy) return { ok: false, reason: "too-tired" };
  return {
    ok: true,
    moved: true,
    world: {
      ...turned,
      player: { x: next.x, y: next.y, facing },
      minute: end,
      energy: world.energy - energy,
      overtime: world.overtime + late,
      walked: world.walked + 1,
      location: roomAt(map, next.x, next.y)?.id ?? world.location,
    },
  };
}

/** The two ways to slip sideways when walking in a direction. */
const SIDEWAYS: Record<Facing, readonly [Facing, Facing]> = {
  up: ["left", "right"],
  down: ["left", "right"],
  left: ["up", "down"],
  right: ["up", "down"],
};

/**
 * An arrow key with corner forgiveness. It is `step`, except that a key
 * pressed into a wall one tile off a doorway slides the player into line
 * with the door instead of stopping dead: the step sideways is taken (and
 * paid for) and the player keeps facing the way they pressed. It only
 * slides when exactly one side opens onto a free tile ahead, so it never
 * guesses between two doors, never slides into furniture or stations, and
 * never moves the player when a person is the thing in the way.
 */
export function forgivingStep(
  world: WorldState,
  facing: Facing,
  map: WorldMap = CRO_FLOOR,
  people: readonly TilePoint[] = []
): WorldResult<{ moved: boolean }> {
  const direct = step(world, facing, map, people);
  if (!direct.ok || direct.moved) return direct;
  const ahead = stepFrom(world.player, facing);
  if (tileAt(map, ahead.x, ahead.y) !== "wall") return direct;
  const slides = SIDEWAYS[facing].filter((side) => {
    const beside = stepFrom(world.player, side);
    if (isBlocked(map, beside.x, beside.y, people)) return false;
    const beyond = stepFrom(beside, facing);
    return !isBlocked(map, beyond.x, beyond.y, people);
  });
  if (slides.length !== 1) return direct;
  const slid = step(world, slides[0], map, people);
  if (!slid.ok || !slid.moved) return direct;
  return {
    ...slid,
    world: { ...slid.world, player: { ...slid.world.player, facing } },
  };
}

/** Tiles the player can stop on to reach a directory target. */
function goalsFor(
  target: DirectoryTarget,
  map: WorldMap,
  people: readonly TilePoint[]
): TilePoint[] {
  if (target.kind === "room") {
    const { anchor } = target.room;
    if (!isBlocked(map, anchor.x, anchor.y, people)) return [anchor];
    // Someone is standing on the anchor: any free tile in the room will do.
    const { x, y, width, height } = target.room.bounds;
    const free: TilePoint[] = [];
    for (let ty = y; ty < y + height; ty += 1)
      for (let tx = x; tx < x + width; tx += 1)
        if (!isBlocked(map, tx, ty, people)) free.push({ x: tx, y: ty });
    return free;
  }
  const spot = target.kind === "station" ? target.station : target.person;
  return DIRECTIONS.map((d) => stepFrom(spot, d)).filter(
    (t) => !isBlocked(map, t.x, t.y, people)
  );
}

/** The tile the player should end up looking at, if any. */
function lookAt(target: DirectoryTarget): TilePoint | null {
  if (target.kind === "station") return target.station;
  if (target.kind === "person") return target.person;
  return null;
}

/**
 * Plans the shortest walk to a directory target with a breadth-first search
 * over free tiles, and the facing that looks at it on arrival. People block
 * the way. Returns null when no free tile next to the target can be reached.
 */
export function planRoute(
  from: TilePoint & { facing: Facing },
  target: DirectoryTarget,
  map: WorldMap = CRO_FLOOR,
  people: readonly TilePoint[] = []
): Route | null {
  const goals = new Set(
    goalsFor(target, map, people).map((g) => key(g.x, g.y))
  );
  if (goals.size === 0) return null;
  const look = lookAt(target);
  const arrive = (at: TilePoint, steps: Facing[]): Route => ({
    steps,
    minutes: steps.length * WALK_MINUTES_PER_TILE,
    facing: look
      ? facingToward(at, look)
      : (steps[steps.length - 1] ?? from.facing),
  });
  if (goals.has(key(from.x, from.y))) return arrive(from, []);

  const came = new Map<string, { prev: string; dir: Facing }>();
  const seen = new Set([key(from.x, from.y)]);
  let frontier: TilePoint[] = [{ x: from.x, y: from.y }];
  while (frontier.length > 0) {
    const nextFrontier: TilePoint[] = [];
    for (const tile of frontier) {
      for (const dir of DIRECTIONS) {
        const n = stepFrom(tile, dir);
        const k = key(n.x, n.y);
        if (seen.has(k) || isBlocked(map, n.x, n.y, people)) continue;
        seen.add(k);
        came.set(k, { prev: key(tile.x, tile.y), dir });
        if (goals.has(k)) {
          const steps: Facing[] = [];
          let at = k;
          for (let link = came.get(at); link; link = came.get(at)) {
            steps.push(link.dir);
            at = link.prev;
          }
          steps.reverse();
          return arrive(n, steps);
        }
        nextFrontier.push(n);
      }
    }
    frontier = nextFrontier;
  }
  return null;
}

/**
 * Walks a planned route one step at a time, then turns to face the target.
 * Stops early, with what it managed, if a step is refused (too late or too
 * tired); `walkedSteps` says how far it got.
 */
export function followRoute(
  world: WorldState,
  route: Route,
  map: WorldMap = CRO_FLOOR,
  people: readonly TilePoint[] = []
): WorldResult<{ walkedSteps: number }> {
  let current = world;
  for (let i = 0; i < route.steps.length; i += 1) {
    const result = step(current, route.steps[i], map, people);
    if (!result.ok) {
      if (i === 0) return result;
      return { ok: true, world: current, walkedSteps: i };
    }
    if (!result.moved) return { ok: true, world: result.world, walkedSteps: i };
    current = result.world;
  }
  return {
    ok: true,
    walkedSteps: route.steps.length,
    world: { ...current, player: { ...current.player, facing: route.facing } },
  };
}
