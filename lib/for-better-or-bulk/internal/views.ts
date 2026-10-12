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
  INTERRUPTIONS,
  ITEM_LABELS,
  THROW_OUT_PROMPT,
} from "../presets";
import type {
  GameState,
  HintOptions,
  Item,
  ItemKind,
  Player,
  PlayerId,
  StationKind,
  SupplyKind,
  Target,
  TargetKind,
  Tile,
} from "../types";
import { freeStation, openTarget, roseStation, stationsOf } from "./gates";
import {
  COOKED_NAMES,
  ITEM_NAMES,
  SPOT_NAMES,
  STATION_NAMES,
  TARGET_NAMES,
  crateGrabName,
  crateTakeName,
  heldLabel,
  SWAP_KEY_NAME,
  heldName,
  workKeyName,
} from "./words";
import {
  GRILL_COOKS,
  faceTiles,
  floorDropPress,
  interactTile,
  workTileFor,
} from "./press";

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

/**
 * The foods a buffet slot takes, with how each reads in "This spot is for ...
 * The ... go on their own spot." (a plural takes "go", a mass noun "goes").
 */
const BUFFET_FOOD: Partial<
  Record<
    ItemKind,
    {
      readonly want: string;
      readonly item: string;
      readonly verb: "go" | "goes";
    }
  >
> = {
  hotdogs: { want: "hot dogs", item: "The hot dogs", verb: "go" },
  wings: { want: "wings", item: "The wings", verb: "go" },
  mac: { want: "mac and cheese", item: "The mac and cheese", verb: "goes" },
  quinoa: { want: "quinoa salad", item: "The quinoa salad", verb: "goes" },
};

/**
 * The refusal for a buffet slot that the person faces. The slot is named by the
 * food it takes (round 9, Buffet spots), and a cooked food carried to the wrong
 * slot is told where it goes instead (round 8, S2). Null when the slot is not a
 * buffet slot.
 */
function buffetRefusal(target: Target, held: Item | null): string | null {
  const wanted = BUFFET_FOOD[target.wants];
  const carried = held ? BUFFET_FOOD[held.kind] : undefined;
  const name = wanted ? `This is the ${wanted.want} spot.` : null;
  if (!name) return null;
  if (carried && held && held.kind !== target.wants) {
    return `${name} ${carried.item} ${carried.verb} on their own spot.`;
  }
  return name;
}

/**
 * The grill or station beside the person that would take this item but is
 * occupied, so a press drops the item on the floor instead. Null when no
 * station in reach is blocked (round 8, S7).
 */
function blockedStationFor(
  state: GameState,
  person: Tile,
  held: Item
): string | null {
  for (const offset of [
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
  ]) {
    const tile = { x: person.x + offset.x, y: person.y + offset.y };
    const station = at(state.stations, tile);
    if (!station?.item || station.kind === "bin") continue;
    const takes =
      station.kind === "grill"
        ? held.kind in GRILL_COOKS
        : held.kind === "roses";
    if (takes) return `${capitalise(STATION_NAMES[station.kind])} is full.`;
  }
  return null;
}

/**
 * The prompt for a press with something in hand that has no tile to land on
 * while the floor is full (round 8, S8): the press does nothing, so the prompt
 * says why. The blocked-station line is kept in front when a station in reach
 * is the reason as well. Null while the floor has room.
 */
function fullFloorPrompt(
  state: GameState,
  person: Player,
  held: Item
): string | null {
  if (state.floor.length < FLOOR_CAP) return null;
  const line = "The floor here is full. Find a station or the bin.";
  const blocked = blockedStationFor(
    state,
    { x: Math.floor(person.x), y: Math.floor(person.y) },
    held
  );
  return blocked ? `${blocked} ${line}` : line;
}

