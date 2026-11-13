// @vitest-environment jsdom
import fs from "node:fs";
import path from "node:path";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fromAny } from "@total-typescript/shoehorn";
import {
  advanceToNextLevel,
  createInitialDuckGameState,
  equipAccessory,
  stepDuckGame,
  stepParkGame,
  type DuckBehaviorState,
} from "@/lib/working-with-duck-engine";
import { DuckCommandInputSchema } from "@/lib/services";
import { drawDuck } from "@/components/working-with-duck/office-art";
import { drawBathtubScene } from "@/components/working-with-duck/bath-art";

Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);

class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

class MockIntersectionObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

Reflect.set(globalThis, "ResizeObserver", MockResizeObserver);
Reflect.set(globalThis, "IntersectionObserver", MockIntersectionObserver);

function makeMockCtx(): {
  ctx: CanvasRenderingContext2D;
  fills: string[];
  strokes: string[];
} {
  const fills: string[] = [];
  const strokes: string[] = [];
  let currentFill = "";
  let currentStroke = "";

  const ctx = {
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    fillRect: vi.fn(() => {
      fills.push(currentFill);
    }),
    strokeRect: vi.fn(() => {
      strokes.push(currentStroke);
    }),
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
    clip: vi.fn(),
    fill: vi.fn(() => {
      fills.push(currentFill);
    }),
    stroke: vi.fn(() => {
      strokes.push(currentStroke);
    }),
    fillText: vi.fn(),
    measureText: vi.fn(() => ({ width: 40 })),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    setLineDash: vi.fn(),
    get fillStyle() {
      return currentFill;
    },
    set fillStyle(val: string | CanvasGradient | CanvasPattern) {
      currentFill = typeof val === "string" ? val : "gradient";
    },
    get strokeStyle() {
      return currentStroke;
    },
    set strokeStyle(val: string | CanvasGradient | CanvasPattern) {
      currentStroke = typeof val === "string" ? val : "gradient";
    },
    lineWidth: 1,
    lineCap: "butt",
    globalAlpha: 1,
    font: "10px monospace",
    textAlign: "left",
    shadowColor: "transparent",
    shadowBlur: 0,
  };

  return {
    ctx: fromAny(ctx),
    fills,
    strokes,
  };
}

let sharedMockCtx = makeMockCtx().ctx;

HTMLCanvasElement.prototype.getContext = fromAny(vi.fn(() => sharedMockCtx));
HTMLCanvasElement.prototype.getBoundingClientRect = vi.fn(() => ({
  left: 0,
  top: 0,
  width: 800,
  height: 500,
  right: 800,
  bottom: 500,
  x: 0,
  y: 0,
  toJSON: () => ({}),
}));

