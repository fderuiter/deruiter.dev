/**
 * CRT Post-Processing Pipeline & Phosphor Mask Emulation Engine
 *
 * Provides calibrated retro visual effects for 2D canvas arcade experiences,
 * including RGB subpixel phosphor mask emulation (Aperture Grille, Shadow Mask,
 * Monochrome Dot Matrix), horizontal scanline rasters, multi-stage bloom glow,
 * radial vignette, and barrel curvature styling.
 */

import { CRTThemeConfig } from "@/lib/dungeon/types";
import { clamp } from "../game-utils";
import { getMatchMediaMatches } from "@/hooks/useMediaQuery";

export type PhosphorMaskType =
  "none" | "aperture-grille" | "shadow-mask" | "monochrome-dot";

export type CRTPresetId =
  | "authentic-arcade"
  | "trinitron-pro"
  | "amber-terminal"
  | "cyberpunk-neon"
  | "clean-digital";

export interface CRTCalibrationConfig {
  /**
   * Whether horizontal CRT scanlines are rendered.
   */
  scanlinesEnabled: boolean;
  /**
   * Scanline darkness and prominence (0.0 to 1.0).
   */
  scanlineIntensity: number;
  /**
   * Pixel pitch/interval between scanlines (2, 3, or 4 px).
   */
  scanlineDensity: number;
  /**
   * Type of physical phosphor mask to emulate.
   */
  phosphorMask: PhosphorMaskType;
  /**
   * Opacity of the RGB phosphor mask overlay (0.0 to 1.0).
   */
  phosphorIntensity: number;
  /**
   * Diffusion intensity of the screen bloom and phosphor glow (0.0 to 1.0).
   */
  bloomIntensity: number;
  /**
   * Physical CRT tube barrel curvature factor (0.0 to 1.0).
   */
  curvature: number;
  /**
   * Corner shadow and radial falloff intensity (0.0 to 1.0).
   */
  vignetteIntensity: number;
  /**
   * Subtle refresh-rate phosphor micro-flicker shimmer.
   */
  flickerShimmer: boolean;
}

export interface CRTPreset {
  id: CRTPresetId;
  name: string;
  badge: string;
  description: string;
  config: CRTCalibrationConfig;
}

export const CRT_PRESETS: Record<CRTPresetId, CRTPreset> = {
  "authentic-arcade": {
    id: "authentic-arcade",
    name: "Authentic Arcade CRT",
    badge: "1980s Coin-Op",
    description:
      "Staggered triad shadow mask, rich bloom, warm raster scanlines, and deep vignette.",
    config: {
      scanlinesEnabled: true,
      scanlineIntensity: 0.32,
      scanlineDensity: 3,
      phosphorMask: "shadow-mask",
      phosphorIntensity: 0.28,
      bloomIntensity: 0.45,
      curvature: 0.2,
      vignetteIntensity: 0.7,
      flickerShimmer: true,
    },
  },
  "trinitron-pro": {
    id: "trinitron-pro",
    name: "Trinitron PVM Pro",
    badge: "1990s Broadcast",
    description:
      "Crisp RGB vertical aperture grille stripes, razor-sharp scanlines, and high luminance.",
    config: {
      scanlinesEnabled: true,
      scanlineIntensity: 0.2,
      scanlineDensity: 2,
      phosphorMask: "aperture-grille",
      phosphorIntensity: 0.22,
      bloomIntensity: 0.3,
      curvature: 0.1,
      vignetteIntensity: 0.5,
      flickerShimmer: false,
    },
  },
  "amber-terminal": {
    id: "amber-terminal",
    name: "Amber Mainframe Terminal",
    badge: "IBM 3270",
    description:
      "Monochrome micro-phosphor dot matrix, high contrast scanlines, and warm amber aura.",
    config: {
      scanlinesEnabled: true,
      scanlineIntensity: 0.4,
      scanlineDensity: 3,
      phosphorMask: "monochrome-dot",
      phosphorIntensity: 0.32,
      bloomIntensity: 0.5,
      curvature: 0.25,
      vignetteIntensity: 0.8,
      flickerShimmer: true,
    },
  },
  "cyberpunk-neon": {
    id: "cyberpunk-neon",
    name: "Cyberpunk Neon Deck",
    badge: "Futuristic HUD",
    description:
      "Vibrant aperture grille, high saturation bloom glow, and dynamic phosphor luminance.",
    config: {
      scanlinesEnabled: true,
      scanlineIntensity: 0.24,
      scanlineDensity: 3,
      phosphorMask: "aperture-grille",
      phosphorIntensity: 0.28,
      bloomIntensity: 0.6,
      curvature: 0.15,
      vignetteIntensity: 0.65,
      flickerShimmer: true,
    },
  },
  "clean-digital": {
    id: "clean-digital",
    name: "Clean Digital / LCD",
    badge: "Flat Modern",
    description:
      "Crisp raw pixel art without scanlines, phosphor patterns, or curvature distortion.",
    config: {
      scanlinesEnabled: false,
      scanlineIntensity: 0.0,
      scanlineDensity: 3,
      phosphorMask: "none",
      phosphorIntensity: 0.0,
      bloomIntensity: 0.1,
      curvature: 0.0,
      vignetteIntensity: 0.3,
      flickerShimmer: false,
    },
  },
};

