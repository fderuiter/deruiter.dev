/**
 * The shared gates for where items go (ADR 0060). `getHint` names the next
 * step from these rules, and the solo assist walks to the same places, so the
 * two cannot drift: roses go to one station, and an item is only fetched when
 * an open place can take it now.
 *
 * This module imports only types, so both the views and the assist can use it.
 */

import type {
  GameState,
  ItemKind,
  Station,
  StationKind,
  Target,
} from "../types";

/** Tiles a dropped item can rest on: walkable ground, not a target spot. */
export const FLOOR_TILES = ".12";

/** Every station of one kind, free or busy. */
export function stationsOf(state: GameState, kind: StationKind): Station[] {
  return state.stations.filter((s) => s.kind === kind);
}

/** Whether a station of this kind is empty right now. */
export function freeStation(state: GameState, kind: StationKind): boolean {
  return stationsOf(state, kind).some((s) => s.item === null);
}

/** The first open target that wants this item, if any. */
export function openTarget(
  state: GameState,
  wants: ItemKind
): Target | undefined {
  return state.targets.find((t) => t.status === "open" && t.wants === wants);
}

/**
 * Where roses should go now: ARRANGE when an arrangement is still wanted, or
 * PETALS when the aisle is planned and open, whichever has a free station.
 * Null when neither wants roses or both are busy.
 */
export function roseStation(state: GameState): StationKind | null {
  if (openTarget(state, "arrangement") && freeStation(state, "arrange"))
    return "arrange";
  if (openTarget(state, "petals") && freeStation(state, "petals"))
    return "petals";
  return null;
}

/**
 * Whether an open place still wants this item at all. Burnt food always
 * wants the bin. Raw food is wanted when its cooked form is.
 */
export function wantsItem(state: GameState, kind: ItemKind): boolean {
  switch (kind) {
    case "roses":
      return (
        openTarget(state, "arrangement") !== undefined ||
        openTarget(state, "petals") !== undefined
      );
    case "burnt":
      return true;
    case "hotdogs-raw":
      return openTarget(state, "hotdogs") !== undefined;
    case "wings-raw":
      return openTarget(state, "wings") !== undefined;
    default:
      return openTarget(state, kind) !== undefined;
  }
}

/**
 * Whether this item has somewhere to go right now, so it is worth fetching:
 * roses need a free rose station, raw food needs a free grill, and everything
 * else needs only that it is wanted.
 */
export function usable(state: GameState, kind: ItemKind): boolean {
  switch (kind) {
    case "roses":
      return roseStation(state) !== null;
    case "hotdogs-raw":
    case "wings-raw":
      return wantsItem(state, kind) && freeStation(state, "grill");
    default:
      return wantsItem(state, kind);
  }
}
