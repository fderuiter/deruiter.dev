/**
 * Phrases for the places and things a hint or the helper's status names. They
 * live apart from the views so the solo assist can use them without importing
 * the views, which import the simulation that imports the assist.
 *
 * This module imports only types and presets.
 */

import { CHAIRS_PER_CARRY, ITEM_LABELS } from "../presets";
import type {
  Item,
  ItemKind,
  StationKind,
  SupplyKind,
  TargetKind,
} from "../types";

/** Words for the places and things a hint names, with their venue letters. */
export const STATION_NAMES: Readonly<Record<StationKind, string>> = {
  arrange: "the ARRANGE table (A)",
  petals: "the PETALS bucket (P)",
  grill: "the GRILL (G)",
  bin: "the BIN (X)",
};

export const TARGET_NAMES: Readonly<Record<TargetKind, string>> = {
  basket: "the bouquet basket (K)",
  table: "a centerpiece table (T)",
  aisle: "an aisle spot (S)",
  "chair-spot": "a chair spot (O)",
  hook: "a lantern hook (N)",
  buffet: "the buffet (B)",
};

/**
 * The spot a target is, in a refusal such as "This table needs ...". Buffet
 * slots are named by the food they take instead, so they are not listed here.
 */
export const SPOT_NAMES: Readonly<
  Record<Exclude<TargetKind, "buffet">, string>
> = {
  basket: "bouquet basket",
  table: "table",
  aisle: "aisle spot",
  "chair-spot": "chair spot",
  hook: "lantern hook",
};

/** Items in the middle of a sentence, such as "Carry the roses to...". */
export const ITEM_NAMES: Readonly<Record<ItemKind, string>> = {
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
  chairs: "the chairs",
};

/** Cooked food as it comes off the grill, for "Take the cooked wings off ...". */
export const COOKED_NAMES: Readonly<Record<"hotdogs" | "wings", string>> = {
  hotdogs: "the cooked hot dogs",
  wings: "the cooked wings",
};

/** What a crate hands out, as the object of "Grab ...". */
export const CRATE_ITEM_NAMES: Readonly<Record<SupplyKind, string>> = {
  roses: "roses",
  "hotdogs-raw": "raw hot dogs",
  "wings-raw": "raw wings",
  mac: "mac and cheese",
  quinoa: "quinoa salad",
  lantern: "a lantern",
  chairs: "a stack of 2 chairs",
};

/** "a stack of 2 chairs" for a carry of two, "a chair" for one. */
export function chairPhrase(count: number): string {
  return count >= 2 ? `a stack of ${count} chairs` : "a chair";
}

/** A carried item in the middle of a sentence: "the roses", "a stack of 2 chairs". */
export function heldName(item: Item): string {
  return item.kind === "chairs"
    ? chairPhrase(item.count ?? 1)
    : ITEM_NAMES[item.kind];
}

/** A carried item as a status label: "a bunch of Kirkland roses", "a chair". */
export function heldLabel(item: Item): string {
  return item.kind === "chairs"
    ? chairPhrase(item.count ?? 1)
    : ITEM_LABELS[item.kind];
}

/**
 * What one take from a crate picks up, as the object of "Grab ..." (no
 * article for roses): a crate with fewer than two chairs left gives one.
 */
export function crateGrabName(kind: SupplyKind, stock: number): string {
  return kind === "chairs"
    ? chairPhrase(Math.min(CHAIRS_PER_CARRY, stock))
    : CRATE_ITEM_NAMES[kind];
}

/** What one take from a crate picks up, with its article: "the roses", "a stack of 2 chairs". */
export function crateTakeName(kind: SupplyKind, stock: number): string {
  return kind === "chairs"
    ? chairPhrase(Math.min(CHAIRS_PER_CARRY, stock))
    : ITEM_NAMES[kind];
}
