import { STUDY_EVENTS } from "./events-data";
import {
  DOCUMENTATION_ATTENTION,
  advanceDay,
  applyEffects,
  resolveDecision,
  scaleDays,
} from "./model";
import { uniformAt } from "./rng";
import { clamp } from "../../game-utils";
import type {
  ActionResult,
  Difficulty,
  StudyEvent,
  StudyState,
  Urgency,
} from "../types";

const URGENCY_ORDER: Record<Urgency, number> = {
  critical: 0,
  important: 1,
  routine: 2,
};

const byId = new Map(STUDY_EVENTS.map((e) => [e.id, e]));

/**
 * The day an event was written for, on this study's calendar. Event days are
 * written on the full study's calendar; a short study (#2092) squeezes them
 * into its own duration, so the story keeps its order and every phase still
 * gets its messages. A run with a deck (#2093) draws the day it actually
 * arrives from a window around this one: see {@link deckDay}.
 */
export function eventDay(state: StudyState, event: StudyEvent): number {
  return scaleDays(event.day, state.setup);
}

/**
 * The first day an event can reach this run's inbox on its own, or null when
 * it never does: a follow-up or wildcard (those arrive only when scheduled),
 * or an event this run's deck did not draw. A run without a deck, as every
 * save from before #2093, keeps each event on its written day.
 */
export function deckDay(state: StudyState, event: StudyEvent): number | null {
  if (event.followUp) return null;
  if (!state.deck) return eventDay(state, event);
  const day = state.deck[event.id];
  return day === undefined ? null : lateMailDay(state, day);
}

/** The last day the scripted calendar writes mail for, on the full calendar. */
const LAST_WRITTEN_DAY = 110;

/**
 * Where mail written for after the planned end lands in this run (#2192).
 * It is written for a run that slips, out to day 110, but a run that slips
 * ends between days 82 and 94, so most of it was never reached. It is
 * pressed into the days this run actually has past its plan, in the order it
 * was written; a run that slips further than the mail was written for keeps
 * the written days. An on-time run still never sees it. The squeeze follows
 * the run's slip as it grows, so the same deck stays live to the real end.
 */
function lateMailDay(state: StudyState, day: number): number {
  const planned = state.setup.durationDays;
  if (day <= planned) return day;
  const written = Math.max(
    1,
    scaleDays(LAST_WRITTEN_DAY, state.setup) - planned
  );
  // The days past the plan this run has: its slip, less the day it ends on.
  const room = state.slipDays - 1;
  const squeeze = clamp(room / written, 0, 1);
  return planned + Math.max(1, Math.round((day - planned) * squeeze));
}

/** Looks up an event by id. */
export function getEvent(id: string): StudyEvent | undefined {
  return byId.get(id);
}

function isDue(state: StudyState, event: StudyEvent): boolean {
  if (state.handled.includes(event.id)) return false;
  const scheduled = state.scheduled.find((s) => s.eventId === event.id);
  if (scheduled) return state.day >= scheduled.day;
  const day = deckDay(state, event);
  // Mail that has reached the inbox stays there even if a later slip moves
  // the day its late mail is squeezed onto (#2192).
  const arrived = state.seen[event.id] !== undefined;
  if (day === null || (state.day < day && !arrived)) return false;
  return event.trigger ? event.trigger(state) : true;
}

/** Events in the inbox today, most urgent first. */
export function inbox(state: StudyState): StudyEvent[] {
  return STUDY_EVENTS.filter((e) => isDue(state, e)).sort(
    (a, b) => URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency]
  );
}

function markSeen(state: StudyState): StudyState {
  const seen = { ...state.seen };
  for (const e of inbox(state)) seen[e.id] ??= state.day;
  return { ...state, seen };
}

/**
 * Answers an inbox event with one of its options. `documented` spends extra
 * attention to record the decision, and is what saves you at inspection.
 */
