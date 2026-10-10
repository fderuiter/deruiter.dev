/**
 * The headless booth-shift engine for Patty's Drive-Thru (ADR 0059).
 *
 * Every function is pure: it takes a shift state and returns a new one plus
 * the one-shot events it produced, and never mutates its input. Randomness
 * comes from the counter-based PRNG, so a seed and a list of actions always
 * replay to the same shift. Invalid input (an unknown order, a negative or
 * non-finite step, a tap on a node that is not on screen) returns the same
 * state object and no events.
 */

import { clamp } from "../../game-utils";
import { drawInt, uniformAt } from "../../utils/prng";
import {
  AGE_LOCKED_ITEMS,
  ARRIVAL_GAP_MAX_SEC,
  ARRIVAL_GAP_MIN_SEC,
  BREAK_ADJUSTMENT_CENTS,
  COWORKER_DELAY_SEC,
  DEFAULT_SHIFT_CONFIG,
  DIGNITY_LOSS_LOCKED,
  DIGNITY_LOSS_WRONG_ENTRY,
  DIGNITY_LOSS_YELL,
  DISPENSER_FAIL_CHANCE,
  DISPENSER_ITEMS,
  EXPIRE_AFTER_SEC,
  FIRST_ARRIVAL_SEC,
  IDLE_AFTER_YELL,
  IDLE_GRACE_SEC,
  IDLE_RATE_PER_SEC,
  IDLE_RELIEF_ON_ACTION,
  IDLE_RELIEF_ON_WIPE,
  MAX_ITEMS_PER_ORDER,
  MAX_OPEN_ORDERS,
  MAX_STEP_SEC,
  METER_START,
  NO_PICKLES_CHANCE,
  ORDERABLE_ITEMS,
  POS_MENU,
  RED_AFTER_SEC,
  SCENARIO_LIMITS,
  SHIFT_PAID_MINUTES,
  SOS_GAIN_FAST,
  SOS_GAIN_ON_TIME,
  SOS_LOSS_EXPIRED,
  SOS_LOSS_LATE,
  TILL_SHORT_PER_EXPIRED_CENTS,
  UNIFORM_DEDUCTION_CENTS,
  WAGE_CENTS_PER_HOUR,
  WIPE_COOLDOWN_SEC,
  YELLOW_AFTER_SEC,
} from "../presets";
import type {
  KdsBand,
  Meters,
  Order,
  OrderItem,
  PayStub,
  PosNode,
  ShiftAction,
  ShiftConfig,
  ShiftEvent,
  ShiftScenario,
  ShiftOutcome,
  ShiftState,
  StepResult,
} from "../types";

const MIN_DURATION_SEC = 10;
const MAX_DURATION_SEC = 3600;

function clampMeter(value: number): number {
  return clamp(value, 0, 100);
}

function unchanged(state: ShiftState): StepResult {
  return { state, events: [] };
}

/**
 * The scenario dials a config sets, each held to its range in
 * `SCENARIO_LIMITS`. A dial that is missing or not a finite number is left
 * out, so the standard value applies, and an arrival range that ends before
 * it starts is shortened to a single gap.
 */
function scenarioDials(config: Partial<ShiftConfig>): ShiftScenario {
  const dials: { -readonly [K in keyof ShiftScenario]: number } = {};
  for (const key of Object.keys(SCENARIO_LIMITS) as Array<
    keyof ShiftScenario
  >) {
    const value = config[key];
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    const [min, max] = SCENARIO_LIMITS[key];
    dials[key] = clamp(value, min, max);
  }
  const lowest = dials.arrivalGapMinSec ?? ARRIVAL_GAP_MIN_SEC;
  if ((dials.arrivalGapMaxSec ?? ARRIVAL_GAP_MAX_SEC) < lowest)
    dials.arrivalGapMaxSec = lowest;
  return dials;
}

/**
 * Starts a shift. A missing, empty or non-string seed falls back to the
 * default, and a duration that is not a finite number is replaced by the
 * default and then held between 10 seconds and one hour. Scenario dials are
 * clamped to their ranges.
 */
