/**
 * Arcade progress (#2371, #2548): typed stores over the keys the games
 * already write, one change event, and one rule for damaged values.
 */

export {
  ARCADE_CORRUPT_SUFFIX,
  ARCADE_PROGRESS_CHANGED_EVENT,
  createArcadeStore,
  onArcadeProgressNotice,
} from "./store";
export type {
  ArcadeProgressNotice,
  ArcadeStore,
  ArcadeStoreOptions,
} from "./store";
