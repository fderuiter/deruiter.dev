/**
 * Micro-dilemmas for Patty's Drive-Thru (#2087): short, timed choices put to
 * the player in the middle of the shift. Each trades the meters against each
 * other and moves the hidden Solidarity value, which picks the ending at
 * close. A dilemma never pauses the booth; orders keep arriving while it is
 * open, and if the timer runs out its default answer is taken.
 *
 * Which dilemmas a shift gets, and when, comes from its own PRNG stream
 * (`<seed>:dilemmas`), so adding them leaves every shift's orders exactly as
 * they were, and the same seed and actions still replay the same shift.
 */

import { clamp } from "../../game-utils";
import { drawInt, uniformAt } from "../../utils/prng";
import {
  COMPANY_MAN_MAX_SOLIDARITY,
  DILEMMAS,
  DILEMMAS_PER_SHIFT,
  DILEMMA_IDS,
  DILEMMA_SEC_PER,
  DILEMMA_WINDOW_LIMITS,
  DILEMMA_WINDOW_SEC,
  WALKOUT_MIN_DIGNITY,
  WALKOUT_MIN_SOLIDARITY,
} from "../presets";
import type {
  Dilemma,
  DilemmaChoice,
  DilemmaId,
  DilemmaOption,
  DilemmaSlot,
  ShiftConfig,
  ShiftEndingId,
  ShiftEvent,
  ShiftState,
} from "../types";

/** How far either side of its even spot a dilemma may land, as a fraction of the gap. */
const SLOT_JITTER = 0.4;

/**
 * The answer window a config asks for, held to `DILEMMA_WINDOW_LIMITS`, or
 * undefined when it sets none or sets something that is not a number.
 */
export function dilemmaWindowOf(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  const [min, max] = DILEMMA_WINDOW_LIMITS;
  return clamp(value, min, max);
}

/**
 * The dilemmas a shift puts to the player and when, drawn from the shift's
 * seed alone. Up to `DILEMMAS_PER_SHIFT` of them, never the same one twice,
 * spread evenly through the shift with a little seeded jitter, and each early
 * enough that its timer runs out before close.
 *
 * @param config - The shift's seed, length and answer window.
 */
export function getDilemmaPlan(
  config: Pick<ShiftConfig, "seed" | "durationSec" | "dilemmaWindowSec">
): readonly DilemmaSlot[] {
  const duration = config.durationSec;
  if (!Number.isFinite(duration) || duration <= 0) return [];
  const count = Math.min(
    DILEMMAS_PER_SHIFT,
    DILEMMA_IDS.length,
    Math.floor(duration / DILEMMA_SEC_PER)
  );
  if (count <= 0) return [];
  const window = dilemmaWindowOf(config.dilemmaWindowSec) ?? DILEMMA_WINDOW_SEC;
  const stream = `${config.seed}:dilemmas`;
  let draw = 0;

  // A seeded Fisher-Yates shuffle, so no shift repeats a dilemma.
  const ids = [...DILEMMA_IDS];
  for (let i = ids.length - 1; i > 0; i -= 1) {
    const j = drawInt(stream, draw++, i + 1);
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }

  const gap = duration / (count + 1);
  const latest = Math.max(0, duration - window - 1);
  const slots: DilemmaSlot[] = [];
  for (let i = 0; i < count; i += 1) {
    const jitter = (uniformAt(stream, draw++) - 0.5) * gap * SLOT_JITTER;
    const at = Math.round(clamp(gap * (i + 1) + jitter, 0, latest) * 100) / 100;
    slots.push({ at, dilemmaId: ids[i] });
  }
  return slots;
}

/** The written dilemma for an id. */
export function getDilemma(id: DilemmaId): Dilemma {
  return DILEMMAS[id];
}

/** One of a dilemma's answers, or undefined when the id is not one of them. */
export function getDilemmaOption(
  id: DilemmaId,
  optionId: unknown
): DilemmaOption | undefined {
  if (!Object.hasOwn(DILEMMAS, id)) return undefined;
  return DILEMMAS[id].options.find((option) => option.id === optionId);
}

