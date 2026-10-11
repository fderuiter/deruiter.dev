/**
 * Phrases for the places and things a hint or the helper's status names. They
 * live apart from the views so the solo assist can use them without importing
 * the views, which import the simulation that imports the assist.
 *
 * This module imports only types and presets.
 */

import type { ItemKind, StationKind, SupplyKind, TargetKind } from "../types";

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
  chairs: "the stack of chairs",
};

/** What a crate hands out, as the object of "Grab ...". */
export const CRATE_ITEM_NAMES: Readonly<Record<SupplyKind, string>> = {
  roses: "roses",
  "hotdogs-raw": "raw hot dogs",
  "wings-raw": "raw wings",
  mac: "mac and cheese",
  quinoa: "quinoa salad",
  lantern: "a lantern",
  chairs: "a stack of chairs",
};
