// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  ArcadeViewport,
  screenToGameCoords,
  type ViewportMetrics,
} from "@/lib/arcade";
import { fromPartial } from "@total-typescript/shoehorn";

describe("ArcadeViewport - Safe Zone & Bleed Matrix", () => {
  it("calculates centered safe zone scale and offsets for 16:9 safe zone in 16:9 display", () => {
    const viewport = new ArcadeViewport({
      mode: "safe-zone",
      baseWidth: 1920,
      baseHeight: 1080,
      maxDpr: 2.0,
    });

    const metrics = viewport.calculateMetrics(1920, 1080, 2.0);

    expect(metrics.dpr).toBe(2.0);
    expect(metrics.scale).toBe(1.0);
    expect(metrics.offsetX).toBe(0);
    expect(metrics.offsetY).toBe(0);
    expect(metrics.internalWidth).toBe(3840);
    expect(metrics.internalHeight).toBe(2160);
  });

  it("calculates letterbox offsets when viewport is wider than safe zone (ultrawide)", () => {
    const viewport = new ArcadeViewport({
      mode: "safe-zone",
      baseWidth: 1920,
      baseHeight: 1080,
      maxDpr: 2.0,
    });

    // Viewport width 2560 (21:9), height 1080
    const metrics = viewport.calculateMetrics(2560, 1080, 1.0);

    expect(metrics.scale).toBe(1.0); // limited by height
    expect(metrics.offsetX).toBe((2560 - 1920) / 2); // 320px left bleed
    expect(metrics.offsetY).toBe(0);
    expect(metrics.bleedWidth).toBe(2560);
    expect(metrics.bleedHeight).toBe(1080);
  });

  it("calculates letterbox offsets when viewport is taller than safe zone (pillarbox)", () => {
    const viewport = new ArcadeViewport({
      mode: "safe-zone",
      baseWidth: 800,
      baseHeight: 500,
      maxDpr: 2.0,
    });

    // iPad / squarish: width 800, height 800
    const metrics = viewport.calculateMetrics(800, 800, 1.0);

    expect(metrics.scale).toBe(1.0); // limited by width
    expect(metrics.offsetX).toBe(0);
    expect(metrics.offsetY).toBe((800 - 500) / 2); // 150px top/bottom bleed
  });

  it("clamps DPR to maxDpr", () => {
    const viewport = new ArcadeViewport({
      mode: "safe-zone",
      baseWidth: 1920,
      baseHeight: 1080,
      maxDpr: 1.5,
    });

    const metrics = viewport.calculateMetrics(1920, 1080, 3.0); // iPhone 3x DPR
    expect(metrics.dpr).toBe(1.5);
  });
});

describe("ArcadeViewport - Integer Scaled Letterboxing", () => {
  it("calculates exact integer multiplier for pixel art / retro games", () => {
    const viewport = new ArcadeViewport({
      mode: "integer-letterbox",
      baseWidth: 240,
      baseHeight: 144,
      maxDpr: 1.0,
    });

    // Available screen: 720 x 480 -> integer scale = floor(min(720/240=3, 480/144=3.33)) = 3
    const metrics = viewport.calculateMetrics(720, 480, 1.0);

    expect(metrics.scale).toBe(3);
    expect(metrics.canvasWidth).toBe(720);
    expect(metrics.canvasHeight).toBe(432);
    expect(metrics.offsetX).toBe(0);
    expect(metrics.offsetY).toBe((480 - 432) / 2); // 24px top/bottom
  });

  it("clamps minimum integer scale to 1 when screen is smaller than base dimensions", () => {
    const viewport = new ArcadeViewport({
      mode: "integer-letterbox",
      baseWidth: 240,
      baseHeight: 144,
    });

    const metrics = viewport.calculateMetrics(200, 100, 1.0);
    expect(metrics.scale).toBe(1);
  });
});

describe("screenToGameCoords (Coordinate Inverse Transform)", () => {
  it("inverts mouse client coordinates accurately into safe zone game coordinates", () => {
    const metrics: ViewportMetrics = {
      dpr: 2.0,
      scale: 0.5,
      offsetX: 50,
      offsetY: 25,
      internalWidth: 800,
      internalHeight: 500,
      canvasWidth: 400,
      canvasHeight: 250,
      bleedWidth: 800,
      bleedHeight: 500,
    };

    const mockRect = fromPartial<DOMRect>({
      left: 100,
      top: 50,
      width: 400,
      height: 250,
    });

    // Click in center of screen
    // clientX = rect.left (100) + offsetX (50) + (safeWidth (800) * scale (0.5)) / 2 (200) = 350
    // clientY = rect.top (50) + offsetY (25) + (safeHeight (500) * scale (0.5)) / 2 (125) = 200
    const coords = screenToGameCoords(350, 200, mockRect, metrics);

    expect(coords.x).toBeCloseTo(400, 2); // exactly center (400)
    expect(coords.y).toBeCloseTo(250, 2); // exactly center (250)
  });

  it("handles zero division defensively when rect or scale is zero", () => {
    const metrics: ViewportMetrics = {
      dpr: 1.0,
      scale: 0,
      offsetX: 0,
      offsetY: 0,
      internalWidth: 800,
      internalHeight: 500,
      canvasWidth: 0,
      canvasHeight: 0,
      bleedWidth: 800,
      bleedHeight: 500,
    };

    const mockRect = fromPartial<DOMRect>({
      left: 0,
      top: 0,
      width: 0,
      height: 0,
    });

    const coords = screenToGameCoords(100, 100, mockRect, metrics);
    expect(Number.isFinite(coords.x)).toBe(true);
    expect(Number.isFinite(coords.y)).toBe(true);
  });
});
