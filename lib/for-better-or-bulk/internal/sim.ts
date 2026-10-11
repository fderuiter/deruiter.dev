/**
 * The fixed-step simulation for For Better or Bulk (ADR 0060).
 *
 * `stepGame` advances one tick of `TICK_SECONDS` from a frame of inputs and
 * returns a new state plus the events it produced; it never mutates its input
 * and has no randomness, so a setup and its frames always replay to the same
 * level. People interact with the tile directly in front of them, the way a
 * kitchen game does: crates hand out stock, stations transform what is put on
 * them, and targets in the venue take the item they want.
 */

import {
  ARRANGE_SECONDS,
  BREAK_SECONDS,
  BIN_HOLD_SECONDS,
  BROTHERS_EARLIEST_AT,
  BROTHERS_LATEST_AT,
  BURN_SECONDS,
  CALM_SPEED_MULTIPLIER,
  CHAIRS_PER_CARRY,
  COOK_SECONDS,
  FLOOR_CAP,
  INTERRUPTIONS,
  LEAVE_SECONDS,
  MOVE_SPEED,
  onLevelClock,
  PETAL_SECONDS,
  PHONE_SECONDS,
  PATIO_ROWS,
  PLAYER_RADIUS,
  RUSH_BURN_FACTOR,
  SHOE_INTERVAL_SECONDS,
  SHOE_SECONDS,
  SHOWER_WALK_FACTOR,
  SIMPLIFY_SECONDS,
  TICK_SECONDS,
} from "../presets";
import type {
  Commitment,
  Frame,
  GameEvent,
  GameState,
  Item,
  ItemKind,
  Player,
  PlayerId,
  PlayerInput,
  PresenceDecision,
  SeededEventId,
  Setup,
  Station,
  StepResult,
  SupplyKind,
  Target,
  Validation,
} from "../types";
import { clamp } from "@/lib/game-utils";
import { createLevel } from "./level";
import { assistInput, assistRests, helperMayAct } from "./assist";
import { FLOOR_TILES } from "./gates";
import {
  GRILL_COOKS,
  RAW_FOR_COOKED,
  frontTile,
  interactTile,
  isWalkable,
  stationAccepts,
  tileAt,
} from "./press";

export { frontTile, interactTile };

const PLAYER_IDS: readonly PlayerId[] = ["fred", "abbi"];
const COMMITMENTS: readonly Commitment[] = [
  "chairs",
  "lanterns",
  "buffet",
  "flowers",
];
const SIMPLIFIABLE = new Set(["centerpieces", "petals"]);
const CRAFTS: Readonly<
  Record<"arrange" | "petals", { output: ItemKind; seconds: number }>
> = {
  arrange: { output: "arrangement", seconds: ARRANGE_SECONDS },
  petals: { output: "petals", seconds: PETAL_SECONDS },
};

/** Where Fred reappears after time away: by the car. */
const RETURN_TILE = { x: 2, y: 5 };

/** Inputs for someone standing still. */
export const IDLE_INPUT: PlayerInput = {
  moveX: 0,
  moveY: 0,
  interact: false,
  work: false,
};

/** The input a person acts on this tick, and whether the assist supplied it. */
interface Chosen {
  readonly input: PlayerInput;
  /** True when the assist acted: its input was not idle. */
  readonly helped: boolean;
}

/**
 * The input a person acts on this tick: their own keys, or the solo assist
 * when the setup turns it on, the frame names them as the assisted person,
 * their keys are idle, and the helper may act (see `helperMayAct`).
 */
function inputFor(state: GameState, frame: Frame, id: PlayerId): Chosen {
  const given = frame.inputs[id] ?? IDLE_INPUT;
  const idle =
    given.moveX === 0 && given.moveY === 0 && !given.interact && !given.work;
  if (
    state.setup.assist &&
    frame.assisted === id &&
    idle &&
    helperMayAct(state, id)
  ) {
    const input = assistInput(state, id);
    const acted =
      input.moveX !== 0 || input.moveY !== 0 || input.interact || input.work;
    return { input, helped: acted };
  }
  return { input: given, helped: false };
}

