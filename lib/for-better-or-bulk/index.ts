/**
 * For Better or Bulk: the headless real-time wedding-setup engine (ADR 0060).
 * You bought everything at the warehouse; Fred and Abbi still have to turn it
 * into a wedding before 4:00. Every rule lives here as pure functions over
 * plain data on a fixed tick, and front ends render the read-only views.
 */

export type * from "./types";
export * from "./presets";
export {
  cartTotal,
  createLevel,
  seededEvents,
  stockFor,
  validateSetup,
} from "./internal/level";
export { createPrng, dailySeed, MAX_SEED, parseSeed } from "./internal/prng";
export type { Prng } from "./internal/prng";
export {
  IDLE_FRAME,
  IDLE_INPUT,
  ReplayError,
  frontTile,
  replayLevel,
  stepGame,
  validateDecision,
} from "./internal/sim";
export { computeReceipt, readinessLines, tally } from "./internal/receipt";
export {
  CHALLENGE_COPY,
  CHALLENGE_IDS,
  countStars,
  evaluateChallenges,
} from "./internal/challenges";
export {
  MAX_RUN_CODE_LENGTH,
  MAX_RUN_TICKS,
  RUN_CODE_PREFIX,
  RUN_CODE_REFUSAL,
  RUN_REPLAY_REFUSAL,
  decodeRunCode,
  encodeRunCode,
  runCodeFromHash,
  runLinkFor,
  runResultOf,
  verifyRun,
} from "./internal/run-code";
export type {
  RunCodeError,
  RunCodeResult,
  RunResult,
  RunVerification,
  SharedRun,
} from "./internal/run-code";
export { assistInput } from "./internal/assist";
export { clockLabel, getHint, getPrompt } from "./internal/views";
export type { Prompt } from "./internal/views";