/** What a spot that has been filled says, by its kind. */
const SPOT_DONE: Readonly<Record<TargetKind, string>> = {
  basket: "This bouquet basket is full.",
  table: "This table already has its centerpiece.",
  aisle: "This aisle spot is already done.",
  "chair-spot": "This chair spot is already set.",
  hook: "This lantern hook is already done.",
  buffet: "This spot is already set.",
};

/** What a spot that was left bare on purpose (simplified by holding the work key) says, by its kind. */
const SPOT_BARE: Readonly<Record<TargetKind, string>> = {
  basket: "This bouquet basket was left bare on purpose.",
  table: "This table was left bare on purpose.",
  aisle: "This aisle spot was left bare on purpose.",
  "chair-spot": "This chair spot was left bare on purpose.",
  hook: "This lantern hook was left bare on purpose.",
  buffet: "This spot was left bare on purpose.",
};

/**
 * The line for a finished arrangement faced at a station (round 12, task 2):
 * where an arrangement goes, naming only the target kinds that still have an
 * open spot. With none open, a true line says the arrangement has no place.
 */
function arrangementRefusal(state: GameState): string {
  const open = (kind: TargetKind): boolean =>
    state.targets.some((t) => t.kind === kind && t.status === "open");
  const table = open("table");
  const basket = open("basket");
  if (table && basket)
    return `Arrangements go on ${TARGET_NAMES.table} or in ${TARGET_NAMES.basket}.`;
  if (table) return `Arrangements go on ${TARGET_NAMES.table}.`;
  if (basket) return `Arrangements go in ${TARGET_NAMES.basket}.`;
  return "No centerpiece table or bouquet basket needs an arrangement now.";
}

/** Whether the bin is on this tile. */
function isBinAt(state: GameState, tile: Tile): boolean {
  return at(state.stations, tile)?.kind === "bin";
}

/**
 * The reason a faced tile gives for a press that does nothing, or null when
 * that tile has nothing to say: a plain tile with nothing in hand, or the bin
 * with something in hand (see `unpressedReason`).
 */
function reasonOnTile(
  state: GameState,
  tile: Tile,
  held: Item | null
): string | null {
  const supply = at(state.supplies, tile);
  const station = at(state.stations, tile);
  const target = at(state.targets, tile);
  const floorItem = at(state.floor, tile);

  if (supply) {
    if (held)
      return `The ${CRATE_NAMES[supply.kind]} crate only takes ${ITEM_NAMES[supply.kind]}.`;
    return `The ${CRATE_NAMES[supply.kind]} crate is empty.`;
  }
  if (station) {
    // The bin is emptied by holding work, and the work prompt names that hold,
    // so a held item at the bin gets no interact line.
    if (station.kind === "bin")
      return held ? null : `Nothing on ${STATION_NAMES.bin} to take.`;
    if (station.item)
      return `${capitalise(STATION_NAMES[station.kind])} is full.`;
    if (!held) return `Nothing on ${STATION_NAMES[station.kind]} to take.`;
    if (station.kind === "grill") {
      if (held.kind !== "hotdogs" && held.kind !== "wings")
        return "The GRILL (G) takes raw hot dogs or wings.";
      // Only say where cooked food goes when an open buffet spot wants it.
      const buffetWants = state.targets.some(
        (t) =>
          t.kind === "buffet" && t.status === "open" && t.wants === held.kind
      );
      return buffetWants
        ? "Cooked food goes on the buffet, not back on the grill."
        : "These are cooked already.";
    }
    if (held.kind === "arrangement") return arrangementRefusal(state);
    return `${capitalise(STATION_NAMES[station.kind])} takes roses.`;
  }
  if (target) {
    if (target.status === "unplanned") return "This spot is not in this plan.";
    if (target.status === "simplified") return SPOT_BARE[target.kind];
    if (target.status !== "open") return SPOT_DONE[target.kind];
    if (target.kind === "buffet") return buffetRefusal(target, held);
    return `This ${SPOT_NAMES[target.kind]} needs ${ITEM_LABELS[target.wants]}.`;
  }
  if (floorItem) return "Something is already on the floor here.";
  return null;
}

