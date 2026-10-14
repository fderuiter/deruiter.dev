/**
 * Echo, the Meme Vault's repeat-the-sequence game (#2049). The vault plays a
 * growing sequence on its eight pads and the player repeats it; one wrong
 * pad ends the round.
 *
 * This module is the pure engine: no React, DOM, audio or storage. A round
 * is a seed plus a length, so the same seed always plays the same pads and a
 * round can be replayed exactly in tests.
 */

import { drawInt } from "@/lib/utils/prng";

/** Number of pads Echo draws from, matching the sampler's keys 1 to 8. */
export const ECHO_PAD_COUNT = 8;

/**
 * The playback tempo schedule. Each sequence step lasts `baseMs`, and the
 * step shortens by `stepMs` for every `every` pads the sequence holds, never
 * going below `minMs`.
 */
export const ECHO_TEMPO = {
  baseMs: 640,
  stepMs: 40,
  every: 3,
  minMs: 320,
} as const;

/** The fraction of a step for which the playing pad stays lit. */
export const ECHO_LIGHT_FRACTION = 0.62;

/**
 * Where a round stands. `showing`: the vault is playing the sequence and
 * ignores input. `input`: the player is repeating it. `over`: a wrong pad
 * ended the round.
 */
export type EchoPhase = "showing" | "input" | "over";

/** One Echo round. Treat it as immutable: every transition returns a copy. */
export interface EchoRound {
  /** Seed the pad sequence is drawn from. */
  seed: string;
  /** Pad indices (0 to 7) the vault plays, in order. */
  sequence: readonly number[];
  phase: EchoPhase;
  /** How many pads of the current sequence the player has repeated. */
  inputIndex: number;
  /** Sequences repeated in full this round. */
  streak: number;
  /** The pad the vault expected when the round ended, or null. */
  expectedPad: number | null;
}

/**
 * What a pad press did. `ignored`: the round was not taking input.
 * `correct`: the right pad, with more of the sequence to go. `complete`: the
 * whole sequence repeated, so the streak grew and a longer sequence follows.
 * `fail`: the wrong pad, which ends the round.
 */
export type EchoOutcome = "ignored" | "correct" | "complete" | "fail";

export interface EchoInputResult {
  round: EchoRound;
  outcome: EchoOutcome;
}

/**
 * The pad at position `index` of the sequence for `seed`. A sequence only
 * ever grows, so position `index` is the same pad however long it gets.
 */
export function echoPadAt(seed: string, index: number): number {
  return drawInt(seed, index, ECHO_PAD_COUNT);
}

/** The first `length` pads of the sequence for `seed`. */
export function echoSequence(seed: string, length: number): number[] {
  const count = Number.isFinite(length) ? Math.max(0, Math.floor(length)) : 0;
  return Array.from({ length: count }, (_, i) => echoPadAt(seed, i));
}

/** A new round for `seed`: one pad long, with the vault about to play it. */
export function createEchoRound(seed: string): EchoRound {
  return {
    seed,
    sequence: echoSequence(seed, 1),
    phase: "showing",
    inputIndex: 0,
    streak: 0,
    expectedPad: null,
  };
}

/**
 * Hands the round to the player once the vault has played the sequence. Any
 * phase other than `showing` comes back unchanged.
 */
export function beginEchoInput(round: EchoRound): EchoRound {
  if (round.phase !== "showing") return round;
  return { ...round, phase: "input", inputIndex: 0 };
}

/**
 * Applies one pad press. Input is taken only in the `input` phase; a pad
 * outside 0 to 7 counts as a wrong pad. Repeating the whole sequence adds
 * one to the streak and one pad to the sequence, and returns the round to
 * `showing` so the vault plays the longer sequence.
 */
export function submitEchoInput(
  round: EchoRound,
  pad: number
): EchoInputResult {
  if (round.phase !== "input") return { round, outcome: "ignored" };
  const expected = round.sequence[round.inputIndex];
  if (pad !== expected) {
    return {
      round: { ...round, phase: "over", expectedPad: expected ?? null },
      outcome: "fail",
    };
  }
  const nextIndex = round.inputIndex + 1;
  if (nextIndex < round.sequence.length) {
    return { round: { ...round, inputIndex: nextIndex }, outcome: "correct" };
  }
  return {
    round: {
      ...round,
      phase: "showing",
      inputIndex: 0,
      streak: round.streak + 1,
      sequence: echoSequence(round.seed, round.sequence.length + 1),
    },
    outcome: "complete",
  };
}

/**
 * Milliseconds per playback step for a sequence `length` pads long. The
 * tempo rises gently: a little faster every {@link ECHO_TEMPO}.every pads,
 * down to a floor.
 */
export function echoStepMs(length: number): number {
  const safe = Number.isFinite(length) ? Math.max(1, Math.floor(length)) : 1;
  const speedUps = Math.floor((safe - 1) / ECHO_TEMPO.every);
  return Math.max(
    ECHO_TEMPO.minMs,
    ECHO_TEMPO.baseMs - speedUps * ECHO_TEMPO.stepMs
  );
}

/** Whether `streak` beats the stored `best`. */
export function isNewEchoBest(streak: number, best: number): boolean {
  return Number.isFinite(streak) && streak > 0 && streak > (best || 0);
}

/** Reads a stored best streak, treating anything malformed as 0. */
export function parseEchoBest(raw: string | null): number {
  if (raw === null) return 0;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value > 0 ? value : 0;
}
