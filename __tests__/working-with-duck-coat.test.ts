import { fromAny } from "@total-typescript/shoehorn";
import { describe, expect, it } from "vitest";
import { drawBathtubScene } from "@/components/working-with-duck/bath-art";
import {
  DUCK_COAT,
  DUCK_MUD,
  DUCK_WET_COAT,
} from "@/components/working-with-duck/duck-art";
import { drawDuck } from "@/components/working-with-duck/office-art";
import {
  createInitialDuckGameState,
  enterBathtub,
  rinseBathtub,
  scrubBathtub,
  type WorkingWithDuckState,
} from "@/lib/working-with-duck-engine";

/** A canvas stub that records every colour used for a fill. */
function recordingContext() {
  const fills: string[] = [];
  const gradient = () => ({ addColorStop: () => {} });
  const target: Record<string, unknown> = {
    measureText: (text: string) => ({ width: (text || "").length * 8 }),
    createLinearGradient: gradient,
    createRadialGradient: gradient,
    fill: () => fills.push(String(target.fillStyle)),
    fillRect: () => fills.push(String(target.fillStyle)),
    fillText: () => {},
  };
  const ctx = new Proxy(target, {
    get: (t, key: string) => (key in t ? t[key] : () => {}),
    set: (t, key: string, value) => {
      t[key] = value;
      return true;
    },
  });
  return { ctx: fromAny<CanvasRenderingContext2D, typeof ctx>(ctx), fills };
}

/** Lightness and chroma (0 to 1): gold has high chroma, cream has little. */
function lightnessAndChroma(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return { l: (max + min) / 2, chroma: max - min };
}

const MUD = [DUCK_MUD.dark, DUCK_MUD.mid];

describe("Duck's English Cream coat (#1707)", () => {
  it.each([
    ["clean", DUCK_COAT],
    ["wet", DUCK_WET_COAT],
  ])("keeps the %s coat pale and unsaturated, never golden", (_, coat) => {
    for (const color of [coat.base, coat.light, coat.shade, coat.ear]) {
      const { l, chroma } = lightnessAndChroma(color);
      expect(l).toBeGreaterThan(0.72);
      // The old golden coat (#e0a458) had a chroma of 0.53
      expect(chroma).toBeLessThan(0.18);
    }
  });

  it("paints a muddy Duck in his cream coat with mud on top", () => {
    const clean = recordingContext();
    drawDuck(
      clean.ctx,
      { x: 200, y: 200, angle: 0, state: "IDLE_ROAM", isCarryingBall: false },
      { ticks: 0 }
    );
    expect(clean.fills).toContain(DUCK_COAT.base);
    expect(clean.fills.some((c) => MUD.includes(c))).toBe(false);

    const muddy = recordingContext();
    drawDuck(
      muddy.ctx,
      { x: 200, y: 200, angle: 0, state: "IDLE_ROAM", isCarryingBall: false },
      { ticks: 0, isMuddy: true }
    );
    expect(muddy.fills).toContain(DUCK_COAT.base);
    expect(muddy.fills.some((c) => MUD.includes(c))).toBe(true);
  });
});

describe("Duck's bath (#1707)", () => {
  const muddyBath = (): WorkingWithDuckState =>
    enterBathtub({
      ...createInitialDuckGameState(),
      status: "running",
      isMuddy: true,
    });

  function paint(state: WorkingWithDuckState) {
    const rec = recordingContext();
    drawBathtubScene(rec.ctx, state);
    return rec.fills;
  }

  it("draws the shared wet coat, with mud until he is rinsed", () => {
    let state = muddyBath();
    const dirty = paint(state);
    expect(dirty).toContain(DUCK_WET_COAT.base);
    expect(dirty.some((c) => MUD.includes(c))).toBe(true);

    for (let i = 0; i < 9; i++) state = scrubBathtub(state, 400, 240);
    for (let i = 0; i < 4; i++) state = rinseBathtub(state);
    const clean = paint(state);
    expect(clean).toContain(DUCK_WET_COAT.base);
    expect(clean.some((c) => MUD.includes(c))).toBe(false);
  });

  it("only foams up once Duck has been scrubbed", () => {
    let state = muddyBath();
    const foamBefore = paint({
      ...state,
      bathtubState: { ...state.bathtubState, bubbles: [] },
    }).filter((c) => c === "#ffffff").length;
    for (let i = 0; i < 5; i++) state = scrubBathtub(state, 400, 240);
    const foamAfter = paint({
      ...state,
      bathtubState: { ...state.bathtubState, bubbles: [] },
    }).filter((c) => c === "#ffffff").length;
    expect(foamAfter).toBeGreaterThan(foamBefore);
  });

  it("leaves the bath state untouched while drawing", () => {
    const state = muddyBath();
    const snapshot = JSON.stringify(state);
    paint(state);
    expect(JSON.stringify(state)).toBe(snapshot);
  });
});