/**
 * Why an interact press does nothing for this person, as one line. Only
 * `getPrompt` calls it, and only when `interactTile` has already found that no
 * press lands, so `pressTileFor` is not run a second time. The contract is
 * one-way: a press that lands never gets a line here, and a press that does
 * nothing gets one, with these exceptions:
 *
 * - The bin with something in hand gets no line, because the work prompt
 *   names the hold that empties it. This holds even when the bin is one of
 *   two faced tiles, so a bin that straddles with a wall gets no line either.
 * - A press with nothing in hand that faces only plain ground gets no line,
 *   since there is nothing to refuse.
 *
 * Burnt food in hand gets one line wherever the bin is not faced, which names
 * the bin (round 11), so it is never a bare "Nothing here takes" for the one
 * item only the bin wants. Facing the bin, the usual rules apply.
 *
 * Each faced tile is checked in turn (see `faceTiles`), and the first reason
 * wins. So a bin with no line lets the grill beside it speak. When no faced
 * tile has a reason and something is held, the tile in front is named: a full
 * floor, a station in reach that is full, or a plain "Nothing here takes ..."
 * when the front is a wall or otherwise unusable.
 */
function unpressedReason(state: GameState, person: Player): string | null {
  const held = person.holding;
  const faced = faceTiles(person);
  // Away from the bin, burnt food names the bin. Facing it, the bin stays
  // silent but a station straddled beside it still gives its own reason.
  if (held?.kind === "burnt" && !faced.some((tile) => isBinAt(state, tile)))
    return `Burnt food goes in ${STATION_NAMES.bin}.`;
  for (const tile of faced) {
    const reason = reasonOnTile(state, tile, held);
    if (reason) return reason;
  }
  if (!held) return null;
  if (faced.some((tile) => isBinAt(state, tile))) return null;
  return (
    fullFloorPrompt(state, person, held) ??
    `Nothing here takes ${heldName(held)}.`
  );
}

/**
 * The people whose status line the prompt panel shows. Solo shows the person at
 * the keyboard, and the partner as well while the partner is out or frozen (on
 * the phone, or retying a shoelace), so a call never goes unexplained (round 9,
 * task 4). Without a helper the idle partner is listed too, with a line that
 * names the swap key (round 12, task 1). A helper day lists the partner only
 * when away or frozen, as before. Co-op shows both people and is not handled here.
 */