export function createShift(config: Partial<ShiftConfig> = {}): ShiftState {
  const seed =
    typeof config.seed === "string" && config.seed.length > 0
      ? config.seed
      : DEFAULT_SHIFT_CONFIG.seed;
  const rawDuration =
    typeof config.durationSec === "number" &&
    Number.isFinite(config.durationSec)
      ? config.durationSec
      : DEFAULT_SHIFT_CONFIG.durationSec;
  const durationSec = clamp(rawDuration, MIN_DURATION_SEC, MAX_DURATION_SEC);

  return {
    config: { seed, durationSec, ...scenarioDials(config) },
    time: 0,
    outcome: "playing",
    meters: { ...METER_START },
    orders: [],
    pos: { path: [], activeOrderId: null, taps: 0 },
    tallies: {
      served: 0,
      late: 0,
      expired: 0,
      lockedAttempts: 0,
      wrongEntries: 0,
      drinksDropped: 0,
      yells: 0,
    },
    lastActionAt: 0,
    wipeReadyAt: 0,
    nextOrderId: 1,
    nextArrivalAt: scenarioDials(config).firstArrivalSec ?? FIRST_ARRIVAL_SEC,
    draws: 0,
  };
}

/** The kitchen-display colour for an order of this age in seconds. */
export function getKdsBand(ageSec: number): KdsBand {
  if (!(ageSec > YELLOW_AFTER_SEC)) return "green";
  if (ageSec > RED_AFTER_SEC) return "red";
  return "yellow";
}

/** Seconds since the order arrived, never negative. */
export function getOrderAge(
  state: Pick<ShiftState, "time">,
  order: Order
): number {
  return Math.max(0, state.time - order.arrivedAt);
}

/** True when every item is rung, every modifier entered and no drink dropped. */
export function isOrderReady(order: Order): boolean {
  return order.items.every(
    (item) => item.rung && item.modifierDone && !item.dropped
  );
}

/** True when the item needs someone 18 or older to make it. */
export function isAgeLocked(itemId: OrderItem["itemId"]): boolean {
  return AGE_LOCKED_ITEMS.includes(itemId);
}

/**
 * The POS screen the player is looking at. A path that no longer matches the
 * menu falls back to the home screen.
 */
export function getPosScreen(state: Pick<ShiftState, "pos">): PosNode {
  let node: PosNode = POS_MENU;
  for (const id of state.pos.path) {
    const next = node.children?.find((child) => child.id === id);
    if (!next || !next.children) return POS_MENU;
    node = next;
  }
  return node;
}

/** True once the shift has ended, however it ended. */
export function isShiftOver(state: ShiftState): boolean {
  return state.outcome !== "playing";
}

/**
 * The pay stub for the time worked so far. Pay is prorated from a four-hour
 * shift; the uniform and the untaken break come out regardless, and every
 * expired order is a till shortage.
 */
export function computePayStub(state: ShiftState): PayStub {
  const fraction =
    state.config.durationSec > 0
      ? clamp(state.time / state.config.durationSec, 0, 1)
      : 0;
  const paidMinutes = Math.round(SHIFT_PAID_MINUTES * fraction);
  const grossCents = Math.round((WAGE_CENTS_PER_HOUR * paidMinutes) / 60);
  const tillShortCents = state.tallies.expired * TILL_SHORT_PER_EXPIRED_CENTS;
  const netCents = Math.max(
    0,
    grossCents -
      UNIFORM_DEDUCTION_CENTS -
      BREAK_ADJUSTMENT_CENTS -
      tillShortCents
  );
  return {
    paidMinutes,
    grossCents,
    uniformCents: UNIFORM_DEDUCTION_CENTS,
    breakAdjustmentCents: BREAK_ADJUSTMENT_CENTS,
    tillShortCents,
    netCents,
  };
}

/** Draws a fresh order at `arrivedAt`, consuming draws from `draws` onward. */
function drawOrder(
  seed: string,
  draws: number,
  id: number,
  arrivedAt: number
): { order: Order; draws: number } {
  let cursor = draws;
  const count = 1 + drawInt(seed, cursor++, MAX_ITEMS_PER_ORDER);
  const items: OrderItem[] = [];
  for (let i = 0; i < count; i += 1) {
    const itemId =
      ORDERABLE_ITEMS[drawInt(seed, cursor++, ORDERABLE_ITEMS.length)];
    const isBurger = itemId === "burger" || itemId === "cheeseburger";
    const modifier =
      isBurger && uniformAt(seed, cursor++) < NO_PICKLES_CHANCE
        ? "no-pickles"
        : null;
    items.push({
      itemId,
      modifier,
      rung: false,
      modifierDone: modifier === null,
      dropped: false,
    });
  }
  return {
    order: { id, arrivedAt, items, coworkerReadyAt: null },
    draws: cursor,
  };
}

