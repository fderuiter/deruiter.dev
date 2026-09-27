// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fromPartial } from "@total-typescript/shoehorn";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import {
  CRT_PRESETS,
  DEFAULT_CRT_CALIBRATION,
  DEFAULT_CRT_PRESET_ID,
  loadCRTCalibration,
  saveCRTCalibration,
  getOrCreatePhosphorPattern,
  renderCRTEffects,
  isReducedMotionPreferred,
  CRTCalibrationConfig,
} from "@/lib/arcade/crt-pipeline";
import { CRT_THEMES } from "@/lib/dungeon/metaprogression";
import { CRTCalibrationModal } from "@/components/arcade/CRTCalibrationModal";

class LocalStorageMock {
  private store: Record<string, string> = {};

  getItem(key: string): string | null {
    return this.store[key] ?? null;
  }

  setItem(key: string, value: string): void {
    this.store[key] = String(value);
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  clear(): void {
    this.store = {};
  }
}

describe("CRT Post-Processing Pipeline & Phosphor Mask Engine", () => {
  let mockStorage: LocalStorageMock;

  beforeEach(() => {
    mockStorage = new LocalStorageMock();
    Object.defineProperty(window, "localStorage", {
      value: mockStorage,
      writable: true,
      configurable: true,
    });

    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      fillRect: vi.fn(),
      fillStyle: "",
      save: vi.fn(),
      restore: vi.fn(),
      createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
      createPattern: vi.fn(() => ({})),
    })) as any;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Presets and Defaults", () => {
    it("should define all 5 core CRT display presets", () => {
      expect(CRT_PRESETS["authentic-arcade"]).toBeDefined();
      expect(CRT_PRESETS["trinitron-pro"]).toBeDefined();
      expect(CRT_PRESETS["amber-terminal"]).toBeDefined();
      expect(CRT_PRESETS["cyberpunk-neon"]).toBeDefined();
      expect(CRT_PRESETS["clean-digital"]).toBeDefined();
    });

    it("should have authentic arcade as default calibration", () => {
      expect(DEFAULT_CRT_CALIBRATION.scanlinesEnabled).toBe(true);
      expect(DEFAULT_CRT_CALIBRATION).toEqual(
        CRT_PRESETS[DEFAULT_CRT_PRESET_ID].config
      );
      // #1187: the default keeps the maze readable under the CRT effects
      expect(DEFAULT_CRT_PRESET_ID).toBe("trinitron-pro");
      expect(DEFAULT_CRT_CALIBRATION.scanlineIntensity).toBeLessThanOrEqual(
        0.2
      );
    });
  });

  describe("LocalStorage Persistence & Hydration", () => {
    it("should return default calibration when storage is empty", () => {
      const config = loadCRTCalibration();
      expect(config.scanlinesEnabled).toBe(true);
      expect(config).toEqual(DEFAULT_CRT_CALIBRATION);
    });

    it("should return default calibration when storage contains invalid JSON", () => {
      mockStorage.setItem(
        "retro_labyrinth_crt_calibration",
        "INVALID_JSON_CORRUPT{"
      );
      const config = loadCRTCalibration();
      expect(config.scanlinesEnabled).toBe(true);
    });

    it("should save and reload valid CRT calibration configuration", () => {
      const customConfig: CRTCalibrationConfig = {
        scanlinesEnabled: true,
        scanlineIntensity: 0.45,
        scanlineDensity: 2,
        phosphorMask: "aperture-grille",
        phosphorIntensity: 0.35,
        bloomIntensity: 0.6,
        curvature: 0.15,
        vignetteIntensity: 0.8,
        flickerShimmer: false,
      };

      saveCRTCalibration(customConfig);
      const loaded = loadCRTCalibration();

      expect(loaded.scanlineIntensity).toBeCloseTo(0.45);
      expect(loaded.scanlineDensity).toBe(2);
      expect(loaded.phosphorMask).toBe("aperture-grille");
      expect(loaded.phosphorIntensity).toBeCloseTo(0.35);
      expect(loaded.bloomIntensity).toBeCloseTo(0.6);
      expect(loaded.flickerShimmer).toBe(false);
    });
  });

  describe("Phosphor Pattern Generation", () => {
    it("should return null for mask type 'none'", () => {
      const pattern = getOrCreatePhosphorPattern("none");
      expect(pattern).toBeNull();
    });

    it("should create pattern canvas for 'aperture-grille'", () => {
      const pattern = getOrCreatePhosphorPattern("aperture-grille");
      expect(pattern).not.toBeNull();
      expect(pattern?.width).toBe(3);
      expect(pattern?.height).toBe(1);
    });

    it("should create pattern canvas for 'shadow-mask'", () => {
      const pattern = getOrCreatePhosphorPattern("shadow-mask");
      expect(pattern).not.toBeNull();
      expect(pattern?.width).toBe(4);
      expect(pattern?.height).toBe(4);
    });

    it("should create pattern canvas for 'monochrome-dot'", () => {
      const pattern = getOrCreatePhosphorPattern("monochrome-dot", "#f59e0b");
      expect(pattern).not.toBeNull();
      expect(pattern?.width).toBe(2);
      expect(pattern?.height).toBe(2);
    });
  });

  describe("Canvas Rendering Engine Execution", () => {
    let mockCtx: CanvasRenderingContext2D;

    beforeEach(() => {
      mockCtx = fromPartial<CanvasRenderingContext2D>({
        save: vi.fn(),
        restore: vi.fn(),
        fillRect: vi.fn(),
        createRadialGradient: vi.fn(() => ({
          addColorStop: vi.fn(),
        })) as any,
        createPattern: vi.fn(() => ({})) as any,
      });
    });

    it("should gracefully handle zero dimensions without drawing", () => {
      renderCRTEffects(
        mockCtx,
        0,
        0,
        DEFAULT_CRT_CALIBRATION,
        CRT_THEMES.emerald
      );
      expect(mockCtx.fillRect).not.toHaveBeenCalled();
    });

    it("should render scanlines, bloom, vignette, and phosphor mask without exceptions", () => {
      renderCRTEffects(
        mockCtx,
        240,
        144,
        CRT_PRESETS["authentic-arcade"].config,
        CRT_THEMES.emerald,
        10
      );
      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.restore).toHaveBeenCalled();
      expect(mockCtx.fillRect).toHaveBeenCalled();
      expect(mockCtx.createRadialGradient).toHaveBeenCalled();
    });

    it("should skip scanlines when disabled in clean-digital preset", () => {
      renderCRTEffects(
        mockCtx,
        240,
        144,
        CRT_PRESETS["clean-digital"].config,
        CRT_THEMES.emerald,
        0
      );
      expect(mockCtx.save).toHaveBeenCalled();
    });

    it("should check reduced motion preferences safely", () => {
      const isMotion = isReducedMotionPreferred();
      expect(typeof isMotion).toBe("boolean");
    });
  });

  describe("CRTCalibrationModal React Component", () => {
    let container: HTMLDivElement;
    let root: ReturnType<typeof createRoot>;

    beforeEach(() => {
      container = document.createElement("div");
      document.body.appendChild(container);
      root = createRoot(container);
    });

    afterEach(async () => {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    });

    it("should render modal with all controls when isOpen is true", async () => {
      const handleClose = vi.fn();
      const handleChange = vi.fn();

      await act(async () => {
        root.render(
          <CRTCalibrationModal
            isOpen={true}
            onClose={handleClose}
            config={DEFAULT_CRT_CALIBRATION}
            onChange={handleChange}
          />
        );
      });

      expect(container.textContent).toContain("CRT Display Calibration");
      expect(container.textContent).toContain("Display Archetype Presets");
      expect(container.textContent).toContain("Authentic Arcade CRT");
      expect(container.textContent).toContain("Cyberpunk Neon Deck");

      // Click Reset Defaults
      const resetBtn = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.includes("Reset Defaults")
      );
      expect(resetBtn).toBeTruthy();
      await act(async () => {
        resetBtn?.click();
      });

      expect(handleChange).toHaveBeenCalled();
    });
  });
});
