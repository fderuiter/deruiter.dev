/**
 * Read-only views over a For Better or Bulk level: the wall clock, what the
 * interact and work buttons would do for one person right now, and the next
 * useful step for each person. Front ends use them for button prompts, the
 * coach strip, the highlight on the venue and the screen-reader status line.
 */

import { clamp } from "@/lib/game-utils";
import {
  CRATE_NAMES,
  FLOOR_CAP,
  ITEM_LABELS,
  THROW_OUT_PROMPT,
} from "../presets";
import type {
  GameState,
  HintOptions,
  Item,
  ItemKind,
  PlayerId,
  StationKind,
  SupplyKind,
  Tile,
} from "../types";
import { freeStation, openTarget, roseStation, stationsOf } from "./gates";
import {
  CRATE_ITEM_NAMES,
  ITEM_NAMES,
  STATION_NAMES,
  TARGET_NAMES,
} from "./words";
import { frontTile, interactTile } from "./sim";

/** The level runs from 9:00 to 4:00 on the wall clock. */
const START_HOUR = 9;
const LEVEL_HOURS = 7;

/**
 * The same tolerance the engine uses when it brings a person back (sim.ts), so
 * a time that is exactly on a minute reads as that minute, not one before it.
 */
const CLOCK_TOLERANCE = 1e-9;

/** The wall-clock time for a level time, as "h:mm". */
export function clockLabel(time: number, duration: number): string {
  const clamped = clamp(time, 0, duration);
  const minutes = Math.floor(
    (clamped / duration) * LEVEL_HOURS * 60 + CLOCK_TOLERANCE
  );
  const hour24 = START_HOUR + Math.floor(minutes / 60);
  const hour12 = ((hour24 + 11) % 12) + 1;
  return `${hour12}:${String(minutes % 60).padStart(2, "0")}`;
}

/** What one person's buttons would do right now. */
export interface Prompt {
  readonly interact: string | null;
  readonly work: string | null;
  readonly status: string;
}

/** The first thing in a list that sits on a tile. */
function at<T extends Tile>(list: readonly T[], tile: Tile): T | undefined {
  return list.find((entry) => entry.x === tile.x && entry.y === tile.y);
}

/** The prompt for an interact press that picks something up. */
function takePrompt(state: GameState, tile: Tile): string | null {
  const supply = at(state.supplies, tile);
  const station = at(state.stations, tile);
  const floorItem = at(state.floor, tile);
  if (supply && state.stock[supply.kind] > 0)
    return `Take ${ITEM_LABELS[supply.kind]}`;
  if (station?.item) return `Take ${ITEM_LABELS[station.item.kind]}`;
  if (floorItem) return `Pick up ${ITEM_LABELS[floorItem.item.kind]}`;
  return null;
}

/**
 * The prompt for an interact press that puts the held item down. It names the
 * tile the press will use, so the player can see where it lands.
 */
function placePrompt(state: GameState, tile: Tile, held: Item): string | null {
  const station = at(state.stations, tile);
  if (station)
    return `Put ${ITEM_NAMES[held.kind]} on ${STATION_NAMES[station.kind]}`;
  const supply = at(state.supplies, tile);
  if (supply)
    return `Put ${ITEM_NAMES[held.kind]} back in the ${CRATE_NAMES[supply.kind]} crate`;
  const target = at(state.targets, tile);
  if (target)
    return `Place ${ITEM_LABELS[held.kind]} at ${TARGET_NAMES[target.kind]}`;
  return state.floor.length < FLOOR_CAP
    ? `Put ${ITEM_NAMES[held.kind]} on the floor`
    : null;
}

/** Button prompts and a status line for one person. */
export function getPrompt(state: GameState, id: PlayerId): Prompt {
  const player = state.players[id];
  const name = id === "fred" ? "Fred" : "Abbi";
  if (player.presence === "away") {
    const back =
      state.returnsAt === null
        ? ""
        : ` Back around ${clockLabel(state.returnsAt, state.duration)}.`;
    return {
      interact: null,
      work: null,
      status: `${name} is out with his brothers.${back}`,
    };
  }
  if (player.busyFor > 0) {
    return {
      interact: null,
      work: null,
      status: `${name}: ${player.busyReason ?? "busy"}`,
    };
  }
  const held = player.holding;
  const status = held
    ? `${name} is carrying ${ITEM_LABELS[held.kind]}.`
    : `${name} has free hands.`;
  const front = frontTile(player);
  const station = at(state.stations, front);
  const target = at(state.targets, front);
  const tile = interactTile(state, id);

  let interact: string | null = null;
  let work: string | null = null;
  if (tile)
    interact = held ? placePrompt(state, tile, held) : takePrompt(state, tile);
  if (!held) {
    if (
      station &&
      (station.kind === "arrange" || station.kind === "petals") &&
      station.item?.kind === "roses"
    ) {
      work = station.kind === "arrange" ? "Arrange the roses" : "Pluck petals";
    } else if (
      target?.status === "open" &&
      target.filled.length === 0 &&
      (target.category === "centerpieces" || target.category === "petals")
    ) {
      work = "Simplify: leave this one bare";
    }
  } else if (station?.kind === "bin") {
    work = THROW_OUT_PROMPT;
  }
  return { interact, work, status };
}

