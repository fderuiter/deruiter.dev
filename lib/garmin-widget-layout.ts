/**
 * Garmin Watch Visual Widget Slot Builder & Configuration Schema
 *
 * Configures the mapping of simulation telemetry data fields to visual gauge slots
 * on the round watch display and companion panel.
 * Persists user layout preferences in browser storage using local storage key
 * `garmin_simulator_widget_layout`.
 */

import type { GameEngineState } from "./garmin-engine";
import { DEVICE_PROFILES } from "./garmin-engine";
import { safeGetRawItem, safeSetRawItem } from "./safe-storage";
import { clamp } from "./game-utils";

export type WidgetSlot =
  | "leftArc"
  | "rightArc"
  | "topRight"
  | "topLeft"
  | "bottomLeft"
  | "bottomCenter"
  | "bottomRight";

export type MetricKey =
  | "ram"
  | "flash"
  | "battery"
  | "heartRate"
  | "thermal"
  | "fog"
  | "score"
  | "distance"
  | "steps"
  | "variables";

export interface MetricDefinition {
  key: MetricKey;
  label: string;
  shortLabel: string;
  unit: string;
  resolveFraction: (state: GameEngineState) => number;
  resolveValue: (state: GameEngineState) => number;
  formatReadout: (state: GameEngineState) => string;
  resolveTone: (state: GameEngineState) => "ok" | "warn" | "danger";
}

export type WidgetLayoutConfig = Record<WidgetSlot, MetricKey>;

export const WIDGET_LAYOUT_STORAGE_KEY = "garmin_simulator_widget_layout";

export const DEFAULT_WIDGET_LAYOUT: WidgetLayoutConfig = {
  leftArc: "ram",
  rightArc: "flash",
  topRight: "battery",
  topLeft: "heartRate",
  bottomLeft: "steps",
  bottomCenter: "distance",
  bottomRight: "variables",
};

export const SLOT_LABELS: Record<WidgetSlot, string> = {
  leftArc: "Ring Arc (Left)",
  rightArc: "Ring Arc (Right)",
  topRight: "Top Right Gauge / Readout",
  topLeft: "Top Left Readout",
  bottomLeft: "Ground Strip Slot 1 (Left)",
  bottomCenter: "Ground Strip Slot 2 (Center)",
  bottomRight: "Ground Strip Slot 3 (Right)",
};

/**
 * Metric definitions detailing how each data field is resolved from simulation engine state.
 */