function endIfOver(state: ShiftState, events: ShiftEvent[]): ShiftState {
  let outcome: ShiftOutcome = "playing";
  if (state.meters.sos <= 0) outcome = "docked";
  else if (state.meters.dignity <= 0) outcome = "breakdown";
  else if (state.time >= state.config.durationSec) outcome = "completed";
  if (outcome === "playing") return state;
  events.push({ type: "shift-ended", outcome });
  return { ...state, outcome };
}

/**
 * Advances the shift by `dtSec` seconds: new orders arrive, old ones expire,
 * a flagged coworker finishes the coffee, and an idle player gets yelled at.
 * Steps longer than half a second are shortened, so a stalled tab cannot skip
 * the shift.
 */
export function stepShift(state: ShiftState, dtSec: number): StepResult {
  if (isShiftOver(state) || !Number.isFinite(dtSec) || dtSec <= 0) {
    return unchanged(state);
  }
  const {
    seed,
    durationSec,
    arrivalGapMinSec: gapMin = ARRIVAL_GAP_MIN_SEC,
    arrivalGapMaxSec: gapMax = ARRIVAL_GAP_MAX_SEC,
    sosLossExpired = SOS_LOSS_EXPIRED,
    idleGraceSec = IDLE_GRACE_SEC,
    idleRatePerSec = IDLE_RATE_PER_SEC,
  } = state.config;
  const start = state.time;
  const time = Math.min(durationSec, start + clamp(dtSec, 0, MAX_STEP_SEC));
  const events: ShiftEvent[] = [];

  let orders = state.orders;
  let { draws, nextOrderId, nextArrivalAt } = state;
  let meters: Meters = state.meters;
  let tallies = state.tallies;
  let activeOrderId = state.pos.activeOrderId;

  while (nextArrivalAt <= time) {
    if (orders.length < MAX_OPEN_ORDERS) {
      const drawn = drawOrder(seed, draws, nextOrderId, nextArrivalAt);
      draws = drawn.draws;
      orders = [...orders, drawn.order];
      events.push({ type: "order-arrived", orderId: nextOrderId });
      nextOrderId += 1;
    }
    const gap = gapMin + uniformAt(seed, draws++) * (gapMax - gapMin);
    nextArrivalAt += gap;
  }

  for (const order of orders) {
    const ready = order.coworkerReadyAt;
    if (ready !== null && ready > start && ready <= time) {
      events.push({ type: "coworker-ready", orderId: order.id });
    }
  }

  const expired = orders.filter((o) => time - o.arrivedAt >= EXPIRE_AFTER_SEC);
  if (expired.length > 0) {
    orders = orders.filter((o) => time - o.arrivedAt < EXPIRE_AFTER_SEC);
    meters = {
      ...meters,
      sos: clampMeter(meters.sos - sosLossExpired * expired.length),
    };
    tallies = { ...tallies, expired: tallies.expired + expired.length };
    for (const order of expired) {
      events.push({ type: "order-expired", orderId: order.id });
      if (order.id === activeOrderId) activeOrderId = null;
    }
  }

  const idleFrom = Math.max(start, state.lastActionAt + idleGraceSec);
  const idleSeconds = Math.max(0, time - idleFrom);
  if (idleSeconds > 0) {
    meters = {
      ...meters,
      idle: clampMeter(meters.idle + idleSeconds * idleRatePerSec),
    };
    if (meters.idle >= 100) {
      meters = {
        ...meters,
        idle: IDLE_AFTER_YELL,
        dignity: clampMeter(meters.dignity - DIGNITY_LOSS_YELL),
      };
      tallies = { ...tallies, yells: tallies.yells + 1 };
      events.push({ type: "manager-yell" });
    }
  }

  const pos =
    activeOrderId === state.pos.activeOrderId
      ? state.pos
      : { ...state.pos, activeOrderId };

  const next = endIfOver(
    {
      ...state,
      time,
      orders,
      draws,
      nextOrderId,
      nextArrivalAt,
      meters,
      tallies,
      pos,
    },
    events
  );
  return { state: next, events };
}