/** A frame in which nobody touches anything. */
export const IDLE_FRAME: Frame = {
  inputs: { fred: IDLE_INPUT, abbi: IDLE_INPUT },
};

function collides(x: number, y: number): boolean {
  for (
    let ty = Math.floor(y - PLAYER_RADIUS);
    ty <= Math.floor(y + PLAYER_RADIUS);
    ty++
  ) {
    for (
      let tx = Math.floor(x - PLAYER_RADIUS);
      tx <= Math.floor(x + PLAYER_RADIUS);
      tx++
    ) {
      if (isWalkable(tx, ty)) continue;
      const nearestX = clamp(x, tx, tx + 1);
      const nearestY = clamp(y, ty, ty + 1);
      if ((x - nearestX) ** 2 + (y - nearestY) ** 2 < PLAYER_RADIUS ** 2)
        return true;
    }
  }
  return false;
}

function sign(value: number): number {
  return value > 0 ? 1 : value < 0 ? -1 : 0;
}

/** Whether a tile is lawn, out in the weather: every row below the paving. */
function isOutdoor(y: number): boolean {
  return y > PATIO_ROWS;
}

/** Whether a seeded event is on at the level's current time. */
function seededActive(state: GameState, id: SeededEventId): boolean {
  return state.seeded.some(
    (event) =>
      event.id === id && state.time >= event.at && state.time < event.until
  );
}

function move(
  player: Player,
  input: PlayerInput,
  dt: number,
  pace: number
): Player {
  const mx = sign(input.moveX);
  const my = sign(input.moveY);
  if (mx === 0 && my === 0) return player;
  const length = Math.hypot(mx, my);
  const speed =
    MOVE_SPEED * (player.calm ? CALM_SPEED_MULTIPLIER : 1) * pace * dt;
  let { x, y } = player;
  const nextX = x + (mx / length) * speed;
  if (!collides(nextX, y)) x = nextX;
  const nextY = y + (my / length) * speed;
  if (!collides(x, nextY)) y = nextY;
  let facingX = mx;
  let facingY = my;
  if (mx !== 0 && my !== 0) {
    const keepVertical = player.facingY === my && player.facingX === 0;
    facingX = keepVertical ? 0 : mx;
    facingY = keepVertical ? my : 0;
  }
  return { ...player, x, y, facingX, facingY };
}

interface Working {
  state: GameState;
  events: GameEvent[];
}

function setPlayer(w: Working, player: Player): void {
  w.state = {
    ...w.state,
    players: { ...w.state.players, [player.id]: player },
  };
}

function setStation(w: Working, station: Station): void {
  w.state = {
    ...w.state,
    stations: w.state.stations.map((s) => (s.id === station.id ? station : s)),
  };
}

function setTarget(w: Working, target: Target): void {
  w.state = {
    ...w.state,
    targets: w.state.targets.map((t) => (t.id === target.id ? target : t)),
  };
}

/**
 * Applies one press of the interact key for `id`. `helped` is true when the
 * solo helper pressed it on the partner's behalf, so the placement is recorded
 * as helper work.
 */
