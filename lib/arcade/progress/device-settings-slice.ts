/**
 * The `arcade.device-settings` slice (#2922, part of #2362): how this device
 * plays every cabinet. Handedness, haptics, dock size, a layout override,
 * volumes and reduced effects live here once, instead of in each game. It
 * is a device setting, not progress, so it never syncs: a phone and a laptop
 * keep their own.
 */

import { clamp } from "../utils";
import { defineSlice, read, useProgress, write } from "./slice";

/** The storage key of the device settings. */
export const ARCADE_DEVICE_SETTINGS_KEY = "arcade_device_settings_v1";

/** Which thumb works the actions; the docks mirror for `left`. */
export type DeviceHandedness = "right" | "left";

/** How large the on-screen keys are. */
export type DeviceDockSize = "sm" | "md" | "lg";

/** The view the cabinet shows, or `auto` to let it pick by the screen. */
export type DeviceLayout = "auto" | "phone" | "tablet" | "desktop";

/** This device's cabinet settings. */
export interface ArcadeDeviceSettings {
  readonly version: 1;
  readonly handedness: DeviceHandedness;
  /** Whether games may vibrate; a device without the API ignores it. */
  readonly haptics: boolean;
  readonly dockSize: DeviceDockSize;
  readonly layout: DeviceLayout;
  /** Sound effects volume, 0 to 1. */
  readonly sound: number;
  /** Music volume, 0 to 1. */
  readonly music: number;
  /** Fewer effects, on top of `prefers-reduced-motion`. */
  readonly reducedEffects: boolean;
}

/** The fields a caller may change. */
export type ArcadeDeviceSettingsPatch = Partial<
  Omit<ArcadeDeviceSettings, "version">
>;

/** The settings when nothing is stored. */
export const DEFAULT_DEVICE_SETTINGS: ArcadeDeviceSettings = Object.freeze({
  version: 1,
  handedness: "right",
  haptics: true,
  dockSize: "md",
  layout: "auto",
  sound: 1,
  music: 1,
  reducedEffects: false,
});

const HANDEDNESS: readonly DeviceHandedness[] = ["right", "left"];
const DOCK_SIZES: readonly DeviceDockSize[] = ["sm", "md", "lg"];
const LAYOUTS: readonly DeviceLayout[] = ["auto", "phone", "tablet", "desktop"];

function oneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T
): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function flag(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function volume(value: unknown, fallback: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return clamp(value, 0, 1);
}

/**
 * Settles every field of a stored or patched record, so one damaged field
 * falls back to its default and the rest are kept.
 */
function normalise(value: Record<string, unknown>): ArcadeDeviceSettings {
  const d = DEFAULT_DEVICE_SETTINGS;
  return {
    version: 1,
    handedness: oneOf(value.handedness, HANDEDNESS, d.handedness),
    haptics: flag(value.haptics, d.haptics),
    dockSize: oneOf(value.dockSize, DOCK_SIZES, d.dockSize),
    layout: oneOf(value.layout, LAYOUTS, d.layout),
    sound: volume(value.sound, d.sound),
    music: volume(value.music, d.music),
    reducedEffects: flag(value.reducedEffects, d.reducedEffects),
  };
}

/** This device's cabinet settings: `arcade_device_settings_v1`. */
export const arcadeDeviceSettingsSlice = defineSlice<ArcadeDeviceSettings>({
  id: "arcade.device-settings",
  key: ARCADE_DEVICE_SETTINGS_KEY,
  class: "device",
  version: 1,
  schema: {
    // Fields are settled one by one; only a value that is not a record at
    // all is corrupt.
    safeParse: (value) =>
      typeof value === "object" && value !== null && !Array.isArray(value)
        ? {
            success: true,
            data: normalise(value as Record<string, unknown>),
          }
        : { success: false },
  },
  // A device slice never merges with another copy; if one ever does, the
  // settings on this device win.
  merge: (a) => a,
  empty: () => DEFAULT_DEVICE_SETTINGS,
});

/**
 * This device's cabinet settings, or the defaults on the server and when
 * storage is blocked.
 *
 * @returns The settings.
 */
export function getDeviceSettings(): ArcadeDeviceSettings {
  return read(arcadeDeviceSettingsSlice);
}

/**
 * Changes some of this device's cabinet settings and keeps the rest. Values
 * out of range are settled the same way a stored value is: volumes are
 * clamped to 0 to 1 and an unknown option keeps its default.
 *
 * @param patch - The fields to change.
 * @returns True when the settings reached localStorage.
 */
export function setDeviceSettings(patch: ArcadeDeviceSettingsPatch): boolean {
  return write(
    arcadeDeviceSettingsSlice,
    normalise({ ...getDeviceSettings(), ...patch })
  );
}

/**
 * This device's cabinet settings, re-rendering when they change here or in
 * another tab.
 *
 * @returns The settings.
 */
export function useDeviceSettings(): ArcadeDeviceSettings {
  return useProgress(arcadeDeviceSettingsSlice);
}

/**
 * The narrowest window, in CSS px, each layout fits (#2923, the design
 * review on #2362). A phone view fits any window; a tablet needs 744px and a
 * desktop 1024px, the widths their views are built for.
 */
export const DEVICE_LAYOUT_MIN_WIDTH: Readonly<Record<DeviceLayout, number>> =
  Object.freeze({ auto: 0, phone: 0, tablet: 744, desktop: 1024 });

/**
 * Whether a layout fits a window this wide.
 *
 * @param layout - The layout to check.
 * @param width - The window's width in CSS px.
 * @returns True when the layout's view fits.
 */
export function layoutFits(layout: DeviceLayout, width: number): boolean {
  return width >= DEVICE_LAYOUT_MIN_WIDTH[layout];
}

/**
 * The layout the cabinet uses: the stored choice while it fits, and `auto`
 * while it does not. The stored choice is kept, so it applies again once
 * the window is wide enough.
 *
 * @param layout - The stored layout.
 * @param width - The window's width in CSS px.
 * @returns The layout to use now.
 */
export function effectiveLayout(
  layout: DeviceLayout,
  width: number
): DeviceLayout {
  return layoutFits(layout, width) ? layout : "auto";
}