/** Records that the player did something, which calms the idle meter. */
function acted(state: ShiftState, relief = IDLE_RELIEF_ON_ACTION): ShiftState {
  return {
    ...state,
    lastActionAt: state.time,
    meters: { ...state.meters, idle: clampMeter(state.meters.idle - relief) },
  };
}

function replaceOrder(state: ShiftState, order: Order): ShiftState {
  return {
    ...state,
    orders: state.orders.map((o) => (o.id === order.id ? order : o)),
  };
}

function replaceItem(order: Order, index: number, item: OrderItem): Order {
  return {
    ...order,
    items: order.items.map((it, i) => (i === index ? item : it)),
  };
}

function wrongEntry(
  state: ShiftState,
  nodeId: string,
  events: ShiftEvent[]
): ShiftState {
  events.push({ type: "wrong-entry", nodeId });
  return {
    ...state,
    meters: {
      ...state.meters,
      dignity: clampMeter(state.meters.dignity - DIGNITY_LOSS_WRONG_ENTRY),
    },
    tallies: { ...state.tallies, wrongEntries: state.tallies.wrongEntries + 1 },
  };
}

function backHome(state: ShiftState): ShiftState {
  return { ...state, pos: { ...state.pos, path: [], taps: 0 } };
}

/** Rings up a leaf the player tapped on the POS for the active order. */
function ringLeaf(
  state: ShiftState,
  leaf: PosNode,
  events: ShiftEvent[]
): ShiftState {
  const order = state.orders.find((o) => o.id === state.pos.activeOrderId);
  if (!order) return backHome(wrongEntry(state, leaf.id, events));

  if (leaf.modifierId) {
    const index = order.items.findIndex(
      (it) => it.modifier === leaf.modifierId && it.rung && !it.modifierDone
    );
    if (index < 0) return backHome(wrongEntry(state, leaf.id, events));
    const item = { ...order.items[index], modifierDone: true };
    return backHome(replaceOrder(state, replaceItem(order, index, item)));
  }

  const index = order.items.findIndex(
    (it) => it.itemId === leaf.itemId && !it.rung
  );
  if (index < 0) return backHome(wrongEntry(state, leaf.id, events));
  const item = order.items[index];

  if (isAgeLocked(item.itemId)) {
    const ready = order.coworkerReadyAt;
    if (ready === null || state.time < ready) {
      events.push({ type: "locked", orderId: order.id });
      return {
        ...state,
        meters: {
          ...state.meters,
          dignity: clampMeter(state.meters.dignity - DIGNITY_LOSS_LOCKED),
        },
        tallies: {
          ...state.tallies,
          lockedAttempts: state.tallies.lockedAttempts + 1,
        },
      };
    }
  }

  let draws = state.draws;
  let dropped = false;
  if (DISPENSER_ITEMS.includes(item.itemId)) {
    dropped =
      uniformAt(state.config.seed, draws++) <
      (state.config.dispenserFailChance ?? DISPENSER_FAIL_CHANCE);
  }
  events.push({ type: "item-rung", orderId: order.id, itemId: item.itemId });
  let next = replaceOrder(
    { ...state, draws },
    replaceItem(order, index, { ...item, rung: true, dropped })
  );
  if (dropped) {
    events.push({ type: "drink-dropped", orderId: order.id });
    next = {
      ...next,
      tallies: {
        ...next.tallies,
        drinksDropped: next.tallies.drinksDropped + 1,
      },
    };
  }
  return backHome(next);
}

function applyPosTap(
  state: ShiftState,
  nodeId: unknown,
  events: ShiftEvent[]
): ShiftState {
  if (typeof nodeId !== "string") return state;
  const screen = getPosScreen(state);
  const node = screen.children?.find((child) => child.id === nodeId);
  if (!node) return state;
  const tapped = acted({
    ...state,
    pos: { ...state.pos, taps: state.pos.taps + 1 },
  });
  if (node.children) {
    const path = screen === POS_MENU ? [node.id] : [...state.pos.path, node.id];
    return { ...tapped, pos: { ...tapped.pos, path } };
  }
  return ringLeaf(tapped, node, events);
}