function interact(w: Working, id: PlayerId, helped: boolean): void {
  const player = w.state.players[id];
  const tile = interactTile(w.state, id);
  if (!tile) return;
  const { x, y } = tile;
  const supply = w.state.supplies.find((s) => s.x === x && s.y === y);
  const station = w.state.stations.find((s) => s.x === x && s.y === y);
  const target = w.state.targets.find((t) => t.x === x && t.y === y);
  const floorItem = w.state.floor.find((f) => f.x === x && f.y === y);
  const held = player.holding;

  if (!held) {
    if (supply) {
      const left = w.state.stock[supply.kind];
      if (left <= 0) return;
      // A chair crate gives a stack of chairs per take; the other crates one item.
      const taken =
        supply.kind === "chairs" ? Math.min(CHAIRS_PER_CARRY, left) : 1;
      const remaining = left - taken;
      w.state = {
        ...w.state,
        stock: { ...w.state.stock, [supply.kind]: remaining },
      };
      const carry: Item =
        supply.kind === "chairs"
          ? { kind: "chairs", madeBy: null, count: taken }
          : { kind: supply.kind, madeBy: null };
      setPlayer(w, { ...player, holding: carry });
      w.events.push({ type: "picked-up", player: id, item: supply.kind });
      if (remaining === 0)
        w.events.push({ type: "supply-empty", supply: supply.kind });
      return;
    }
    if (station?.item) {
      setStation(w, { ...station, item: null, progress: 0 });
      setPlayer(w, { ...player, holding: station.item });
      w.events.push({ type: "picked-up", player: id, item: station.item.kind });
      return;
    }
    if (floorItem) {
      w.state = {
        ...w.state,
        floor: w.state.floor.filter((f) => f !== floorItem),
      };
      setPlayer(w, { ...player, holding: floorItem.item });
      w.events.push({
        type: "picked-up",
        player: id,
        item: floorItem.item.kind,
      });
    }
    return;
  }

  if (supply) {
    // Facing the crate the item came from puts it back in stock, chairs by count.
    if (supply.kind !== held.kind) return;
    const returned = held.kind === "chairs" ? (held.count ?? 1) : 1;
    w.state = {
      ...w.state,
      stock: {
        ...w.state.stock,
        [supply.kind]: w.state.stock[supply.kind] + returned,
      },
    };
    setPlayer(w, { ...player, holding: null });
    w.events.push({ type: "put-down", player: id, item: held.kind });
    return;
  }
  if (station) {
    if (!stationAccepts(station, held)) return;
    setPlayer(w, { ...player, holding: null });
    const placed = station.kind === "grill" ? { ...held, madeBy: id } : held;
    setStation(w, { ...station, item: placed, progress: 0 });
    w.events.push({ type: "put-down", player: id, item: held.kind });
    return;
  }
  if (target) {
    if (target.status !== "open" || target.wants !== held.kind) return;
    // A chair spot takes one chair: the rest of a stack stays in hand.
    const placed: Item = held.kind === "chairs" ? { ...held, count: 1 } : held;
    const spare = held.kind === "chairs" ? (held.count ?? 1) - 1 : 0;
    const filled = [...target.filled, placed];
    setTarget(w, {
      ...target,
      filled,
      filledBy: [...target.filledBy, id],
      filledByHelper: [...target.filledByHelper, helped],
      status: filled.length >= target.capacity ? "filled" : "open",
    });
    if (filled.length >= target.capacity && w.state.firstFilledAt === null) {
      w.state = { ...w.state, firstFilledAt: w.state.time };
    }
    setPlayer(w, {
      ...player,
      holding: spare > 0 ? { ...held, count: spare } : null,
    });
    w.events.push({
      type: "target-filled",
      player: id,
      target: target.id,
      category: target.category,
    });
    return;
  }
  if (!supply && !floorItem && isWalkable(x, y)) {
    if (w.state.floor.length >= FLOOR_CAP) {
      w.events.push({ type: "floor-full", player: id });
      return;
    }
    w.state = { ...w.state, floor: [...w.state.floor, { x, y, item: held }] };
    setPlayer(w, { ...player, holding: null });
    w.events.push({ type: "put-down", player: id, item: held.kind });
  }
}

/** Holding work at the bin: after BIN_HOLD_SECONDS the item in hand is thrown out. */
function holdAtBin(w: Working, id: PlayerId, dt: number): void {
  const player = w.state.players[id];
  const item = player.holding;
  if (!item) {
    releaseBinHold(w, id);
    return;
  }
  const binHold = player.binHold + dt;
  if (binHold + 1e-9 >= BIN_HOLD_SECONDS) {
    setPlayer(w, { ...player, holding: null, binHold: 0 });
    if (item.kind === "chairs") {
      returnChairs(w, id, item.count ?? 1);
      return;
    }
    w.events.push({ type: "thrown-out", player: id, item: item.kind });
    if (item.kind === "burnt" && item.source) restockBatch(w, id, item.source);
  } else {
    setPlayer(w, { ...player, binHold });
  }
}

