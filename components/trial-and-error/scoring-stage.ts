import type { TimelineStep } from "@/lib/trial-and-error";
import { clamp } from "@/lib/game-utils";

/**
 * Pure geometry and number helpers for the scoring stage (#1524): the play
 * zone's counters, the target bar and the cards that travel into it. Nothing
 * here touches the DOM, so every mapping is unit-tested on its own.
 */

/** A figure space: as wide as a digit in a tabular or monospace font. */
export const FIGURE_SPACE = " ";

/**
 * A number padded with figure spaces to `width` characters, so a centred
 * counter keeps its text in place as digits arrive (no layout shift).
 */
export function padFigures(value: number | string, width: number): string {
  return String(value).padStart(Math.max(0, width), FIGURE_SPACE);
}

/** A blank counter of `width` characters: holds the space before a value. */
export function blankFigures(width: number): string {
  return FIGURE_SPACE.repeat(Math.max(0, width));
}

/**
 * The fewest characters a counter holds. The preview and the playback share
 * it, so the play zone keeps one shape from selection through scoring.
 */
export const COUNTER_MIN_CHARS = 4;

/**
 * The character width every counter of a hand's timeline needs: the longest
 * Chips, Mult or score it reaches, and never under {@link COUNTER_MIN_CHARS}.
 */
export function counterWidth(steps: readonly TimelineStep[]): number {
  let widest = COUNTER_MIN_CHARS;
  for (const step of steps) {
    const values = [step.running.chips, step.running.mult];
    if (step.kind === "TOTAL") values.push(step.score);
    for (const value of values) {
      widest = Math.max(widest, String(value).length);
    }
  }
  return widest;
}

/**
 * How full the target bar is, from 0 to 1. A met or beaten target fills it;
 * a target of zero or less counts as met once anything has scored.
 */
export function targetFill(score: number, target: number): number {
  if (!Number.isFinite(score) || !Number.isFinite(target)) return 0;
  if (target <= 0) return score > 0 ? 1 : 0;
  return clamp(score / target, 0, 1);
}

/** Ease-out cubic on t in [0, 1]: fast off the mark, gentle landing. */
export function easeOutCubic(t: number): number {
  const clamped = clamp(t, 0, 1);
  return 1 - (1 - clamped) ** 3;
}

/**
 * The value a roll-up counter shows at progress t (0 to 1) on its way from
 * `from` to `to`: whole numbers only, landing exactly on `to`.
 */
export function rollValue(from: number, to: number, t: number): number {
  if (t >= 1) return to;
  return Math.round(from + (to - from) * easeOutCubic(t));
}

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Where a card starts its trip: the offset and scale from its slot. */
interface Travel {
  x: number;
  y: number;
  scale: number;
}

/**
 * The transform that puts a played card back where it left the hand, so it
 * can travel from there to its slot in the play zone. Centre to centre, and
 * scaled to the hand card's width (capped at 3×). An unmeasured box (zero
 * size, as in a test DOM) has no trip.
 */
export function travelFrom(source: Box, target: Box): Travel | null {
  if (source.width <= 0 || target.width <= 0) return null;
  const x = source.left + source.width / 2 - (target.left + target.width / 2);
  const y = source.top + source.height / 2 - (target.top + target.height / 2);
  const scale = clamp(source.width / target.width, 1, 3);
  return { x: Math.round(x), y: Math.round(y), scale: +scale.toFixed(3) };
}

/**
 * The play zone's selection slots: one per card the Blind lets a hand hold,
 * filled in selection order. Selections past the limit are not shown.
 */
export function selectionSlots(
  maxSelection: number,
  selected: readonly string[]
): (string | null)[] {
  const count = Math.max(0, Math.floor(maxSelection));
  return Array.from({ length: count }, (_, i) => selected[i] ?? null);
}

/**
 * Chips each played card has added so far, from the revealed CARD_SCORED
 * steps; a retriggered card adds up.
 */
export function scoredChips(
  revealed: readonly TimelineStep[]
): ReadonlyMap<string, number> {
  const chips = new Map<string, number>();
  for (const step of revealed) {
    if (step.kind !== "CARD_SCORED") continue;
    chips.set(step.cardId, (chips.get(step.cardId) ?? 0) + step.chips);
  }
  return chips;
}