function applyBump(
  state: ShiftState,
  order: Order,
  events: ShiftEvent[]
): ShiftState {
  if (!isOrderReady(order)) {
    return wrongEntry(acted(state), "bump", events);
  }
  const band = getKdsBand(getOrderAge(state, order));
  const delta =
    band === "green"
      ? (state.config.sosGainFast ?? SOS_GAIN_FAST)
      : band === "yellow"
        ? (state.config.sosGainOnTime ?? SOS_GAIN_ON_TIME)
        : -(state.config.sosLossLate ?? SOS_LOSS_LATE);
  events.push({ type: "bumped", orderId: order.id, band });
  const base = acted(state);
  return {
    ...base,
    orders: base.orders.filter((o) => o.id !== order.id),
    meters: { ...base.meters, sos: clampMeter(base.meters.sos + delta) },
    tallies: {
      ...base.tallies,
      served: base.tallies.served + 1,
      late: base.tallies.late + (band === "red" ? 1 : 0),
    },
    pos:
      base.pos.activeOrderId === order.id
        ? { ...base.pos, activeOrderId: null }
        : base.pos,
  };
}

function findOrder(state: ShiftState, orderId: unknown): Order | undefined {
  return typeof orderId === "number"
    ? state.orders.find((o) => o.id === orderId)
    : undefined;
}

/**
 * Applies one player action at the current shift time. Actions that do not
 * fit the current state (an order that is gone, a node that is not on screen,
 * a wipe still cooling down) change nothing; mistakes the player could really
 * make (a wrong ring-up, bumping an unfinished order, pressing a button they
 * are too young to press) cost dignity.
 */
export function applyAction(
  state: ShiftState,
  action: ShiftAction
): StepResult {
  if (isShiftOver(state) || !action || typeof action !== "object") {
    return unchanged(state);
  }
  const events: ShiftEvent[] = [];
  let next: ShiftState = state;

  switch (action.type) {
    case "selectOrder": {
      const order = findOrder(state, action.orderId);
      if (!order || state.pos.activeOrderId === order.id) break;
      next = acted({
        ...state,
        pos: { ...state.pos, activeOrderId: order.id },
      });
      break;
    }
    case "posTap":
      next = applyPosTap(state, action.nodeId, events);
      break;
    case "posBack":
      if (state.pos.path.length === 0) break;
      next = acted({
        ...state,
        pos: { ...state.pos, path: state.pos.path.slice(0, -1) },
      });
      break;
    case "posHome":
      if (state.pos.path.length === 0) break;
      next = acted(backHome(state));
      break;
    case "reenterDrink": {
      const order = findOrder(state, action.orderId);
      const index = order ? order.items.findIndex((it) => it.dropped) : -1;
      if (!order || index < 0) break;
      events.push({ type: "drink-reentered", orderId: order.id });
      next = acted(
        replaceOrder(
          state,
          replaceItem(order, index, { ...order.items[index], dropped: false })
        )
      );
      break;
    }
    case "flagCoworker": {
      const order = findOrder(state, action.orderId);
      const needsHelp =
        order?.coworkerReadyAt === null &&
        order.items.some((it) => isAgeLocked(it.itemId) && !it.rung);
      if (!order || !needsHelp) break;
      next = acted(
        replaceOrder(state, {
          ...order,
          coworkerReadyAt: state.time + COWORKER_DELAY_SEC,
        })
      );
      break;
    }
    case "bump": {
      const order = findOrder(state, action.orderId);
      if (!order) break;
      next = applyBump(state, order, events);
      break;
    }
    case "wipe":
      if (state.time < state.wipeReadyAt) break;
      events.push({ type: "wiped" });
      next = {
        ...acted(state, IDLE_RELIEF_ON_WIPE),
        wipeReadyAt: state.time + WIPE_COOLDOWN_SEC,
      };
      break;
    default:
      break;
  }

  if (next === state) return unchanged(state);
  return { state: endIfOver(next, events), events };
}

/**
 * Replays a shift from its config: the actions are applied in order, each
 * after stepping the clock to its time. Useful for tests, saved runs and the
 * diary log.
 */
export function replayShift(
  config: Partial<ShiftConfig>,
  timeline: readonly { readonly at: number; readonly action: ShiftAction }[]
): ShiftState {
  let state = createShift(config);
  for (const entry of timeline) {
    while (!isShiftOver(state) && state.time < entry.at) {
      const before = state.time;
      state = stepShift(state, entry.at - state.time).state;
      if (state.time === before) break;
    }
    state = applyAction(state, entry.action).state;
  }
  return state;
}