/**
 * A binned burnt batch is replaced from the crate it was cooked from: one
 * batch comes back into stock, so the buffet can still be filled.
 */
function restockBatch(w: Working, id: PlayerId, supply: SupplyKind): void {
  const stock = w.state.stock;
  w.state = {
    ...w.state,
    stock: { ...stock, [supply]: stock[supply] + 1 },
    burntRestocks: w.state.burntRestocks + 1,
  };
  w.events.push({ type: "restocked", player: id, supply });
}

/**
 * Binned chairs are not thrown out: the whole stack goes back to the chair
 * crate, so the venue's chairs can always still be placed.
 */
function returnChairs(w: Working, id: PlayerId, count: number): void {
  const stock = w.state.stock;
  w.state = {
    ...w.state,
    stock: { ...stock, chairs: stock.chairs + count },
  };
  w.events.push({ type: "restocked", player: id, supply: "chairs" });
}

/** Letting go of work, or facing something else, starts a bin hold over. */
function releaseBinHold(w: Working, id: PlayerId): void {
  const player = w.state.players[id];
  if (player.binHold > 0) setPlayer(w, { ...player, binHold: 0 });
}

function work(w: Working, id: PlayerId, dt: number): void {
  const player = w.state.players[id];
  const { x, y } = frontTile(player);
  const station = w.state.stations.find((s) => s.x === x && s.y === y);
  if (station?.kind === "bin") {
    holdAtBin(w, id, dt);
    return;
  }
  releaseBinHold(w, id);
  if (station && (station.kind === "arrange" || station.kind === "petals")) {
    if (station.item?.kind !== "roses") return;
    const craft = CRAFTS[station.kind];
    const progress = station.progress + dt;
    if (progress + 1e-9 >= craft.seconds) {
      setStation(w, {
        ...station,
        item: { kind: craft.output, madeBy: id },
        progress: 0,
      });
      w.events.push({ type: "crafted", player: id, item: craft.output });
    } else {
      setStation(w, { ...station, progress });
    }
    return;
  }
  const target = w.state.targets.find((t) => t.x === x && t.y === y);
  if (!target || player.holding) return;
  if (
    target.status !== "open" ||
    target.filled.length > 0 ||
    !SIMPLIFIABLE.has(target.category)
  ) {
    return;
  }
  const progress = target.simplifyProgress + dt;
  if (progress + 1e-9 >= SIMPLIFY_SECONDS) {
    setTarget(w, { ...target, status: "simplified", simplifyProgress: 0 });
    w.events.push({
      type: "simplified",
      target: target.id,
      category: target.category,
    });
  } else {
    setTarget(w, { ...target, simplifyProgress: progress });
  }
}

/**
 * Cooks and burns the grill. Raw food counts its cook time from placement.
 * Cooked food counts its pickup window from the moment it finished cooking,
 * in ordinary seconds, so `progress` is the time since it was cooked. A guest
 * rush makes that time run at double speed from when it is on, so food cooked
 * before the rush keeps the rest of its window, halved, and never burns on the
 * rush's first tick.
 */