/**
 * Preset a first-time player gets. Trinitron PVM Pro keeps the CRT look with
 * the lightest scanlines and vignette, so the maze stays readable.
 */
export const DEFAULT_CRT_PRESET_ID: CRTPresetId = "trinitron-pro";

export const DEFAULT_CRT_CALIBRATION: CRTCalibrationConfig =
  CRT_PRESETS[DEFAULT_CRT_PRESET_ID].config;

export const CRT_CALIBRATION_STORAGE_KEY = "retro_labyrinth_crt_calibration";

/**
 * Loads persisted CRT calibration from localStorage or returns default.
 */
export function loadCRTCalibration(): CRTCalibrationConfig {
  if (typeof window === "undefined") {
    return { ...DEFAULT_CRT_CALIBRATION };
  }
  try {
    const raw = window.localStorage.getItem(CRT_CALIBRATION_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CRT_CALIBRATION };
    const parsed = JSON.parse(raw);
    return {
      scanlinesEnabled:
        typeof parsed.scanlinesEnabled === "boolean"
          ? parsed.scanlinesEnabled
          : DEFAULT_CRT_CALIBRATION.scanlinesEnabled,
      scanlineIntensity:
        typeof parsed.scanlineIntensity === "number"
          ? clamp(parsed.scanlineIntensity, 0, 1)
          : DEFAULT_CRT_CALIBRATION.scanlineIntensity,
      scanlineDensity:
        typeof parsed.scanlineDensity === "number"
          ? clamp(Math.round(parsed.scanlineDensity), 1, 4)
          : DEFAULT_CRT_CALIBRATION.scanlineDensity,
      phosphorMask: [
        "none",
        "aperture-grille",
        "shadow-mask",
        "monochrome-dot",
      ].includes(parsed.phosphorMask)
        ? parsed.phosphorMask
        : DEFAULT_CRT_CALIBRATION.phosphorMask,
      phosphorIntensity:
        typeof parsed.phosphorIntensity === "number"
          ? clamp(parsed.phosphorIntensity, 0, 1)
          : DEFAULT_CRT_CALIBRATION.phosphorIntensity,
      bloomIntensity:
        typeof parsed.bloomIntensity === "number"
          ? clamp(parsed.bloomIntensity, 0, 1)
          : DEFAULT_CRT_CALIBRATION.bloomIntensity,
      curvature:
        typeof parsed.curvature === "number"
          ? clamp(parsed.curvature, 0, 1)
          : DEFAULT_CRT_CALIBRATION.curvature,
      vignetteIntensity:
        typeof parsed.vignetteIntensity === "number"
          ? clamp(parsed.vignetteIntensity, 0, 1)
          : DEFAULT_CRT_CALIBRATION.vignetteIntensity,
      flickerShimmer:
        typeof parsed.flickerShimmer === "boolean"
          ? parsed.flickerShimmer
          : DEFAULT_CRT_CALIBRATION.flickerShimmer,
    };
  } catch {
    return { ...DEFAULT_CRT_CALIBRATION };
  }
}

