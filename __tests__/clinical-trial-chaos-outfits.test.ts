// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import {
  OUTFITS,
  DEFAULT_OUTFIT_ID,
  getOutfitById,
  drawOutfitAvatar,
  AvatarCanvas,
} from "../lib/clinical-trial-chaos";

function createMockCanvas() {
  return {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
  } satisfies AvatarCanvas;
}

describe("Clinical Trial Chaos - Outfits", () => {
  it("declares unique outfits with valid hex palettes and clock-in lines", () => {
    const ids = OUTFITS.map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const outfit of OUTFITS) {
      expect(outfit.clockInLine.length).toBeGreaterThan(0);
      for (const color of Object.values(outfit.palette)) {
        expect(color).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });

  it("falls back to the default outfit for unknown ids", () => {
    expect(getOutfitById("tuxedo").id).toBe(DEFAULT_OUTFIT_ID);
    expect(getOutfitById(undefined).id).toBe(DEFAULT_OUTFIT_ID);
    expect(getOutfitById("lab-coat").name).toContain("Lab Coat");
  });

  it("draws every outfit inside its declared bounds", () => {
    for (const outfit of OUTFITS) {
      const ctx = createMockCanvas();
      drawOutfitAvatar(ctx, 100, 200, outfit, 2);
      expect(ctx.fillRect).toHaveBeenCalled();
      expect(ctx.arc).toHaveBeenCalled();

      // Sprite spans 22 x 44 units around (x, baseY); allow the hand radius.
      for (const [rx, ry, rw, rh] of ctx.fillRect.mock.calls) {
        expect(rx).toBeGreaterThanOrEqual(100 - 12 * 2);
        expect(rx + rw).toBeLessThanOrEqual(100 + 12 * 2);
        expect(ry).toBeGreaterThanOrEqual(200 - 45 * 2);
        expect(ry + rh).toBeLessThanOrEqual(200);
      }
    }
  });

  it("draws the distinguishing details of an outfit", () => {
    const pyjamas = createMockCanvas();
    drawOutfitAvatar(pyjamas, 0, 0, getOutfitById("wfh-mullet"));
    const plain = createMockCanvas();
    drawOutfitAvatar(plain, 0, 0, getOutfitById("borrowed-scrubs"));
    expect(pyjamas.fillRect.mock.calls.length).toBeGreaterThan(
      plain.fillRect.mock.calls.length
    );
    expect(pyjamas.stroke).toHaveBeenCalled(); // headset
  });
});