function cookGrills(w: Working, dt: number): void {
  const rushing = seededActive(w.state, "guest-rush");
  const pickupSeconds = BURN_SECONDS - COOK_SECONDS;
  const ageRate = rushing ? 1 / RUSH_BURN_FACTOR : 1;
  for (const station of w.state.stations) {
    if (station.kind !== "grill" || !station.item) continue;
    const item = station.item;
    if (item.kind === "burnt") continue;
    const cooked = GRILL_COOKS[item.kind];
    if (cooked) {
      const progress = station.progress + dt;
      if (progress + 1e-9 >= COOK_SECONDS) {
        // The overshoot past the cook time is the first of the pickup window.
        const overshoot = progress - COOK_SECONDS;
        setStation(w, {
          ...station,
          item: { ...item, kind: cooked },
          progress: overshoot,
        });
        w.events.push({ type: "cooked", station: station.id, item: cooked });
      } else {
        setStation(w, { ...station, progress });
      }
      continue;
    }
    const progress = station.progress + dt * ageRate;
    if (progress + 1e-9 >= pickupSeconds) {
      // The burnt batch remembers its crate, so binning it restocks one batch.
      const source = RAW_FOR_COOKED[item.kind];
      setStation(w, {
        ...station,
        item: {
          kind: "burnt",
          madeBy: item.madeBy,
          ...(source ? { source } : {}),
        },
        progress,
      });
      w.state = { ...w.state, burntBatches: w.state.burntBatches + 1 };
      w.events.push({ type: "burnt", station: station.id });
    } else {
      setStation(w, { ...station, progress });
    }
  }
}

/**
 * True on the one tick whose step crosses `at`. Time is a sum of fixed steps,
 * so a boundary can land a hair under its exact value; the tolerance on both
 * ends counts it on that tick and not again on the next.
 */
function crossed(before: number, after: number, at: number): boolean {
  return before + 1e-9 < at && at <= after + 1e-9;
}

/** The level time the brothers' text lands; see BROTHERS_EARLIEST_AT. */
function brothersDue(state: GameState): number {
  return clamp(
    state.firstFilledAt ?? Infinity,
    onLevelClock(BROTHERS_EARLIEST_AT, state.duration),
    onLevelClock(BROTHERS_LATEST_AT, state.duration)
  );
}

/** The nearest spot Fred can drop on: his own tile first, then outward. */
function freeFloorSpot(
  state: GameState,
  player: Player
): { x: number; y: number } {
  const cx = Math.floor(player.x);
  const cy = Math.floor(player.y);
  for (let r = 0; r <= 20; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = cx + dx;
        const y = cy + dy;
        if (!FLOOR_TILES.includes(tileAt(x, y))) continue;
        if (state.floor.some((f) => f.x === x && f.y === y)) continue;
        return { x, y };
      }
    }
  }
  return { x: cx, y: cy };
}

/** Whether a brothers decision can be applied right now, and why not. */
export function validateDecision(
  state: GameState,
  decision: PresenceDecision
): Validation {
  if (state.phase !== "brothers")
    return { ok: false, reason: "Nobody is texting Fred right now." };
  if (!["stay", "break", "leave"].includes(decision.choice)) {
    return { ok: false, reason: "That is not an option." };
  }
  if (decision.choice === "break") {
    if (!decision.commitment || !COMMITMENTS.includes(decision.commitment)) {
      return {
        ok: false,
        reason: "A break needs a promise about what Fred comes back for.",
      };
    }
  } else if (decision.commitment) {
    return { ok: false, reason: "Only a break comes with a promise." };
  }
  return { ok: true };
}

/**
 * The frame to record for a tick the engine has just applied. A brothers
 * decision the engine ignores (wrong phase, or one that does not validate) is
 * dropped, so a strict replay of the recording reproduces the live run.
 */
export function recordedFrame(state: GameState, frame: Frame): Frame {
  if (!frame.decision || validateDecision(state, frame.decision).ok) {
    return frame;
  }
  return frame.assisted === undefined
    ? { inputs: frame.inputs }
    : { inputs: frame.inputs, assisted: frame.assisted };
}

