/**
 * Builds a For Better or Bulk level from its setup: prices the cart, checks
 * it against the budget, and lays out the venue map with what the cart
 * bought. The plan is set by the cart: fewer roses means fewer targets, and
 * a bare table is part of the design rather than a gap.
 */

import {
  BUDGET,
  BUFFET_ORDER,
  CAPABILITIES,
  CAPABILITY_PICKS,
  CHAIR_STACKS,
  FIXED_COSTS,
  FOOD_BATCHES,
  FOOD_PRICES,
  LANTERN_COUNT,
  LANTERN_PRICE,
  LEVEL_SECONDS,
  RELAXED_LEVEL_SECONDS,
  ROSE_BUNCHES,
  ROSE_PRICES,
  SUPPLY_TILES,
  VENUE_MAP,
} from "../presets";
import type {
  Cart,
  CapabilityId,
  Category,
  GameState,
  ItemKind,
  Player,
  PlayerId,
  Setup,
  Station,
  StationKind,
  Supply,
  SupplyKind,
  Target,
  TargetKind,
  Validation,
} from "../types";

/** The game price of a cart, fixed costs included. */
export function cartTotal(cart: Cart): number {
  const fixed = FIXED_COSTS.reduce((sum, line) => sum + line.dollars, 0);
  return (
    fixed +
    ROSE_PRICES[cart.roses] +
    FOOD_PRICES[cart.food] +
    (cart.lanterns ? LANTERN_PRICE : 0)
  );
}

/** Whether a setup is allowed: two different features and a cart in budget. */
export function validateSetup(setup: Setup): Validation {
  const ids = Object.keys(CAPABILITIES) as CapabilityId[];
  const picks = new Set(setup.capabilities);
  if (
    setup.capabilities.length !== CAPABILITY_PICKS ||
    picks.size !== CAPABILITY_PICKS
  ) {
    return {
      ok: false,
      reason: `Pick exactly ${CAPABILITY_PICKS} different website features.`,
    };
  }
  if (setup.capabilities.some((id) => !ids.includes(id))) {
    return { ok: false, reason: "There is no such website feature." };
  }
  if (!(setup.cart.roses in ROSE_PRICES))
    return { ok: false, reason: "There is no such rose tier." };
  if (!(setup.cart.food in FOOD_PRICES))
    return { ok: false, reason: "There is no such food tier." };
  const total = cartTotal(setup.cart);
  if (total > BUDGET) {
    return {
      ok: false,
      reason: `That comes to $${total}, over the $${BUDGET} budget.`,
    };
  }
  return { ok: true };
}

const STATION_TILES: Readonly<Record<string, StationKind>> = {
  A: "arrange",
  P: "petals",
  G: "grill",
  X: "bin",
};

interface TargetSpec {
  readonly kind: TargetKind;
  readonly category: Category;
  readonly capacity: number;
  readonly planned: (cart: Cart) => boolean;
}

const TARGET_TILES: Readonly<Record<string, TargetSpec>> = {
  K: { kind: "basket", category: "bouquets", capacity: 2, planned: () => true },
  T: {
    kind: "table",
    category: "centerpieces",
    capacity: 1,
    planned: (cart) => cart.roses !== "modest",
  },
  S: {
    kind: "aisle",
    category: "petals",
    capacity: 1,
    planned: (cart) => cart.roses === "yes",
  },
  O: {
    kind: "chair-spot",
    category: "chairs",
    capacity: 1,
    planned: () => true,
  },
  N: {
    kind: "hook",
    category: "lanterns",
    capacity: 1,
    planned: (cart) => cart.lanterns,
  },
  B: { kind: "buffet", category: "buffet", capacity: 1, planned: () => true },
};

const TARGET_WANTS: Readonly<Record<Exclude<TargetKind, "buffet">, ItemKind>> =
  {
    basket: "arrangement",
    table: "arrangement",
    aisle: "petals",
    "chair-spot": "chairs",
    hook: "lantern",
  };

function spawn(id: PlayerId, x: number, y: number): Player {
  return {
    id,
    x: x + 0.5,
    y: y + 0.5,
    facingX: 0,
    facingY: -1,
    holding: null,
    presence: "here",
    busyFor: 0,
    busyReason: null,
    calm: false,
    binHold: 0,
  };
}

/** The starting stock for a cart. */
export function stockFor(cart: Cart): Record<SupplyKind, number> {
  const batches = FOOD_BATCHES[cart.food];
  return {
    roses: ROSE_BUNCHES[cart.roses],
    "hotdogs-raw": batches,
    "wings-raw": batches,
    mac: batches,
    quinoa: batches,
    lantern: cart.lanterns ? LANTERN_COUNT : 0,
    chairs: CHAIR_STACKS,
  };
}

/**
 * A fresh level at 9:00. Throws a RangeError for a setup `validateSetup`
 * rejects, so a bad shared link fails loudly instead of playing a different
 * game.
 */
export function createLevel(setup: Setup): GameState {
  const check = validateSetup(setup);
  if (!check.ok) throw new RangeError(check.reason);
  const supplies: Supply[] = [];
  const stations: Station[] = [];
  const targets: Target[] = [];
  const players: Partial<Record<PlayerId, Player>> = {};
  let buffetIndex = 0;
  VENUE_MAP.forEach((row, y) => {
    [...row].forEach((char, x) => {
      const id = `${char}${x}-${y}`;
      if (char === "1") players.fred = spawn("fred", x, y);
      if (char === "2") players.abbi = spawn("abbi", x, y);
      const supply = SUPPLY_TILES[char];
      if (supply) supplies.push({ id, kind: supply, x, y });
      const station = STATION_TILES[char];
      if (station)
        stations.push({ id, kind: station, x, y, item: null, progress: 0 });
      const spec = TARGET_TILES[char];
      if (spec) {
        const wants =
          spec.kind === "buffet"
            ? BUFFET_ORDER[buffetIndex++]
            : TARGET_WANTS[spec.kind];
        targets.push({
          id,
          kind: spec.kind,
          category: spec.category,
          wants,
          capacity: spec.capacity,
          filled: [],
          filledBy: [],
          status: spec.planned(setup.cart) ? "open" : "unplanned",
          simplifyProgress: 0,
          x,
          y,
        });
      }
    });
  });
  if (!players.fred || !players.abbi)
    throw new RangeError("The venue map has no spawn points.");
  return {
    setup,
    phase: "playing",
    time: 0,
    duration: setup.relaxed ? RELAXED_LEVEL_SECONDS : LEVEL_SECONDS,
    tick: 0,
    players: { fred: players.fred, abbi: players.abbi },
    supplies,
    stock: stockFor(setup.cart),
    stations,
    targets,
    floor: [],
    interruptions: [],
    presence: null,
    returnsAt: null,
    brothersAt: null,
    firstFilledAt: null,
    burntBatches: 0,
    finishedAt: null,
  };
}