const COOKED: Partial<Record<ItemKind, ItemKind>> = {
  "hotdogs-raw": "hotdogs",
  "wings-raw": "wings",
};

/** One coach line, and the tile it points at when it points at one. */
export interface CoachStep {
  readonly text: string;
  readonly tile: Tile | null;
}

/** The tile of the first station of a kind, or null when there is none. */
function firstTile(state: GameState, kind: StationKind): Tile | null {
  const station = stationsOf(state, kind)[0];
  return station ? { x: station.x, y: station.y } : null;
}

/** The tile of the first empty station of a kind, or null when all are busy. */
function freeTile(state: GameState, kind: StationKind): Tile | null {
  const station = stationsOf(state, kind).find((s) => s.item === null);
  return station ? { x: station.x, y: station.y } : null;
}

/** Where a crate sits in the venue: the top row, or the left-hand column. */
function grabStep(state: GameState, kind: SupplyKind): CoachStep {
  const crate = state.supplies.find((s) => s.kind === kind);
  const where = crate && crate.y <= 1 ? "on the top row" : "on the left";
  return {
    text: `Grab ${CRATE_ITEM_NAMES[kind]} from the ${CRATE_NAMES[kind]} crate ${where}.`,
    tile: crate ? { x: crate.x, y: crate.y } : null,
  };
}

/** The step for someone carrying an item bound for a target. */
function placeStep(state: GameState, held: ItemKind): CoachStep | null {
  const target = openTarget(state, held);
  return target
    ? {
        text: `Place ${ITEM_NAMES[held]} at ${TARGET_NAMES[target.kind]}.`,
        tile: { x: target.x, y: target.y },
      }
    : null;
}

/**
 * The step for someone carrying an item: a raw item goes to its station, a
 * made or cooked item goes to the target that wants it, and burnt food goes
 * to the bin. Null when nothing open wants the item.
 */
function carryStep(state: GameState, held: ItemKind): CoachStep | null {
  switch (held) {
    case "roses": {
      const wantsArrange = openTarget(state, "arrangement") !== undefined;
      const wantsPetals = openTarget(state, "petals") !== undefined;
      if (!wantsArrange && !wantsPetals) return null;
      const kind = roseStation(state);
      if (kind)
        return {
          text: `Take the roses to ${STATION_NAMES[kind]}.`,
          tile: freeTile(state, kind),
        };
      const busy: StationKind = wantsArrange ? "arrange" : "petals";
      return {
        text: `Wait for ${STATION_NAMES[busy]} to clear.`,
        tile: firstTile(state, busy),
      };
    }
    case "hotdogs-raw":
    case "wings-raw": {
      const cooked = COOKED[held];
      if (!cooked || !openTarget(state, cooked)) return null;
      const tile = freeTile(state, "grill");
      return tile
        ? {
            text: `Take ${ITEM_NAMES[held]} to ${STATION_NAMES.grill}.`,
            tile,
          }
        : {
            text: `Wait for ${STATION_NAMES.grill} to clear.`,
            tile: firstTile(state, "grill"),
          };
    }
    case "arrangement":
    case "petals":
    case "hotdogs":
    case "wings":
    case "mac":
    case "quinoa":
    case "lantern":
    case "chairs":
      return placeStep(state, held);
    case "burnt":
      return {
        text: `Carry ${ITEM_NAMES[held]} to ${STATION_NAMES.bin} and hold work there to throw it out.`,
        tile: firstTile(state, "bin"),
      };
    default:
      return null;
  }
}

/** The step to grab roses, when the rose station can take them. */
function roseGrab(state: GameState): CoachStep | null {
  return state.stock.roses > 0 && roseStation(state) !== null
    ? grabStep(state, "roses")
    : null;
}

/** The step to grab raw food for the grill, when an open buffet item wants it. */
function foodGrab(state: GameState): CoachStep | null {
  for (const raw of ["hotdogs-raw", "wings-raw"] as const) {
    const cooked = COOKED[raw];
    if (
      cooked &&
      state.stock[raw] > 0 &&
      openTarget(state, cooked) &&
      freeStation(state, "grill")
    ) {
      return grabStep(state, raw);
    }
  }
  return null;
}