export function shownPrompts(
  state: GameState,
  active: PlayerId
): readonly PlayerId[] {
  const partner: PlayerId = active === "fred" ? "abbi" : "fred";
  const other = state.players[partner];
  if (other.presence === "away" || other.busyFor > 0) return [active, partner];
  return state.setup.assist ? [active] : [active, partner];
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * A floor drop the person holds E for (ADR 0060 amendment). `note` is the line
 * for a station in reach that is full, or null. `action` is what the hold
 * does, without the key: the prompt reads "Hold E to " followed by `action`.
 */
export interface FloorDropPrompt {
  readonly note: string | null;
  readonly action: string;
}

/** What one person's buttons would do right now. */
export interface Prompt {
  readonly interact: string | null;
  /** Set when the interact press would set the held item on open floor: it needs a hold. */
  readonly floorDrop: FloorDropPrompt | null;
  readonly work: string | null;
  readonly status: string;
}

/** Options for one person's prompt. */
export interface PromptOptions {
  /**
   * True for the idle partner in solo play, who is not at the keys. Their
   * prompt then has no buttons and a status that names the swap key. Ignored
   * on a helper day, where the partner is the helper's charge.
   */
  readonly waiting?: boolean;
}

/** The status line for an idle partner in solo play, naming the swap key. */
function swapStatus(id: PlayerId): string {
  const name = id === "fred" ? "Fred" : "Abbi";
  const pronoun = id === "fred" ? "him" : "her";
  return `${name} is waiting. ${SWAP_KEY_NAME} to switch to ${pronoun}.`;
}

/** The first thing in a list that sits on a tile. */
function at<T extends Tile>(list: readonly T[], tile: Tile): T | undefined {
  return list.find((entry) => entry.x === tile.x && entry.y === tile.y);
}

/** What a station hands back, with the cooked food named as cooked. */
function stationItemName(item: Item): string {
  if (item.kind === "hotdogs" || item.kind === "wings")
    return COOKED_NAMES[item.kind];
  return heldName(item);
}

/**
 * The prompt for an interact press that picks something up. It names the item
 * and the tile it comes from, so the player can see where it is taken.
 */
function takePrompt(state: GameState, tile: Tile): string | null {
  const supply = at(state.supplies, tile);
  const station = at(state.stations, tile);
  const floorItem = at(state.floor, tile);
  if (supply && state.stock[supply.kind] > 0)
    return `Take ${crateTakeName(supply.kind, state.stock[supply.kind])} from the ${CRATE_NAMES[supply.kind]} crate`;
  if (station?.item)
    return `Take ${stationItemName(station.item)} off ${STATION_NAMES[station.kind]}`;
  if (floorItem) return `Pick up ${heldLabel(floorItem.item)} off the floor`;
  return null;
}

/**
 * The prompt for an interact press that puts the held item down. It names the
 * tile the press will use, so the player can see where it lands.
 */
function placePrompt(state: GameState, tile: Tile, held: Item): string | null {
  const station = at(state.stations, tile);
  if (station) return `Put ${heldName(held)} on ${STATION_NAMES[station.kind]}`;
  const supply = at(state.supplies, tile);
  if (supply)
    return `Put ${heldName(held)} back in the ${CRATE_NAMES[supply.kind]} crate`;
  const target = at(state.targets, tile);
  if (target) {
    // A chair spot takes one chair per press, so the prompt counts the rest.
    const count = held.count ?? 1;
    if (held.kind === "chairs" && target.kind === "chair-spot" && count > 1)
      return `Place a chair (${count - 1} more in the stack)`;
    return `Place ${heldLabel(held)} at ${TARGET_NAMES[target.kind]}`;
  }
  // A floor drop is a hold, so its line comes from getPrompt, not here.
  return null;
}

/** Button prompts and a status line for one person. */
export function getPrompt(
  state: GameState,
  id: PlayerId,
  options: PromptOptions = {}
): Prompt {
  const player = state.players[id];
  const name = id === "fred" ? "Fred" : "Abbi";
  if (player.presence === "away") {
    const back =
      state.returnsAt === null
        ? ""
        : ` Back around ${clockLabel(state.returnsAt, state.duration)}.`;
    return {
      interact: null,
      floorDrop: null,
      work: null,
      status: `${name} is out with his brothers.${back}`,
    };
  }
  if (player.busyFor > 0) {
    const call = INTERRUPTIONS.find(
      (c) => c.player === id && c.text === player.busyReason
    );
    if (call) {
      // A phone call freezes the person; the prompt says how long is left,
      // in wall-clock minutes like the rest of the prompts. It rounds up, so
      // the minutes shown are never less than the time really left (round 12, task 3).
      const minutes = Math.max(
        1,
        Math.ceil(
          (player.busyFor * LEVEL_HOURS * 60) / state.duration - CLOCK_TOLERANCE
        )
      );
      return {
        interact: null,
        floorDrop: null,
        work: null,
        status: `${name} is on the phone (about ${minutes} min left): ${call.text}`,
      };
    }
    return {
      interact: null,
      floorDrop: null,
      work: null,
      status: `${name}: ${player.busyReason ?? "busy"}`,
    };
  }
  if (options.waiting && !state.setup.assist) {
    return {
      interact: null,
      floorDrop: null,
      work: null,
      status: swapStatus(id),
    };
  }
  const held = player.holding;
  const status = held
    ? `${name} is carrying ${heldLabel(held)}.`
    : `${name} has free hands.`;
  const faced = workTileFor(state, player);
  const station = at(state.stations, faced);
  const target = at(state.targets, faced);
  const tile = interactTile(state, id);

  let interact: string | null = null;
  let floorDrop: FloorDropPrompt | null = null;
  let work: string | null = null;
  if (tile && held && floorDropPress(state, player)) {
    floorDrop = {
      note: blockedStationFor(
        state,
        { x: Math.floor(player.x), y: Math.floor(player.y) },
        held
      ),
      action: `set ${heldName(held)} down on the floor here`,
    };
  } else if (tile) {
    interact = held ? placePrompt(state, tile, held) : takePrompt(state, tile);
  } else {
    interact = unpressedReason(state, player);
  }
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
      // Held work here drops the spot from the plan, so the prompt says so.
      const spot = target.kind === "aisle" ? "aisle spot" : "table";
      work = `leave this ${spot} bare (it stays out of the plan)`;
    }
  } else if (station?.kind === "bin") {
    work =
      held.kind === "chairs"
        ? `Put ${heldName(held)} back in the ${CRATE_NAMES.chairs} crate`
        : THROW_OUT_PROMPT;
  }
  return { interact, floorDrop, work, status };
}