/**
 * Saves CRT calibration configuration to localStorage.
 */
export function saveCRTCalibration(config: CRTCalibrationConfig): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      CRT_CALIBRATION_STORAGE_KEY,
      JSON.stringify(config)
    );
    window.dispatchEvent(new Event("crt-calibration-changed"));
  } catch {
    // Ignore storage errors
  }
}

// In-memory pattern canvas cache to avoid per-frame CPU allocation
const patternCanvasCache: Partial<Record<string, HTMLCanvasElement>> = {};

/**
 * Generates an offscreen pattern canvas representing a microscopic CRT phosphor triad or grille.
 */
export function getOrCreatePhosphorPattern(
  type: PhosphorMaskType,
  themeColor: string = "#10b981"
): HTMLCanvasElement | null {
  if (typeof document === "undefined" || type === "none") {
    return null;
  }

  const cacheKey = `${type}_${themeColor}`;
  if (patternCanvasCache[cacheKey]) {
    return patternCanvasCache[cacheKey]!;
  }

  try {
    const pCanvas = document.createElement("canvas");

    if (type === "aperture-grille") {
      // Trinitron style: vertical R, G, B subpixel lines
      pCanvas.width = 3;
      pCanvas.height = 1;
      const pCtx = pCanvas.getContext("2d");
      if (!pCtx) return null;

      pCtx.fillStyle = "rgba(255, 60, 60, 0.7)";
      pCtx.fillRect(0, 0, 1, 1);
      pCtx.fillStyle = "rgba(60, 255, 60, 0.7)";
      pCtx.fillRect(1, 0, 1, 1);
      pCtx.fillStyle = "rgba(70, 130, 255, 0.7)";
      pCtx.fillRect(2, 0, 1, 1);
    } else if (type === "shadow-mask") {
      // Arcade Shadow Mask: Staggered triad dots
      pCanvas.width = 4;
      pCanvas.height = 4;
      const pCtx = pCanvas.getContext("2d");
      if (!pCtx) return null;

      pCtx.fillStyle = "rgba(0, 0, 0, 0.85)";
      pCtx.fillRect(0, 0, 4, 4);

      pCtx.fillStyle = "rgba(255, 65, 65, 0.75)";
      pCtx.fillRect(0, 0, 1, 1);
      pCtx.fillStyle = "rgba(65, 255, 65, 0.75)";
      pCtx.fillRect(1, 0, 1, 1);
      pCtx.fillStyle = "rgba(80, 140, 255, 0.75)";
      pCtx.fillRect(0, 1, 1, 1);

      pCtx.fillStyle = "rgba(255, 65, 65, 0.75)";
      pCtx.fillRect(2, 2, 1, 1);
      pCtx.fillStyle = "rgba(65, 255, 65, 0.75)";
      pCtx.fillRect(3, 2, 1, 1);
      pCtx.fillStyle = "rgba(80, 140, 255, 0.75)";
      pCtx.fillRect(2, 3, 1, 1);
    } else if (type === "monochrome-dot") {
      // Monochrome CRT phosphor grain
      pCanvas.width = 2;
      pCanvas.height = 2;
      const pCtx = pCanvas.getContext("2d");
      if (!pCtx) return null;

      pCtx.fillStyle = "rgba(0, 0, 0, 0.8)";
      pCtx.fillRect(0, 0, 2, 2);
      pCtx.fillStyle = themeColor;
      pCtx.fillRect(0, 0, 1, 1);
    }

    patternCanvasCache[cacheKey] = pCanvas;
    return pCanvas;
  } catch {
    return null;
  }
}