function decide(state: GameState, decision: PresenceDecision): StepResult {
  const fred = state.players.fred;
  const away = decision.choice !== "stay";
  const seconds = onLevelClock(
    decision.choice === "break" ? BREAK_SECONDS : LEAVE_SECONDS,
    state.duration
  );
  const events: GameEvent[] = [];
  let floor = state.floor;
  let leaving: Player = away
    ? {
        ...fred,
        presence: "away",
        busyFor: 0,
        busyReason: null,
        binHold: 0,
      }
    : fred;
  const carried = fred.holding;
  if (away && carried) {
    // Whatever Fred carries goes down where he stands, so nothing stays frozen
    // in his hands while he is out. This drop ignores FLOOR_CAP.
    const spot = freeFloorSpot(state, fred);
    floor = [...floor, { x: spot.x, y: spot.y, item: carried }];
    leaving = { ...leaving, holding: null };
    events.push({ type: "put-down", player: "fred", item: carried.kind });
  }
  events.push({ type: "presence-decided", decision });
  return {
    state: {
      ...state,
      phase: "playing",
      presence: {
        choice: decision.choice,
        commitment: decision.commitment ?? null,
      },
      returnsAt: away ? state.time + seconds : null,
      floor,
      players: { ...state.players, fred: leaving },
    },
    events,
  };
}

/**
 * A level that finishes inside a seeded event (the shower, the rush) never
 * reaches that event's own end tick, so the end line for each event it has
 * started is emitted here, once, as the level finishes. An event that has not
 * started yet, or has already ended, gets no line.
 */
function endOpenSeeded(w: Working, now: number): void {
  for (const event of w.state.seeded) {
    if (event.at <= now + 1e-9 && now + 1e-9 < event.until) {
      w.events.push({ type: "seeded-end", id: event.id });
    }
  }
}

function allDone(state: GameState): boolean {
  return !state.targets.some((t) => t.status === "open");
}

/**
 * Advances the level by one tick. While the brothers' text is on screen the
 * clock stands still and only a valid decision moves the game on.
 */
