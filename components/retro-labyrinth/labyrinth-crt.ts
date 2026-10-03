/**
 * How Retro Labyrinth sets its CRT (epic #1522, item 1).
 *
 * The CRT is a polish layer, not a veil. Unless the player has saved their
 * own calibration in the CRT modal, the game follows the cabinet's Setup
 * Wizard `crtFilter`, whose default is "soft". The passes themselves still
 * run through `renderCRTEffects` in `@/lib/arcade/crt-pipeline`; this module
 * only picks the settings it is called with.
 */

import {
  CRT_PRESETS,
  type CRTCalibrationConfig,
} from "@/lib/arcade/crt-pipeline";

/** The Setup Wizard's CRT options, as the cabinet passes them. */
export type CabinetCrtFilter = "off" | "soft" | "arcade" | "scanlines";

/** No passes at all: the art exactly as drawn. */
export const LABYRINTH_CRT_OFF: CRTCalibrationConfig = {
  scanlinesEnabled: false,
  scanlineIntensity: 0,
  scanlineDensity: 3,
  phosphorMask: "none",
  phosphorIntensity: 0,
  bloomIntensity: 0,
  curvature: 0,
  vignetteIntensity: 0,
  flickerShimmer: false,
};

/**
 * The default: a faint scanline raster and a light vignette. No phosphor
 * mask, no bloom wash, no curvature and no flicker, so the pixel art stays
 * crisp.
 */
export const LABYRINTH_CRT_SOFT: CRTCalibrationConfig = {
  scanlinesEnabled: true,
  scanlineIntensity: 0.1,
  scanlineDensity: 3,
  phosphorMask: "none",
  phosphorIntensity: 0,
  bloomIntensity: 0,
  curvature: 0,
  vignetteIntensity: 0.3,
  flickerShimmer: false,
};

/** Heavy scanlines without the mask or bloom. */
const LABYRINTH_CRT_SCANLINES: CRTCalibrationConfig = {
  ...LABYRINTH_CRT_SOFT,
  scanlineIntensity: 0.32,
  scanlineDensity: 2,
};

/**
 * The CRT settings the game draws with.
 *
 * @param cabinetFilter - The Setup Wizard's `crtFilter`, or undefined
 *   outside a cabinet (the 404 page), which gets Soft.
 * @param savedCalibration - The player's own calibration from the CRT modal,
 *   or null when they never saved one.
 */
export function resolveLabyrinthCrt(
  cabinetFilter: CabinetCrtFilter | undefined,
  savedCalibration: CRTCalibrationConfig | null
): CRTCalibrationConfig {
  if (savedCalibration) return savedCalibration;
  switch (cabinetFilter) {
    case "off":
      return LABYRINTH_CRT_OFF;
    case "arcade":
      return CRT_PRESETS["authentic-arcade"].config;
    case "scanlines":
      return LABYRINTH_CRT_SCANLINES;
    default:
      return LABYRINTH_CRT_SOFT;
  }
}

/** True when the settings would draw nothing, so the pass can be skipped. */
export function isCrtIdle(config: CRTCalibrationConfig): boolean {
  return (
    (!config.scanlinesEnabled || config.scanlineIntensity <= 0) &&
    (config.phosphorMask === "none" || config.phosphorIntensity <= 0) &&
    config.bloomIntensity <= 0.05 &&
    config.vignetteIntensity <= 0.05
  );
}
