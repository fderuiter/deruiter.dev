/**
 * The three readouts in the Garmin watch face's ground strip, and the
 * player's saved choice of them. Which fields exist and how they validate
 * lives here; how a field is read from the engine and drawn lives with the
 * watch face.
 */

import { safeGetRawItem, safeSetRawItem } from "./safe-storage";

/** Fields a ground-strip slot can show. */
export const GROUND_STRIP_FIELDS = [
  "steps",
  "distance",
  "vars",
  "heartRate",
  "thermal",
  "fog",
  "ram",
  "flash",
] as const;

export type GroundStripField = (typeof GROUND_STRIP_FIELDS)[number];

/** Left, center and right slot. */
export type GroundStripLayout = readonly [
  GroundStripField,
  GroundStripField,
  GroundStripField,
];

export const DEFAULT_GROUND_STRIP: GroundStripLayout = [
  "steps",
  "distance",
  "vars",
];

export const GROUND_STRIP_STORAGE_KEY = "garmin_ground_strip";

export const GROUND_STRIP_SLOT_LABELS = ["Left", "Center", "Right"] as const;

/** Menu text for each field. */
export const GROUND_STRIP_FIELD_LABELS: Record<GroundStripField, string> = {
  steps: "Steps",
  distance: "Distance",
  vars: "Heap variables",
  heartRate: "Heart rate",
  thermal: "Thermal stress",
  fog: "Fog",
  ram: "RAM",
  flash: "NV flash",
};

/** True when `value` names a ground-strip field. */
export function isGroundStripField(value: unknown): value is GroundStripField {
  return (
    typeof value === "string" &&
    (GROUND_STRIP_FIELDS as readonly string[]).includes(value)
  );
}

/** The saved layout; any slot that is missing or unknown falls back to its default. */
export function loadGroundStrip(): GroundStripLayout {
  try {
    const parsed: unknown = JSON.parse(
      safeGetRawItem(GROUND_STRIP_STORAGE_KEY) ?? "null"
    );
    if (Array.isArray(parsed)) {
      return DEFAULT_GROUND_STRIP.map((fallback, i) =>
        isGroundStripField(parsed[i]) ? parsed[i] : fallback
      ) as unknown as GroundStripLayout;
    }
  } catch {
    // Unreadable storage or JSON: use the defaults.
  }
  return DEFAULT_GROUND_STRIP;
}

/** Saves the layout; returns whether the write reached storage. */
export function saveGroundStrip(layout: GroundStripLayout): boolean {
  try {
    return safeSetRawItem(GROUND_STRIP_STORAGE_KEY, JSON.stringify(layout));
  } catch {
    return false;
  }
}