export function resolveEvent(
  state: StudyState,
  eventId: string,
  optionId: string,
  documented: boolean
): ActionResult {
  const event = byId.get(eventId);
  const option = event?.options.find((o) => o.id === optionId);
  if (!event || !option || !isDue(state, event))
    return { ok: false, reason: "unknown-target" };
  const result = resolveDecision(state, {
    eventId,
    optionId,
    label: option.label,
    effects: option.effects,
    attentionCost: option.attentionCost,
    debtIfUndocumented: option.debtIfUndocumented,
    documented,
  });
  if (!result.ok) return result;
  const next = result.state;
  return {
    ok: true,
    state: {
      ...next,
      handled: [...next.handled, eventId],
      flags: [...next.flags, ...(option.flags ?? [])],
      scheduled: [
        ...next.scheduled.filter((s) => s.eventId !== eventId),
        // Follow-up gaps shrink with the calendar, so a short study's
        // follow-up chains still land before closeout (#2092).
        ...(option.schedule ?? []).map((s) => ({
          eventId: s.eventId,
          day: next.day + scaleDays(s.inDays, next.setup),
        })),
      ],
    },
  };
}

/**
 * Writes up a decision after the fact (#1689): the latest undocumented
 * answer to an event is marked documented and the documentation debt it
 * added is repaid, in full the same day and by half on a later day, since
 * notes written from memory are thinner. The record keeps the day it was
 * decided. Refuses when there is nothing undocumented for the event.
 */
export function documentDecision(
  state: StudyState,
  eventId: string
): ActionResult {
  if (state.status !== "running")
    return { ok: false, reason: "study-complete" };
  let index = -1;
  for (let i = state.log.length - 1; i >= 0; i -= 1) {
    const r = state.log[i];
    if (r.eventId === eventId && !r.documented && r.optionId !== "ignored") {
      index = i;
      break;
    }
  }
  if (index < 0) return { ok: false, reason: "unknown-target" };
  const record = state.log[index];
  const debt =
    byId.get(eventId)?.options.find((o) => o.id === record.optionId)
      ?.debtIfUndocumented ?? 0;
  const repaid = record.day === state.day ? debt : Math.ceil(debt / 2);
  const log = state.log.slice();
  log[index] = {
    ...record,
    documented: true,
    attentionSpent: record.attentionSpent + DOCUMENTATION_ATTENTION,
  };
  return {
    ok: true,
    state: {
      ...state,
      log,
      documentationDebt: Math.max(0, state.documentationDebt - repaid),
    },
  };
}

/** Lets unanswered events whose time has run out apply their fallout. */
function expire(state: StudyState): StudyState {
  let next = state;
  for (const event of inbox(state)) {
    const first = next.seen[event.id] ?? next.day;
    if (next.day < first + event.ttl - 1) continue;
    next = {
      ...applyEffects(next, event.ifIgnored),
      handled: [...next.handled, event.id],
      log: [
        ...next.log,
        {
          day: next.day,
          eventId: event.id,
          optionId: "ignored",
          label: "Left unanswered",
          documented: false,
          attentionSpent: 0,
          effects: event.ifIgnored,
        },
      ],
    };
  }
  return next;
}

/**
 * Ends the day: unanswered events that have run out of time apply their
 * fallout, the study advances one day, and new events reach the inbox.
 */
export function endDay(state: StudyState): StudyState {
  if (state.status !== "running") return state;
  return markSeen(advanceDay(expire(markSeen(state))));
}

/** How many wildcard events a run draws, by difficulty. */
export const WILDCARDS_PER_RUN: Record<Difficulty, number> = {
  calm: 2,
  standard: 3,
  rescue: 4,
};

/**
 * Draws this run's wildcard events and the days they land, spread across
 * the study. They use their own stream of the seed, so the study's other
 * draws, and every existing replay, are unchanged by them.
 */
