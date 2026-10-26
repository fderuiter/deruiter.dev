/**
 * Arcade progress (#2371, #2548): typed stores and slices over the keys the
 * games already write, one change event, one rule for damaged values, and
 * the joins that merge two copies of a profile.
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
export { defineSlice, read, subscribe, useProgress, write } from "./slice";
export type {
  ArcadeSlice,
  ArcadeSliceClass,
  ArcadeSliceDefinition,
  ArcadeSliceFormat,
  ArcadeSliceInfo,
  ArcadeSliceSchema,
} from "./slice";
export { ARCADE_PROGRESS_CATALOG, getArcadeCatalogEntry } from "./catalog";
export type { ArcadeCatalogEntry } from "./catalog";
export {
  ARCADE_UNIFIED_PROGRESS_KEY,
  arcadeCoreSlice,
  mergeArcadeProgress,
  parseScoreValue,
} from "./core";
export type { ArcadeProgress } from "./core";
export { arcadeDailySlice, mergeArcadeDailyProgress } from "./daily-slice";
export {
  ARCADE_COACH_MARKS_KEY,
  arcadeCoachMarksSlice,
  hasSeenCoachMarks,
  setCoachMarksSeen,
} from "./coach-marks-slice";
export type { ArcadeCoachMarks } from "./coach-marks-slice";
export {
  ARCADE_DEVICE_SETTINGS_KEY,
  DEFAULT_DEVICE_SETTINGS,
  DEVICE_LAYOUT_MIN_WIDTH,
  arcadeDeviceSettingsSlice,
  effectiveLayout,
  getDeviceSettings,
  layoutFits,
  setDeviceSettings,
  useDeviceSettings,
} from "./device-settings-slice";
export type {
  ArcadeDeviceSettings,
  ArcadeDeviceSettingsPatch,
  DeviceDockSize,
  DeviceHandedness,
  DeviceLayout,
} from "./device-settings-slice";
