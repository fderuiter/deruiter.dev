/**
 * Study Director world: the walkable workplace on top of the study model.
 *
 * The study in `@/lib/study-director` stays authoritative. This module adds
 * the clock, the player's energy and focus, and the day's rhythm, and
 * translates world actions into study actions. Everything here is pure and
 * deterministic (ADR 0055). Internals under `internal/` are private.
 */
export * from "./types";
export {
  ACTION_COSTS,
  actionCost,
  drinkCoffee,
  fatigueFrom,
  formatClock,
  spend,
  weekdayFor,
} from "./internal/clock";
export { createWorld, goHome, newWorld, startDay } from "./internal/day";
export { WORLD_SAVE_KEY, parseWorld, serializeWorld } from "./internal/save";