export function scheduleWildcards(state: StudyState): StudyState {
  const pool = STUDY_EVENTS.filter((e) => e.wildcard).map((e) => e.id);
  const count = Math.min(
    pool.length,
    WILDCARDS_PER_RUN[state.difficulty ?? "standard"]
  );
  if (count === 0) return state;
  const stream = `${state.seed}:wildcards`;
  for (let i = 0; i < count; i += 1) {
    const j = i + Math.floor(uniformAt(stream, i) * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const first = 8;
  const last = Math.round(state.setup.durationDays * 0.85);
  const span = (last - first) / count;
  const drawn = pool.slice(0, count).map((eventId, k) => ({
    eventId,
    day: first + Math.floor(k * span + uniformAt(stream, 100 + k) * span * 0.8),
  }));
  return { ...state, scheduled: [...state.scheduled, ...drawn] };
}

/**
 * Share of the optional events written for each stretch of the study that a
 * run's deck draws (#2093), on average and never fewer than one, so two runs
 * differ in what arrives as well as when.
 */
export const DECK_KEEP_SHARE = 0.75;

/** Days of the full calendar in each stretch the deck draws a subset from. */
const DECK_BAND_DAYS = 10;

/** The stretch an event was written for: days 5-14, 15-24, and so on. */
const bandOf = (event: StudyEvent): number =>
  Math.floor((event.day - 5) / DECK_BAND_DAYS);

/**
 * The full-calendar days a deck may draw an event's day from: its own
 * window, or a band around its written day that widens a little as the
 * study goes on (one day either side early, at most four late).
 */
function windowOf(event: StudyEvent): [number, number] {
  if (event.window) return event.window;
  const spread = clamp(Math.round(event.day * 0.08), 1, 4);
  return [Math.max(1, event.day - spread), event.day + spread];
}

/** Events the deck deals: everything that is not scheduled by something else. */
const DECKABLE = STUDY_EVENTS.filter((e) => !e.followUp && !e.wildcard);

/**
 * The order a deck is dealt and read back in: callbacks last, once the day
 * of the event they recall is known. Reading a save in the same order keeps
 * its text byte for byte, whatever order the events are written in.
 */
const DEAL_ORDER = [
  ...DECKABLE.filter((e) => !e.recalls),
  ...DECKABLE.filter((e) => e.recalls),
];

/**
 * Gentle early messages one of which, or two, opens a run alongside the
 * sponsor's biomarker request (#2254). Day 1 used to be the same in every
 * seed and empty by mid-morning; now each seed draws its own openers from
 * these. None is urgent and none slips the timeline if it is left, so the
 * first day still reads as a first day.
 */
export const DAY_ONE_OPENERS: readonly string[] = [
  "boss-proposal-call",
  "sponsor-slide-colors",
  "walt-initiation-trips",
  "lab-manual",
  "lee-protocol-typos",
  "site-two-pharmacy",
  "pi-training-trailer",
  "sponsor-kickoff-dinner",
];

/** How a run's deck is dealt. */
export interface DeckOptions {
  /** Bring a seeded pick of {@link DAY_ONE_OPENERS} forward to day 1. */
  openers?: boolean;
}

/** Messages day 1 holds, counting the core ones that always open it. */
const DAY_ONE_MESSAGES = 3;

/** Days of the full calendar an opener may be brought forward from. */
const OPENER_FROM_DAYS = 14;

/**
 * The openers this run's day 1 brings forward: enough to bring it to
 * {@link DAY_ONE_MESSAGES} beside the core events that can only land on it,
 * and at least one. They come from what the deck dealt into the first
 * fortnight where it can, so only the day moves: the deck keeps the same events and the
 * fortnight the same variety (#2192). The pick reads the deck's own stream on
 * indices nothing else reads, so every other draw is unchanged.
 */
function dayOneOpeners(
  state: StudyState,
  stream: string,
  deck: Readonly<Record<string, number>>
): string[] {
  const fixed = DECKABLE.filter(
    (e) => e.core && !e.recalls && scaleDays(windowOf(e)[1], state.setup) <= 1
  ).length;
  const by = scaleDays(OPENER_FROM_DAYS, state.setup);
  const dealt = DAY_ONE_OPENERS.filter((id) => deck[id] !== undefined);
  const early = dealt.filter((id) => deck[id] <= by);
  // A deck that dealt none of them early still opens with one of its own.
  const pool = early.length > 0 ? early : dealt;
  if (pool.length === 0) return [];
  const count = clamp(DAY_ONE_MESSAGES - fixed, 1, pool.length);
  for (let i = 0; i < count; i += 1) {
    const j = i + Math.floor(uniformAt(stream, 50_000 + i) * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

/**
 * Deals this run's event deck (#2093). Core events are always drawn; of the
 * optional ones, each stretch of the study keeps {@link DECK_KEEP_SHARE} of
 * what was written for it. Every drawn event gets a day inside its window,
 * scaled to this study's calendar. A callback is drawn exactly when the
 * event it recalls is, and always arrives after it. With `openers`, a seeded
 * pick of gentle openers it dealt into the first fortnight is brought
 * forward to day 1. The deck uses its own stream of
 * the seed, so the study's other draws and the wildcards are unchanged.
 */
export function drawDeck(
  state: StudyState,
  options: DeckOptions = {}
): StudyState {
  const stream = `${state.seed}:deck`;
  const kept = new Set<string>();
  const bands = new Map<number, string[]>();
  for (const event of DECKABLE) {
    // A callback is a consequence, not a draw: it comes with its parent.
    if (event.recalls) continue;
    if (event.core) {
      kept.add(event.id);
      continue;
    }
    const band = bandOf(event);
    bands.set(band, [...(bands.get(band) ?? []), event.id]);
  }
  for (const [band, ids] of [...bands].sort((a, b) => a[0] - b[0])) {
    // The share rarely comes out whole: the fraction left over is a chance
    // of one more, so every stretch keeps three quarters on average.
    const share = ids.length * DECK_KEEP_SHARE;
    const extra = uniformAt(stream, (band + 1) * 100 + 99) < share % 1 ? 1 : 0;
    const keep = clamp(Math.floor(share) + extra, 1, ids.length);
    const pool = ids.slice();
    for (let i = 0; i < keep; i += 1) {
      const draw = uniformAt(stream, (band + 1) * 100 + i);
      const j = i + Math.floor(draw * (pool.length - i));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    for (const id of pool.slice(0, keep)) kept.add(id);
  }
  const deck: Record<string, number> = {};
  for (const event of DEAL_ORDER) {
    const parent = event.recalls ? deck[event.recalls] : undefined;
    if (event.recalls ? parent === undefined : !kept.has(event.id)) continue;
    const [lo, hi] = windowOf(event);
    const index = 10_000 + STUDY_EVENTS.indexOf(event);
    const full = lo + Math.floor(uniformAt(stream, index) * (hi - lo + 1));
    const day = scaleDays(full, state.setup);
    deck[event.id] = parent === undefined ? day : Math.max(day, parent + 1);
  }
  if (options.openers)
    for (const id of dayOneOpeners(state, stream, deck)) deck[id] = 1;
  return { ...state, deck };
}

/**
 * Reads a saved run's deck strictly: only events that can be dealt, on whole
 * days from 1. Anything that is not a deck reads as none, so the run plays
 * on the fixed days, as a save from before #2093 does.
 */
export function readDeck(value: unknown): Record<string, number> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return undefined;
  const deck: Record<string, number> = {};
  for (const event of DEAL_ORDER) {
    const day: unknown = (value as Record<string, unknown>)[event.id];
    if (typeof day === "number" && Number.isInteger(day) && day >= 1)
      deck[event.id] = day;
  }
  return deck;
}

/**
 * Starts the study on day 1 with its event deck dealt, its wildcards drawn
 * and the first inbox ready. The office passes `openers` so its first day
 * varies by seed (#2254); the classic desk keeps its one-message first day,
 * which teaches auditing once the inbox is empty.
 */
export function beginStudy(
  state: StudyState,
  options: DeckOptions = {}
): StudyState {
  return markSeen(advanceDay(scheduleWildcards(drawDeck(state, options))));
}
