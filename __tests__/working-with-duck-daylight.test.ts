// @vitest-environment jsdom
//
// #1677: the office light follows the sprint. It is gold in the morning,
// plain at midday and dusky with a desk-lamp pool near the deadline, and
// each step's gradients are built once per context.

import { describe, it, expect, vi } from "vitest";
import { fromAny } from "@total-typescript/shoehorn";
import { drawOfficeScene } from "@/components/working-with-duck/office-art";
import { createInitialDuckGameState } from "@/lib/working-with-duck-engine";

function mockCtx() {
  // Typed so the radii of each call can be read back.
  const gradient = (..._args: number[]) => ({ addColorStop: vi.fn() });
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

function atProgress(fraction: number) {
  const state = createInitialDuckGameState(1);
  return { ...state, workProgress: state.targetWorkProgress * fraction };
}

describe("Working With Duck office daylight (#1677)", () => {
  it("adds a desk-lamp pool only as the deadline nears", () => {
    const midday = mockCtx();
    drawOfficeScene(fromAny(midday), atProgress(0.5));
    const lampCallsAtMidday = midday.createRadialGradient.mock.calls.filter(
      ([, , r0, , , r1]) => r0 === 10 && r1 === 150
    );
    expect(lampCallsAtMidday).toHaveLength(0);

    const dusk = mockCtx();
    drawOfficeScene(fromAny(dusk), atProgress(0.95));
    const lampCallsAtDusk = dusk.createRadialGradient.mock.calls.filter(
      ([, , r0, , , r1]) => r0 === 10 && r1 === 150
    );
    expect(lampCallsAtDusk).toHaveLength(1);
  });

  it("reuses a step's gradients on later frames", () => {
    const ctx = mockCtx();
    drawOfficeScene(fromAny(ctx), atProgress(0.95));
    const first = ctx.createRadialGradient.mock.calls.length;
    drawOfficeScene(fromAny(ctx), atProgress(0.95));
    const lampCalls = ctx.createRadialGradient.mock.calls
      .slice(first)
      .filter(([, , r0, , , r1]) => r0 === 10 && r1 === 150);
    expect(lampCalls).toHaveLength(0);
  });
});