/**
 * Checks whether user has requested reduced motion in their OS/browser settings.
 */
export function isReducedMotionPreferred(): boolean {
  return getMatchMediaMatches("(prefers-reduced-motion: reduce)");
}

/**
 * Applies calibrated CRT post-processing passes to a 2D canvas rendering context.
 *
 * @param ctx - The active CanvasRenderingContext2D.
 * @param width - The viewport width in pixels.
 * @param height - The viewport height in pixels.
 * @param config - CRT calibration parameters.
 * @param theme - Active CRT phosphor color theme.
 * @param frameCount - Animation tick frame count for subtle phosphor shimmer.
 */
export function renderCRTEffects(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  config: CRTCalibrationConfig,
  theme: CRTThemeConfig,
  frameCount: number = 0
): void {
  if (!ctx || width <= 0 || height <= 0) return;

  const isReducedMotion = isReducedMotionPreferred();
  const shimmer =
    config.flickerShimmer && !isReducedMotion
      ? Math.sin(frameCount * 0.08) * 0.015
      : 0;

  // 1. Phosphor Mask Overlay Pass
  if (config.phosphorMask !== "none" && config.phosphorIntensity > 0) {
    const patternCanvas = getOrCreatePhosphorPattern(
      config.phosphorMask,
      theme.primaryColor || "#10b981"
    );

    if (patternCanvas) {
      try {
        ctx.save();
        ctx.globalAlpha = clamp(config.phosphorIntensity + shimmer, 0, 1);
        const pattern = ctx.createPattern(patternCanvas, "repeat");
        if (pattern) {
          ctx.fillStyle = pattern;
          ctx.fillRect(0, 0, width, height);
        }
        ctx.restore();
      } catch {
        // Fallback for headless environments
      }
    }
  }

  // 2. Horizontal CRT Scanline Raster Pass
  if (config.scanlinesEnabled && config.scanlineIntensity > 0) {
    ctx.save();
    const alpha = clamp(config.scanlineIntensity + shimmer, 0, 1);
    ctx.fillStyle = `rgba(0, 0, 0, ${alpha.toFixed(3)})`;
    const step = Math.max(1, Math.round(config.scanlineDensity || 3));

    for (let y = 0; y < height; y += step) {
      ctx.fillRect(0, y, width, 1);
    }
    ctx.restore();
  }

  // 3. Multi-Pass Phosphor Bloom Glow
  if (config.bloomIntensity > 0.05) {
    ctx.save();
    const bloomAlpha = clamp(config.bloomIntensity * 0.25, 0, 0.3);
    const glowColor = theme.glowColor || "rgba(16, 185, 129, 0.4)";

    const bloomGrad = ctx.createRadialGradient(
      width / 2,
      height / 2,
      width * 0.1,
      width / 2,
      height / 2,
      width * 0.65
    );
    bloomGrad.addColorStop(0, glowColor.replace(/[\d.]+\)$/, `${bloomAlpha})`));
    bloomGrad.addColorStop(1, "rgba(0, 0, 0, 0)");

    ctx.fillStyle = bloomGrad;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  // 4. Dark Radial Vignette Falloff Pass
  if (config.vignetteIntensity > 0.05) {
    ctx.save();
    const maxVignetteAlpha = clamp(config.vignetteIntensity * 0.85, 0, 0.95);
    const vignette = ctx.createRadialGradient(
      width / 2,
      height / 2,
      width * 0.25,
      width / 2,
      height / 2,
      width * 0.72
    );
    vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
    vignette.addColorStop(
      0.7,
      `rgba(0, 0, 0, ${(maxVignetteAlpha * 0.5).toFixed(3)})`
    );
    vignette.addColorStop(1, `rgba(0, 0, 0, ${maxVignetteAlpha.toFixed(3)})`);

    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }
}