/** Whether two tiles are the same tile. */
function sameTileAs(a: Tile, b: Tile): boolean {
  return a.x === b.x && a.y === b.y;
}

/**
 * The open spot a carried item goes on, nearest to the person: an open chair
 * spot for chairs and an open lantern hook for a lantern. Distance is measured
 * in tiles from the tile the person stands on, and a tie goes to the spot
 * listed first in the venue. Distance is straight-line (as the crow flies), not
 * the walk around the venue, so a spot behind a hedge can be nearest here. Null
 * when the person carries neither, or no such spot is open. Pure; the canvas
 * highlights the tile it returns.
 */
export function nextSpotTile(state: GameState, id: PlayerId): Tile | null {
  const player = state.players[id];
  const held = player.holding;
  if (!held) return null;
  const kind: TargetKind | null =
    held.kind === "chairs"
      ? "chair-spot"
      : held.kind === "lantern"
        ? "hook"
        : null;
  if (!kind) return null;
  const cx = Math.floor(player.x);
  const cy = Math.floor(player.y);
  let best: Target | null = null;
  let bestDistance = Infinity;
  for (const target of state.targets) {
    if (target.kind !== kind || target.status !== "open") continue;
    if (target.wants !== held.kind) continue;
    const distance = Math.abs(target.x - cx) + Math.abs(target.y - cy);
    if (distance < bestDistance) {
      best = target;
      bestDistance = distance;
    }
  }
  return best ? { x: best.x, y: best.y } : null;
}

/**
 * The tile a press would drop the carried item on, when that tile is plain
 * floor: nothing carried, a busy or away person, or a press that lands on a
 * station, crate or target gives null. The canvas draws a floor drop in its
 * own warning style, so the drop is clear before the press.
 */
export function floorDropTile(state: GameState, id: PlayerId): Tile | null {
  const player = state.players[id];
  if (!player.holding || player.presence === "away" || player.busyFor > 0)
    return null;
  const tile = interactTile(state, id);
  if (!tile) return null;
  const onStructure = [state.stations, state.supplies, state.targets].some(
    (list) => list.some((entry) => sameTileAs(entry, tile))
  );
  return onStructure ? null : tile;
}

const COOKED: Partial<Record<ItemKind, ItemKind>> = {
  "hotdogs-raw": "hotdogs",
  "wings-raw": "wings",
};

/**
 * One coach line, and the tile it points at when it points at one. A wait
 * step (`waiting`) points at a station that is still busy, so the outline is
 * drawn dashed.
 */
