/**
 * Read-only views over a For Better or Bulk level: the wall clock, what the
 * interact and work buttons would do for one person right now, and the next
 * useful step for each person. Front ends use them for button prompts, the
 * coach strip and the screen-reader status line.
 */

import { clamp } from "@/lib/game-utils";
import {
  CRATE_NAMES,
  FLOOR_CAP,
  ITEM_LABELS,
  THROW_OUT_PROMPT,
  VENUE_MAP,
  WALKABLE_TILES,
} from "../presets";
import type {
  GameState,
  ItemKind,
  PlayerId,
  Station,
  StationKind,
  SupplyKind,
  Target,
  TargetKind,
} from "../types";
import { frontTile } from "./sim";

/** The level runs from 9:00 to 4:00 on the wall clock. */
const START_HOUR = 9;
const LEVEL_HOURS = 7;

/** The wall-clock time for a level time, as "h:mm". */
export function clockLabel(time: number, duration: number): string {
  const clamped = clamp(time, 0, duration);
  const minutes = Math.floor((clamped / duration) * LEVEL_HOURS * 60);
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

/** Button prompts and a status line for one person. */
export function getPrompt(state: GameState, id: PlayerId): Prompt {
  const player = state.players[id];
  const name = id === "fred" ? "Fred" : "Abbi";
  if (player.presence === "away") {
    return {
      interact: null,
      work: null,
      status: `${name} is out with his brothers.`,
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
  const { x, y } = frontTile(player);
  const supply = state.supplies.find((s) => s.x === x && s.y === y);
  const station = state.stations.find((s) => s.x === x && s.y === y);
  const target = state.targets.find((t) => t.x === x && t.y === y);
  const floorItem = state.floor.find((f) => f.x === x && f.y === y);

  let interact: string | null = null;
  let work: string | null = null;
  if (!held) {
    if (supply && state.stock[supply.kind] > 0)
      interact = `Take ${ITEM_LABELS[supply.kind]}`;
    else if (station?.item) interact = `Take ${ITEM_LABELS[station.item.kind]}`;
    else if (floorItem)
      interact = `Pick up ${ITEM_LABELS[floorItem.item.kind]}`;
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
  } else if (station) {
    if (station.kind === "bin") work = THROW_OUT_PROMPT;
    else if (
      !station.item &&
      station.kind === "grill" &&
      (held.kind === "hotdogs-raw" || held.kind === "wings-raw")
    ) {
      interact = "Put it on the grill";
    } else if (
      !station.item &&
      station.kind !== "grill" &&
      held.kind === "roses"
    ) {
      interact = "Put the roses down";
    }
  } else if (supply) {
    if (supply.kind === held.kind) interact = "Put it back in the crate";
  } else if (target?.status === "open" && target.wants === held.kind) {
    interact = `Place ${ITEM_LABELS[held.kind]}`;
  } else if (
    !target &&
    !floorItem &&
    state.floor.length < FLOOR_CAP &&
    WALKABLE_TILES.includes(VENUE_MAP[y]?.[x] ?? "#")
  ) {
    interact = "Put it down";
  }
  return { interact, work, status };
}

/** Words for the places and things a hint names, with their venue letters. */
const STATION_NAMES: Readonly<Record<StationKind, string>> = {
  arrange: "the ARRANGE table (A)",
  petals: "the PETALS bucket (P)",
  grill: "the GRILL (G)",
  bin: "the BIN (X)",
};

const TARGET_NAMES: Readonly<Record<TargetKind, string>> = {
  basket: "the bouquet basket (K)",
  table: "a centerpiece table (T)",
  aisle: "an aisle spot (S)",
  "chair-spot": "a chair spot (O)",
  hook: "a lantern hook (N)",
  buffet: "the buffet (B)",
};

/** Items in the middle of a sentence, such as "Carry the roses to...". */
const ITEM_NAMES: Readonly<Record<ItemKind, string>> = {
  roses: "the roses",
  arrangement: "the arrangement",
  petals: "the bucket of petals",
  "hotdogs-raw": "the raw hot dogs",
  hotdogs: "the hot dogs",
  "wings-raw": "the raw wings",
  wings: "the wings",
  mac: "the mac and cheese",
  quinoa: "the quinoa salad",
  burnt: "the burnt food",
  lantern: "the lantern",
  chairs: "the stack of chairs",
};

/** What a crate hands out, as the object of "Grab ...". */
const CRATE_ITEM_NAMES: Readonly<Record<SupplyKind, string>> = {
  roses: "roses",
  "hotdogs-raw": "raw hot dogs",
  "wings-raw": "raw wings",
  mac: "mac and cheese",
  quinoa: "quinoa salad",
  lantern: "a lantern",
  chairs: "a stack of chairs",
};

const COOKED: Partial<Record<ItemKind, ItemKind>> = {
  "hotdogs-raw": "hotdogs",
  "wings-raw": "wings",
};

function stationsOf(state: GameState, kind: StationKind): Station[] {
  return state.stations.filter((s) => s.kind === kind);
}

function freeStation(state: GameState, kind: StationKind): boolean {
  return stationsOf(state, kind).some((s) => s.item === null);
}

function openTarget(state: GameState, wants: ItemKind): Target | undefined {
  return state.targets.find((t) => t.status === "open" && t.wants === wants);
}

function grabHint(kind: SupplyKind): string {
  return `Grab ${CRATE_ITEM_NAMES[kind]} from the ${CRATE_NAMES[kind]} crate on the left.`;
}

/** The next step for someone carrying an item. */
function carryHint(state: GameState, held: ItemKind): string | null {
  switch (held) {
    case "roses": {
      if (!openTarget(state, "arrangement") && !openTarget(state, "petals"))
        return null;
      if (freeStation(state, "arrange"))
        return `Carry the roses to ${STATION_NAMES.arrange}.`;
      if (openTarget(state, "petals") && freeStation(state, "petals"))
        return `Carry the roses to ${STATION_NAMES.petals}.`;
      return `Wait for ${STATION_NAMES.arrange} to clear.`;
    }
    case "arrangement": {
      const target = openTarget(state, "arrangement");
      return target
        ? `Carry ${ITEM_NAMES[held]} to ${TARGET_NAMES[target.kind]}.`
        : null;
    }
    case "petals": {
      const target = openTarget(state, "petals");
      return target
        ? `Carry ${ITEM_NAMES[held]} to ${TARGET_NAMES[target.kind]}.`
        : null;
    }
    case "hotdogs-raw":
    case "wings-raw": {
      const cooked = COOKED[held];
      if (!cooked || !openTarget(state, cooked)) return null;
      return freeStation(state, "grill")
        ? `Carry ${ITEM_NAMES[held]} to ${STATION_NAMES.grill}.`
        : `Wait for ${STATION_NAMES.grill} to clear.`;
    }
    case "hotdogs":
    case "wings":
    case "mac":
    case "quinoa": {
      const target = openTarget(state, held);
      return target
        ? `Carry ${ITEM_NAMES[held]} to ${TARGET_NAMES[target.kind]}.`
        : null;
    }
    case "burnt":
      return `Carry ${ITEM_NAMES[held]} to ${STATION_NAMES.bin} and hold work there to throw it out.`;
    case "lantern":
    case "chairs": {
      const target = openTarget(state, held);
      return target
        ? `Carry ${ITEM_NAMES[held]} to ${TARGET_NAMES[target.kind]}.`
        : null;
    }
    default:
      return null;
  }
}

/** The next step for someone with free hands: what finished work needs first. */
function fetchHint(state: GameState): string | null {
  for (const grill of stationsOf(state, "grill")) {
    const item = grill.item;
    if (item?.kind === "hotdogs" || item?.kind === "wings")
      return `Take ${ITEM_NAMES[item.kind]} off ${STATION_NAMES.grill}.`;
  }
  for (const grill of stationsOf(state, "grill")) {
    if (grill.item?.kind === "burnt")
      return `Take ${ITEM_NAMES.burnt} off ${STATION_NAMES.grill}.`;
  }
  if (
    openTarget(state, "arrangement") &&
    stationsOf(state, "arrange").some((s) => s.item?.kind === "arrangement")
  ) {
    return `Take the arrangement from ${STATION_NAMES.arrange}.`;
  }
  if (
    openTarget(state, "petals") &&
    stationsOf(state, "petals").some((s) => s.item?.kind === "petals")
  ) {
    return `Take ${ITEM_NAMES.petals} from ${STATION_NAMES.petals}.`;
  }
  const loose = state.floor[0];
  if (loose) return `Pick up ${ITEM_NAMES[loose.item.kind]} from the floor.`;
  if (stationsOf(state, "arrange").some((s) => s.item?.kind === "roses")) {
    return `Stand at ${STATION_NAMES.arrange} and hold work to arrange the roses.`;
  }
  if (stationsOf(state, "petals").some((s) => s.item?.kind === "roses")) {
    return `Stand at ${STATION_NAMES.petals} and hold work to pluck petals.`;
  }
  const rosesWanted =
    openTarget(state, "arrangement") !== undefined ||
    openTarget(state, "petals") !== undefined;
  if (
    rosesWanted &&
    state.stock.roses > 0 &&
    (freeStation(state, "arrange") ||
      (openTarget(state, "petals") !== undefined &&
        freeStation(state, "petals")))
  ) {
    return grabHint("roses");
  }
  for (const raw of ["hotdogs-raw", "wings-raw"] as const) {
    const cooked = COOKED[raw];
    if (
      cooked &&
      state.stock[raw] > 0 &&
      openTarget(state, cooked) &&
      freeStation(state, "grill")
    ) {
      return grabHint(raw);
    }
  }
  for (const kind of ["mac", "quinoa", "chairs", "lantern"] as const) {
    if (state.stock[kind] > 0 && openTarget(state, kind)) return grabHint(kind);
  }
  return null;
}

/**
 * The next useful step for one person, in plain words, or null when there is
 * nothing useful for them to do (the level is over, or they are away).
 */
export function getHint(state: GameState, id: PlayerId): string | null {
  if (state.phase === "done") return null;
  const player = state.players[id];
  if (player.presence === "away") return null;
  return player.holding
    ? carryHint(state, player.holding.kind)
    : fetchHint(state);
}