vi.mock("@/components/providers/AudioProvider", () => ({
  useAudio: () => ({
    playNote: vi.fn(),
    playSuccess: vi.fn(),
    playHover: vi.fn(),
    volume: 0.8,
    muted: false,
    profile: "8-bit",
    setVolume: vi.fn(),
    setMuted: vi.fn(),
    setProfile: vi.fn(),
  }),
  AudioProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock("@/hooks/useTelemetry", () => ({
  useTelemetry: () => ({
    recordEvent: vi.fn().mockResolvedValue(true),
  }),
}));

import { WorkingWithDuck } from "@/components/WorkingWithDuck";

class MockStorage implements Storage {
  private store: Record<string, string> = {};
  get length() {
    return Object.keys(this.store).length;
  }
  clear() {
    this.store = {};
  }
  getItem(key: string) {
    return Object.prototype.hasOwnProperty.call(this.store, key)
      ? this.store[key]
      : null;
  }
  key(index: number) {
    return Object.keys(this.store)[index] ?? null;
  }
  removeItem(key: string) {
    delete this.store[key];
  }
  setItem(key: string, value: string) {
    this.store[key] = String(value);
  }
}

let mockStorage = new MockStorage();

describe("Working With Duck Blue Vet Cone asset & mechanics", () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  beforeEach(() => {
    vi.useFakeTimers();
    mockStorage = new MockStorage();
    Object.defineProperty(globalThis, "localStorage", {
      value: mockStorage,
      configurable: true,
    });
    sharedMockCtx = makeMockCtx().ctx;
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
      root = null;
    }
    container?.remove();
    container = null;
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("includes a valid SVG vector asset at public/duck/duck-cone.svg", () => {
    const svgPath = path.join(process.cwd(), "public", "duck", "duck-cone.svg");
    expect(fs.existsSync(svgPath)).toBe(true);
    const svg = fs.readFileSync(svgPath, "utf-8");
    expect(svg).toContain("<svg");
    expect(svg).toContain('viewBox="0 0 500 500"');
    expect(svg).toContain("#0284c7");
    expect(svg).toContain("#38bdf8");
    expect(svg).toContain("VET RX");
  });

  it("unlocks blue-cone on Sprint 1, validates command schemas, and persists on level advance", () => {
    const initial = createInitialDuckGameState(1);
    expect(
      DuckCommandInputSchema.safeParse({
        type: "accessory",
        state: initial,
        accessory: "blue-cone",
      }).success
    ).toBe(true);
    expect(initial.activeAccessory).toBe("none");
    expect(initial.unlockedAccessories).toContain("blue-cone");

    const equipped = equipAccessory(initial, "blue-cone");
    expect(equipped.activeAccessory).toBe("blue-cone");
    expect(equipped.soundCueQueue).toContain("ding");
    expect(equipped.soundCueQueue).toContain("cone-bonk");
    expect(
      equipped.floatingAlerts.some((a) => a.text.includes("Cone of Shame"))
    ).toBe(true);

    const advanced = advanceToNextLevel({ ...equipped, status: "won" });
    expect(advanced.activeAccessory).toBe("blue-cone");
    expect(advanced.unlockedAccessories).toContain("blue-cone");
  });

  it("adds +0.15x Satellite Dish Wi-Fi multiplier while equipped", () => {
    const base = createInitialDuckGameState(1);
    const plainNext = stepDuckGame({
      ...base,
      status: "running",
      activeAccessory: "none",
    });
    const coneNext = stepDuckGame({
      ...base,
      status: "running",
      activeAccessory: "blue-cone",
    });

    expect(coneNext.multiplier - plainNext.multiplier).toBeCloseTo(0.15, 6);
  });

  it("blocks sneaky cable chews with a *CLONK!* instead of damaging the prop", () => {
    const base = createInitialDuckGameState(2);
    const target = base.hazards[0];
    const readyToChew = {
      ...base,
      status: "running" as const,
      activeAccessory: "blue-cone" as const,
      activeHazardTarget: target.id,
      duck: {
        ...base.duck,
        x: target.x,
        y: target.y,
        state: "SNEAKY_CHEW" as const,
        stateTimer: 1,
        maxStateTimer: 100,
      },
    };

    const next = stepDuckGame(readyToChew);
    const updatedHazard = next.hazards.find((h) => h.id === target.id);

    expect(updatedHazard?.isChewed).toBe(false);
    expect(next.activeHazardTarget).toBeNull();
    expect(next.duck.state).toBe("IDLE_ROAM");
    expect(next.soundCueQueue).toContain("cone-bonk");
    expect(next.totalScore).toBeGreaterThanOrEqual(readyToChew.totalScore + 25);
    expect(next.floatingAlerts.some((a) => a.text.includes("*CLONK!*"))).toBe(
      true
    );
    expect(
      next.particles.some((p) => p.shape === "star" && p.color === "#38bdf8")
    ).toBe(true);
  });

  it("emits *BONK!* wall-slam feedback during Zoomies and comedic quips in Idle Roam", () => {
    const base = createInitialDuckGameState(1);
    const zoomies = stepDuckGame({
      ...base,
      status: "running",
      activeAccessory: "blue-cone",
      duck: {
        ...base.duck,
        x: 52,
        y: 250,
        vx: -5,
        vy: 0,
        state: "ZOOMIES",
        stateTimer: 60,
        maxStateTimer: 60,
      },
    });

    expect(zoomies.soundCueQueue).toContain("cone-bonk");
    expect(zoomies.duck.vx).toBeGreaterThan(0);
    expect(zoomies.floatingAlerts.some((a) => a.text.includes("*BONK!*"))).toBe(
      true
    );

    const idle = stepDuckGame({
      ...base,
      status: "running",
      activeAccessory: "blue-cone",
      ticks: 359,
      lastImpulseTick: 350,
      duck: {
        ...base.duck,
        state: "IDLE_ROAM",
        stateTimer: 100,
        maxStateTimer: 100,
      },
    });

    expect(
      idle.floatingAlerts.some(
        (a) =>
          a.color === "#38bdf8" &&
          (a.text.includes("Wi-Fi") ||
            a.text.toLowerCase().includes("doorframe") ||
            a.text.includes("Shame") ||
            a.text.includes("telemetry"))
      )
    ).toBe(true);
  });

  it("clanks the bowl when finishing water or kibble in the cone", () => {
    const base = createInitialDuckGameState(1);
    const drank = stepDuckGame({
      ...base,
      status: "running",
      activeAccessory: "blue-cone",
      lastImpulseTick: 0,
      thirst: 4,
      duck: {
        ...base.duck,
        x: 85,
        y: 380,
        state: "DRINKING_WATER",
        stateTimer: 1,
        maxStateTimer: 120,
      },
    });

    expect(drank.soundCueQueue).toContain("cone-bonk");
    expect(drank.floatingAlerts.some((a) => a.text.includes("*CLANK!*"))).toBe(
      true
    );
  });

  it("widens Dog Park bone-scooping radius while wearing the Blue Vet Cone", () => {
    const base = createInitialDuckGameState(1);
    const targetBone = base.parkState.bones[0];
    const parkSetup = {
      ...base,
      status: "running" as const,
      inDogPark: true,
      parkState: {
        ...base.parkState,
        status: "retrieving" as const,
        duckX: targetBone.x + 42,
        duckY: targetBone.y,
        bones: base.parkState.bones.map((b, idx) =>
          idx === 0 ? { ...b, collected: false } : { ...b, collected: true }
        ),
      },
    };

    const withoutCone = stepParkGame({
      ...parkSetup,
      activeAccessory: "none",
    });
    expect(withoutCone.parkState.bones[0].collected).toBe(false);

    const withCone = stepParkGame({
      ...parkSetup,
      activeAccessory: "blue-cone",
    });
    expect(withCone.parkState.bones[0].collected).toBe(true);
    expect(withCone.soundCueQueue).toContain("cone-bonk");
    expect(
      withCone.floatingAlerts.some((a) =>
        a.text.includes("Cone scooped a bone")
      )
    ).toBe(true);
  });

  it("draws the Blue Vet Cone cleanly across all poses and bath break", () => {
    const poses: DuckBehaviorState[] = [
      "IDLE_ROAM",
      "ZOOMIES",
      "SNIFFING_POTTY",
      "THE_FLOP",
      "NAP_TIME",
      "DRAGGED",
      "PERFORMING_TRICK",
    ];

    for (const behavior of poses) {
      const { ctx, fills, strokes } = makeMockCtx();
      drawDuck(
        ctx,
        { x: 400, y: 260, angle: 0, state: behavior, isCarryingBall: false },
        {
          ticks: 12,
          accessory: "blue-cone",
          trick: behavior === "PERFORMING_TRICK" ? "HIGH_FIVE" : null,
        }
      );
      expect(fills).toContain("rgba(56, 189, 248, 0.28)");
      expect(strokes).toContain("#0284c7");
    }

    const bath = makeMockCtx();
    const state = {
      ...createInitialDuckGameState(1),
      inBathtub: true,
      activeAccessory: "blue-cone" as const,
    };
    drawBathtubScene(bath.ctx, state);
    expect(bath.fills).toContain("rgba(2, 132, 199, 0.55)");
    expect(bath.strokes).toContain("#0369a1");
  });

  it("lists, displays preview SVG, equips, and persists Blue Vet Cone in the Wardrobe UI", () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root?.render(<WorkingWithDuck />);
    });

    const buttons = Array.from(container.querySelectorAll("button"));
    const wardrobeBtn = buttons.find(
      (b) =>
        b.textContent?.includes("Wardrobe") || b.title?.includes("Wardrobe")
    );
    expect(wardrobeBtn).toBeDefined();

    act(() => {
      wardrobeBtn?.click();
    });

    expect(container.textContent).toContain("Blue Vet Cone");
    const coneImg = container.querySelector('img[src="/duck/duck-cone.svg"]');
    expect(coneImg).not.toBeNull();

    const coneRadio = Array.from(
      container.querySelectorAll('[role="radio"]')
    ).find((el) => el.textContent?.includes("Blue Vet Cone")) as
      HTMLButtonElement | undefined;
    expect(coneRadio).toBeDefined();
    expect(coneRadio?.disabled).toBe(false);

    act(() => {
      coneRadio?.click();
    });

    expect(coneRadio?.getAttribute("aria-checked")).toBe("true");
    const savedAccessories = mockStorage.getItem(
      "working_with_duck_accessories"
    );
    expect(savedAccessories).not.toBeNull();
    expect(JSON.parse(savedAccessories ?? "{}").equipped).toBe("blue-cone");
  });
});