/** The cents the player's answers took out of their pay. */
export function getDilemmaPayCents(
  choices: readonly Pick<DilemmaChoice, "dilemmaId" | "optionId">[]
): number {
  return choices.reduce(
    (sum, choice) =>
      sum +
      (getDilemmaOption(choice.dilemmaId, choice.optionId)?.payCents ?? 0),
    0
  );
}

/**
 * Answers the open dilemma: applies the option's meter and Solidarity
 * changes, records the choice and closes the dilemma. The caller has already
 * checked the option belongs to the open dilemma.
 */
export function resolveDilemma(
  state: ShiftState,
  option: DilemmaOption,
  timedOut: boolean,
  events: ShiftEvent[]
): ShiftState {
  const open = state.dilemma;
  if (!open) return state;
  events.push({
    type: "dilemma-resolved",
    dilemmaId: open.dilemmaId,
    optionId: option.id,
    timedOut,
  });
  return {
    ...state,
    meters: {
      ...state.meters,
      sos: clamp(state.meters.sos + option.sos, 0, 100),
      dignity: clamp(state.meters.dignity + option.dignity, 0, 100),
    },
    solidarity: clamp(state.solidarity + option.solidarity, 0, 100),
    dilemma: null,
    dilemmaChoices: [
      ...state.dilemmaChoices,
      {
        dilemmaId: open.dilemmaId,
        optionId: option.id,
        at: state.time,
        timedOut,
      },
    ],
  };
}

/**
 * Runs the dilemma clock for a shift whose time has just moved: an open
 * dilemma whose timer ran out, or that is still open at close, takes its
 * default answer, and the next planned dilemma is offered once its time has
 * come and nothing else is open.
 */
export function stepDilemmas(
  state: ShiftState,
  events: ShiftEvent[]
): ShiftState {
  let next = state;
  const open = next.dilemma;
  if (
    open &&
    (next.time >= open.closesAt || next.time >= next.config.durationSec)
  ) {
    const dilemma = DILEMMAS[open.dilemmaId];
    const fallback = getDilemmaOption(open.dilemmaId, dilemma.defaultOptionId);
    if (fallback) next = resolveDilemma(next, fallback, true, events);
  }
  if (next.dilemma || next.time >= next.config.durationSec) return next;
  const slot = getDilemmaPlan(next.config)[next.dilemmaChoices.length];
  if (!slot || slot.at > next.time) return next;
  const window =
    dilemmaWindowOf(next.config.dilemmaWindowSec) ?? DILEMMA_WINDOW_SEC;
  events.push({ type: "dilemma-offered", dilemmaId: slot.dilemmaId });
  return {
    ...next,
    dilemma: {
      dilemmaId: slot.dilemmaId,
      offeredAt: next.time,
      closesAt: Math.min(next.time + window, next.config.durationSec),
    },
  };
}

/**
 * The ending a shift that reached close earns from its Solidarity and
 * Dignity (#2087): the Walkout for a player who stood with the crew and has
 * the Dignity left to act on it, the Company Man for one who sided with
 * management, and the Silent Exit for everyone in between.
 */
export function getChoiceEnding(
  solidarity: number,
  dignity: number
): Extract<ShiftEndingId, "company-man" | "silent-exit" | "walkout"> {
  if (solidarity >= WALKOUT_MIN_SOLIDARITY && dignity >= WALKOUT_MIN_DIGNITY)
    return "walkout";
  if (solidarity <= COMPANY_MAN_MAX_SOLIDARITY) return "company-man";
  return "silent-exit";
}

/**
 * The diary lines a shift's answers leave, one per dilemma, in the order
 * they were answered. An answer the clock made reads as such. Unknown ids,
 * as an edited save might hold, are skipped.
 */
export function getDilemmaDiaryLines(
  choices: readonly Pick<DilemmaChoice, "dilemmaId" | "optionId" | "timedOut">[]
): string[] {
  const lines: string[] = [];
  for (const choice of choices) {
    const option = getDilemmaOption(choice.dilemmaId, choice.optionId);
    if (!option) continue;
    lines.push(
      choice.timedOut ? DILEMMAS[choice.dilemmaId].timeoutDiary : option.diary
    );
  }
  return lines;
}