export const METRIC_DEFINITIONS: Record<MetricKey, MetricDefinition> = {
  ram: {
    key: "ram",
    label: "RAM Memory Usage",
    shortLabel: "RAM",
    unit: "KB",
    resolveFraction: (s) => {
      const limit = DEVICE_PROFILES[s.device]?.ramLimitKb ?? 32;
      return clamp(s.allocatedRamKb / limit, 0, 1.0);
    },
    resolveValue: (s) => s.allocatedRamKb,
    formatReadout: (s) => {
      const limit = DEVICE_PROFILES[s.device]?.ramLimitKb ?? 32;
      return `${s.allocatedRamKb.toFixed(1)} / ${limit} KB`;
    },
    resolveTone: (s) => {
      const limit = DEVICE_PROFILES[s.device]?.ramLimitKb ?? 32;
      const f = s.allocatedRamKb / limit;
      return f > 0.85 ? "danger" : f > 0.65 ? "warn" : "ok";
    },
  },
  flash: {
    key: "flash",
    label: "NV Flash Storage",
    shortLabel: "FLASH",
    unit: "KB",
    resolveFraction: (s) => {
      const limit = DEVICE_PROFILES[s.device]?.flashLimitKb ?? 64;
      return clamp(s.allocatedFlashKb / limit, 0, 1.0);
    },
    resolveValue: (s) => s.allocatedFlashKb,
    formatReadout: (s) => {
      const limit = DEVICE_PROFILES[s.device]?.flashLimitKb ?? 64;
      return `${s.allocatedFlashKb.toFixed(1)} / ${limit} KB`;
    },
    resolveTone: (s) => {
      const limit = DEVICE_PROFILES[s.device]?.flashLimitKb ?? 64;
      const f = s.allocatedFlashKb / limit;
      return f > 0.85 ? "danger" : f > 0.65 ? "warn" : "ok";
    },
  },
  battery: {
    key: "battery",
    label: "Battery Charge Level",
    shortLabel: "BATTERY",
    unit: "%",
    resolveFraction: (s) => clamp(s.battery / 100, 0, 1.0),
    resolveValue: (s) => Math.round(s.battery),
    formatReadout: (s) => `${Math.round(s.battery)}%`,
    resolveTone: (s) =>
      s.battery < 15 ? "danger" : s.battery < 30 ? "warn" : "ok",
  },
  heartRate: {
    key: "heartRate",
    label: "Heart Rate",
    shortLabel: "HR",
    unit: "BPM",
    resolveFraction: (s) => clamp((s.heartRate - 60) / 140, 0, 1.0),
    resolveValue: (s) => Math.round(s.heartRate ?? 135),
    formatReadout: (s) => `${Math.round(s.heartRate ?? 135)} BPM`,
    resolveTone: (s) =>
      s.heartRate > 175 ? "danger" : s.heartRate > 155 ? "warn" : "ok",
  },
  thermal: {
    key: "thermal",
    label: "Thermal Stress",
    shortLabel: "TEMP",
    unit: "%",
    resolveFraction: (s) => clamp(s.thermalStress ?? 0, 0, 1.0),
    resolveValue: (s) => Math.round((s.thermalStress ?? 0) * 100),
    formatReadout: (s) => `${Math.round((s.thermalStress ?? 0) * 100)}%`,
    resolveTone: (s) =>
      (s.thermalStress ?? 0) > 0.7
        ? "danger"
        : (s.thermalStress ?? 0) > 0.4
          ? "warn"
          : "ok",
  },
  fog: {
    key: "fog",
    label: "Condensation Fog",
    shortLabel: "FOG",
    unit: "%",
    resolveFraction: (s) => clamp(s.fogLevel ?? 0, 0, 1.0),
    resolveValue: (s) => Math.round((s.fogLevel ?? 0) * 100),
    formatReadout: (s) => `${Math.round((s.fogLevel ?? 0) * 100)}%`,
    resolveTone: (s) =>
      (s.fogLevel ?? 0) > 0.6
        ? "danger"
        : (s.fogLevel ?? 0) > 0.3
          ? "warn"
          : "ok",
  },
  score: {
    key: "score",
    label: "Run Score Points",
    shortLabel: "SCORE",
    unit: "PTS",
    resolveFraction: (s) => clamp(s.score / 500, 0, 1.0),
    resolveValue: (s) => s.score,
    formatReadout: (s) => `${s.score} PTS`,
    resolveTone: () => "ok",
  },
  distance: {
    key: "distance",
    label: "Distance Covered",
    shortLabel: "DIST",
    unit: "KM",
    resolveFraction: (s) => clamp(s.distanceMeters / 2700, 0, 1.0),
    resolveValue: (s) => Number((s.distanceMeters / 1000).toFixed(2)),
    formatReadout: (s) => `${(s.distanceMeters / 1000).toFixed(2)} KM`,
    resolveTone: () => "ok",
  },
  steps: {
    key: "steps",
    label: "Estimated Steps",
    shortLabel: "STEPS",
    unit: "STEPS",
    resolveFraction: (s) => clamp((s.distanceMeters * 1.35) / 3000, 0, 1.0),
    resolveValue: (s) => Math.round(s.distanceMeters * 1.35),
    formatReadout: (s) => `${Math.round(s.distanceMeters * 1.35)} STEPS`,
    resolveTone: () => "ok",
  },
  variables: {
    key: "variables",
    label: "Heap Variable Count",
    shortLabel: "VARS",
    unit: "VARS",
    resolveFraction: (s) => clamp(s.variables.length / 20, 0, 1.0),
    resolveValue: (s) => s.variables.length,
    formatReadout: (s) => `${s.variables.length} VARS`,
    resolveTone: (s) =>
      s.variables.length > 15
        ? "danger"
        : s.variables.length > 10
          ? "warn"
          : "ok",
  },
};

/**
 * Loads the user's custom widget layout configuration from local storage with safe fallback.
 */
export function loadWidgetLayout(): WidgetLayoutConfig {
  try {
    const raw = safeGetRawItem(WIDGET_LAYOUT_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed === "object" && parsed !== null) {
        return {
          leftArc:
            parsed.leftArc in METRIC_DEFINITIONS
              ? parsed.leftArc
              : DEFAULT_WIDGET_LAYOUT.leftArc,
          rightArc:
            parsed.rightArc in METRIC_DEFINITIONS
              ? parsed.rightArc
              : DEFAULT_WIDGET_LAYOUT.rightArc,
          topRight:
            parsed.topRight in METRIC_DEFINITIONS
              ? parsed.topRight
              : DEFAULT_WIDGET_LAYOUT.topRight,
          topLeft:
            parsed.topLeft in METRIC_DEFINITIONS
              ? parsed.topLeft
              : DEFAULT_WIDGET_LAYOUT.topLeft,
          bottomLeft:
            parsed.bottomLeft in METRIC_DEFINITIONS
              ? parsed.bottomLeft
              : DEFAULT_WIDGET_LAYOUT.bottomLeft,
          bottomCenter:
            parsed.bottomCenter in METRIC_DEFINITIONS
              ? parsed.bottomCenter
              : DEFAULT_WIDGET_LAYOUT.bottomCenter,
          bottomRight:
            parsed.bottomRight in METRIC_DEFINITIONS
              ? parsed.bottomRight
              : DEFAULT_WIDGET_LAYOUT.bottomRight,
        };
      }
    }
  } catch {
    // Fall back to default configuration if storage access fails or parsing throws
  }
  return { ...DEFAULT_WIDGET_LAYOUT };
}

/**
 * Persists the user's custom widget layout configuration to local storage.
 */
export function saveWidgetLayout(layout: WidgetLayoutConfig): boolean {
  try {
    return safeSetRawItem(WIDGET_LAYOUT_STORAGE_KEY, JSON.stringify(layout));
  } catch {
    return false;
  }
}