export function stepGame(state: GameState, frame: Frame): StepResult {
  if (state.phase === "done") return { state, events: [] };
  if (state.phase === "brothers") {
    if (frame.decision && validateDecision(state, frame.decision).ok) {
      return decide({ ...state, tick: state.tick + 1 }, frame.decision);
    }
    return { state: { ...state, tick: state.tick + 1 }, events: [] };
  }

  const dt = TICK_SECONDS;
  const before = state.time;
  const after = before + dt;
  const w: Working = {
    state: { ...state, time: after, tick: state.tick + 1 },
    events: [],
  };

  for (const event of w.state.seeded) {
    if (crossed(before, after, event.at)) {
      w.events.push({ type: "seeded-start", id: event.id });
    }
    if (crossed(before, after, event.until)) {
      w.events.push({ type: "seeded-end", id: event.id });
    }
  }

  const fred = w.state.players.fred;
  if (
    fred.presence === "away" &&
    w.state.returnsAt !== null &&
    w.state.returnsAt <= after + 1e-9
  ) {
    setPlayer(w, {
      ...fred,
      presence: "here",
      calm: true,
      x: RETURN_TILE.x + 0.5,
      y: RETURN_TILE.y + 0.5,
    });
    w.state = { ...w.state, returnsAt: null };
    w.events.push({ type: "fred-returned" });
  }

  for (const call of INTERRUPTIONS) {
    if (!crossed(before, after, call.at)) continue;
    const blockedBy = w.state.setup.capabilities.includes(call.blockedBy)
      ? call.blockedBy
      : null;
    w.state = {
      ...w.state,
      interruptions: [
        ...w.state.interruptions,
        { id: call.id, at: call.at, player: call.player, blockedBy },
      ],
    };
    w.events.push({
      type: "interruption",
      id: call.id,
      player: call.player,
      blockedBy,
    });
    const target = w.state.players[call.player];
    if (!blockedBy && target.presence === "here") {
      setPlayer(w, {
        ...target,
        busyFor: PHONE_SECONDS,
        busyReason: call.text,
      });
    }
  }

  // The brothers' text ends the tick here, but the boundaries it crossed
  // (interruptions above) are already handled, so none is lost to the stop.
  if (w.state.brothersAt === null && after + 1e-9 >= brothersDue(w.state)) {
    w.state = { ...w.state, phase: "brothers", brothersAt: after };
    w.events.push({ type: "brothers-text" });
    return w;
  }

  const nervous = w.state.players.fred;
  // Set whenever a decision exists, so the fallback is never read.
  const brothersAt = w.state.brothersAt ?? 0;
  if (
    w.state.presence?.choice === "stay" &&
    !nervous.calm &&
    nervous.busyFor <= 0 &&
    Math.floor((after - brothersAt) / SHOE_INTERVAL_SECONDS) >
      Math.floor((before - brothersAt) / SHOE_INTERVAL_SECONDS) &&
    after > brothersAt
  ) {
    setPlayer(w, {
      ...nervous,
      busyFor: SHOE_SECONDS,
      busyReason: "Double-checking his shoes. Again.",
    });
    w.events.push({ type: "shoes-retied" });
  }

  for (const id of PLAYER_IDS) {
    const player = w.state.players[id];
    if (player.presence === "away") continue;
    if (player.busyFor > 0) {
      // A call or a shoe retie breaks a bin hold: it has to be continuous.
      const busyFor = Math.max(0, player.busyFor - dt);
      setPlayer(w, {
        ...player,
        busyFor,
        busyReason: busyFor > 0 ? player.busyReason : null,
        binHold: 0,
      });
      continue;
    }
    const { input, helped } = inputFor(w.state, frame, id);
    if (helped) w.state = { ...w.state, assistTicks: w.state.assistTicks + 1 };
    // On the assist's resting ticks its held work keeps its hold but makes no
    // progress, which is how the assist works at about 40% pace.
    const resting = helped && assistRests(w.state.tick, w.state.setup.relaxed);
    const wet =
      seededActive(w.state, "shower") && isOutdoor(Math.floor(player.y));
    setPlayer(w, move(player, input, dt, wet ? SHOWER_WALK_FACTOR : 1));
    if (input.interact) interact(w, id, helped);
    if (input.work) work(w, id, resting ? 0 : dt);
    else releaseBinHold(w, id);
  }

  cookGrills(w, dt);

  if (allDone(w.state)) {
    w.state = { ...w.state, phase: "done", finishedAt: after };
    endOpenSeeded(w, after);
    w.events.push({ type: "level-finished", early: true });
  } else if (after + 1e-9 >= w.state.duration) {
    w.state = { ...w.state, phase: "done" };
    endOpenSeeded(w, after);
    w.events.push({ type: "level-finished", early: false });
  }
  return w;
}

/** Raised by a strict replay at the first decision that does not fit. */
export class ReplayError extends Error {
  readonly frame: number;
  readonly reason: string;

  constructor(frame: number, reason: string) {
    super(`Frame ${frame} is invalid: ${reason}`);
    this.name = "ReplayError";
    this.frame = frame;
    this.reason = reason;
  }
}

/**
 * Rebuilds a level from its setup and recorded frames. Strict mode, the
 * default for shared runs, throws at a decision that does not fit the state it
 * lands on. Lenient mode drops such decisions with their reasons.
 */
export function replayLevel(
  setup: Setup,
  frames: readonly Frame[],
  options: { readonly mode?: "strict" | "lenient" } = {}
): {
  readonly state: GameState;
  readonly dropped: readonly { frame: number; reason: string }[];
} {
  let state = createLevel(setup);
  const dropped: { frame: number; reason: string }[] = [];
  frames.forEach((frame, index) => {
    let next = frame;
    if (frame.decision) {
      const check = validateDecision(state, frame.decision);
      if (!check.ok) {
        if (options.mode !== "lenient")
          throw new ReplayError(index, check.reason);
        dropped.push({ frame: index, reason: check.reason });
        next = frame.assisted
          ? { inputs: frame.inputs, assisted: frame.assisted }
          : { inputs: frame.inputs };
      }
    }
    state = stepGame(state, next).state;
  });
  return { state, dropped };
}