export interface CoachStep {
  readonly text: string;
  readonly tile: Tile | null;
  readonly waiting?: boolean;
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
    text: `Grab ${crateGrabName(kind, state.stock[kind])} from the ${CRATE_NAMES[kind]} crate ${where}.`,
    tile: crate ? { x: crate.x, y: crate.y } : null,
  };
}

/** The step for someone carrying an item bound for a target. */
function placeStep(state: GameState, held: Item): CoachStep | null {
  const target = openTarget(state, held.kind);
  return target
    ? {
        text: `Place ${heldName(held)} at ${TARGET_NAMES[target.kind]}.`,
        tile: { x: target.x, y: target.y },
      }
    : putDownStep(state, held);
}

/**
 * The step for someone carrying an item that no open place wants: put it on
 * the floor while the floor has room, or else back in its own crate. The
 * helper drops it in the same order (dropTiers in assist.ts).
 */
function putDownStep(state: GameState, held: Item): CoachStep | null {
  if (state.floor.length < FLOOR_CAP) {
    return {
      text: `Put ${heldName(held)} down somewhere out of the way.`,
      tile: null,
    };
  }
  const crate = state.supplies.find((s) => s.kind === held.kind);
  return crate
    ? {
        text: `Put ${heldName(held)} back in its crate.`,
        tile: { x: crate.x, y: crate.y },
      }
    : null;
}

/**
 * The step for someone carrying an item: a raw item goes to its station, a
 * made or cooked item goes to the target that wants it, and burnt food goes
 * to the bin. Null when nothing open wants the item.
 */
function carryStep(
  state: GameState,
  item: Item,
  key: string
): CoachStep | null {
  switch (item.kind) {
    case "roses": {
      const wantsArrange = openTarget(state, "arrangement") !== undefined;
      const wantsPetals = openTarget(state, "petals") !== undefined;
      if (!wantsArrange && !wantsPetals) return putDownStep(state, item);
      const kind = roseStation(state);
      if (kind)
        return {
          text: `Carry the roses to ${STATION_NAMES[kind]}.`,
          tile: freeTile(state, kind),
        };
      const busy: StationKind = wantsArrange ? "arrange" : "petals";
      return {
        text: `Wait for ${STATION_NAMES[busy]} to clear.`,
        tile: firstTile(state, busy),
        waiting: true,
      };
    }
    case "hotdogs-raw":
    case "wings-raw": {
      const cooked = COOKED[item.kind];
      if (!cooked || !openTarget(state, cooked))
        return putDownStep(state, item);
      const tile = freeTile(state, "grill");
      return tile
        ? {
            text: `Carry ${ITEM_NAMES[item.kind]} to ${STATION_NAMES.grill}.`,
            tile,
          }
        : {
            text: `Wait for ${STATION_NAMES.grill} to clear.`,
            tile: firstTile(state, "grill"),
            waiting: true,
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
      return placeStep(state, item);
    case "burnt":
      return {
        text: `Carry ${ITEM_NAMES.burnt} to ${STATION_NAMES.bin} and hold ${key} there to throw it out.`,
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
        waiting: true,
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
function fetchStep(
  state: GameState,
  lead: "roses" | "food",
  key: string
): CoachStep | null {
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
      text: `Stand at ${STATION_NAMES.arrange} and hold ${key} to arrange the roses.`,
      tile: { x: roseArrange.x, y: roseArrange.y },
    };
  }
  const rosePetals = stationsOf(state, "petals").find(
    (s) => s.item?.kind === "roses"
  );
  if (openTarget(state, "petals") && rosePetals) {
    return {
      text: `Stand at ${STATION_NAMES.petals} and hold ${key} to pluck petals.`,
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
  // The key the line names: co-op gives each person one, solo either set.
  const key = workKeyName(id, options.coop === true);
  if (player.holding) return carryStep(state, player.holding, key);
  // In co-op the second person starts on the food, so the two lines differ.
  const lead = options.coop && id === "abbi" ? "food" : "roses";
  return fetchStep(state, lead, key);
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