/** The step at the grill for a batch cooking on it, when nothing else waits. */
function cookingStep(state: GameState): CoachStep | null {
  for (const grill of stationsOf(state, "grill")) {
    const cooked = grill.item ? COOKED[grill.item.kind] : undefined;
    if (cooked) {
      return {
        text: `Collect ${ITEM_NAMES[cooked]} from ${STATION_NAMES.grill} when they are ready.`,
        tile: { x: grill.x, y: grill.y },
      };
    }
  }
  return null;
}

/**
 * The step for someone with free hands: what finished work needs first.
 * The grab steps come in the order `lead` gives: roses first, or raw food
 * first for the co-op second person.
 */
function fetchStep(state: GameState, lead: "roses" | "food"): CoachStep | null {
  for (const grill of stationsOf(state, "grill")) {
    const item = grill.item;
    if (item?.kind === "hotdogs" || item?.kind === "wings")
      return {
        text: `Take ${ITEM_NAMES[item.kind]} off ${STATION_NAMES.grill}.`,
        tile: { x: grill.x, y: grill.y },
      };
  }
  for (const grill of stationsOf(state, "grill")) {
    if (grill.item?.kind === "burnt")
      return {
        text: `Take ${ITEM_NAMES.burnt} off ${STATION_NAMES.grill}.`,
        tile: { x: grill.x, y: grill.y },
      };
  }
  const readyArrangement = stationsOf(state, "arrange").find(
    (s) => s.item?.kind === "arrangement"
  );
  if (openTarget(state, "arrangement") && readyArrangement) {
    return {
      text: `Take the arrangement from ${STATION_NAMES.arrange}.`,
      tile: { x: readyArrangement.x, y: readyArrangement.y },
    };
  }
  const readyPetals = stationsOf(state, "petals").find(
    (s) => s.item?.kind === "petals"
  );
  if (openTarget(state, "petals") && readyPetals) {
    return {
      text: `Take ${ITEM_NAMES.petals} from ${STATION_NAMES.petals}.`,
      tile: { x: readyPetals.x, y: readyPetals.y },
    };
  }
  const loose = state.floor[0];
  if (loose)
    return {
      text: `Pick up ${ITEM_NAMES[loose.item.kind]} from the floor.`,
      tile: { x: loose.x, y: loose.y },
    };
  const roseArrange = stationsOf(state, "arrange").find(
    (s) => s.item?.kind === "roses"
  );
  if (openTarget(state, "arrangement") && roseArrange) {
    return {
      text: `Stand at ${STATION_NAMES.arrange} and hold work to arrange the roses.`,
      tile: { x: roseArrange.x, y: roseArrange.y },
    };
  }
  const rosePetals = stationsOf(state, "petals").find(
    (s) => s.item?.kind === "roses"
  );
  if (openTarget(state, "petals") && rosePetals) {
    return {
      text: `Stand at ${STATION_NAMES.petals} and hold work to pluck petals.`,
      tile: { x: rosePetals.x, y: rosePetals.y },
    };
  }
  const grabs = lead === "food" ? [foodGrab, roseGrab] : [roseGrab, foodGrab];
  for (const grab of grabs) {
    const step = grab(state);
    if (step) return step;
  }
  const cooking = cookingStep(state);
  if (cooking) return cooking;
  for (const kind of ["mac", "quinoa", "chairs", "lantern"] as const) {
    if (state.stock[kind] > 0 && openTarget(state, kind))
      return grabStep(state, kind);
  }
  return null;
}

/**
 * The coach's next step for one person: the line and the tile it points at.
 * It follows what the person holds. Null when there is nothing useful for them
 * to do (the level is over, or they are away). Co-op options give each person
 * their own starting job.
 */
export function getCoachStep(
  state: GameState,
  id: PlayerId,
  options: HintOptions = {}
): CoachStep | null {
  if (state.phase === "done") return null;
  const player = state.players[id];
  if (player.presence === "away") return null;
  if (player.holding) return carryStep(state, player.holding.kind);
  // In co-op the second person starts on the food, so the two lines differ.
  const lead = options.coop && id === "abbi" ? "food" : "roses";
  return fetchStep(state, lead);
}

/**
 * The coach's next step for one person, in plain words, or null when there is
 * nothing useful for them to do (see getCoachStep).
 */
export function getHint(
  state: GameState,
  id: PlayerId,
  options: HintOptions = {}
): string | null {
  return getCoachStep(state, id, options)?.text ?? null;
}

/** The venue tile the coach's step for one person points at, if any. */
export function getCoachTile(
  state: GameState,
  id: PlayerId,
  options: HintOptions = {}
): Tile | null {
  return getCoachStep(state, id, options)?.tile ?? null;
}
