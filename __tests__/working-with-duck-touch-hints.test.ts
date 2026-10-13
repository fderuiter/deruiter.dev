// @vitest-environment jsdom
//
// #2039: the canvas names the tap, not the key, in the touch cabinet.

import { describe, it, expect, vi } from "vitest";
import { fromAny } from "@total-typescript/shoehorn";
import { drawOfficeScene } from "@/components/working-with-duck/office-art";
import { createInitialDuckGameState } from "@/lib/working-with-duck-engine";

function mockCtx() {
  const gradient = () => ({ addColorStop: vi.fn() });
  return {
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    bezierCurveTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    arcTo: vi.fn(),
    arc: vi.fn(),
    ellipse: vi.fn(),
    roundRect: vi.fn(),
    rect: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillText: vi.fn(),
    strokeText: vi.fn(),
    setLineDash: vi.fn(),
    measureText: vi.fn(() => ({ width: 40 })),
    createLinearGradient: vi.fn(gradient),
    createRadialGradient: vi.fn(gradient),
  };
}

/** Every string the frame wrote with fillText. */
function drawnText(touchHints: boolean | undefined) {
  const ctx = mockCtx();
  const state = createInitialDuckGameState(1);
  drawOfficeScene(fromAny(ctx), state, 1, touchHints);
  return ctx.fillText.mock.calls.map(([text]) => String(text));
}

describe("Working With Duck canvas hints (#2039)", () => {
  it("names the sprint by its tap in the touch cabinet", () => {
    const text = drawnText(true);
    expect(text).toContain("Work Sprint");
    expect(text.some((t) => t.includes("Space"))).toBe(false);
  });

  it("keeps the keyboard wording outside the touch cabinet", () => {
    const text = drawnText(false);
    expect(text).toContain("Space: focus sprint");
    expect(text).not.toContain("Work Sprint");
  });

  it("names the tap in the No Take bubble in the touch cabinet", () => {
    const ctx = mockCtx();
    const state = createInitialDuckGameState(1);
    state.duck.state = "NO_TAKE_THROW";
    drawOfficeScene(fromAny(ctx), state, 1, true);
    const text = ctx.fillText.mock.calls.map(([t]) => String(t));
    expect(text).toContain("No take! Tap Treat or Drop It");
    expect(text.some((t) => t.includes("Press 4"))).toBe(false);
  });
});
