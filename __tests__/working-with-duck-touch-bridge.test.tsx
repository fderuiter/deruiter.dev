// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  createInitialDuckGameState,
  enterDogPark,
} from "@/lib/working-with-duck-engine";
import {
  createDuckTouchBridge,
  DuckTouchProvider,
  type DuckTouchBridge,
} from "@/components/working-with-duck/touch-bridge";
import { fromAny } from "@total-typescript/shoehorn";

const testGlobals: { IS_REACT_ACT_ENVIRONMENT: boolean } = fromAny(globalThis);
testGlobals.IS_REACT_ACT_ENVIRONMENT = true;

global.ResizeObserver = fromAny(
  class {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  }
);

global.IntersectionObserver = fromAny(
  class {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  }
);

const mockCtx = {
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
  measureText: vi.fn(() => ({ width: 40 })),
  createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  setLineDash: vi.fn(),
};

HTMLCanvasElement.prototype.getContext = vi.fn(() => fromAny(mockCtx));
HTMLCanvasElement.prototype.getBoundingClientRect = vi.fn(() => ({
  left: 0,
  top: 0,
  width: 360,
  height: 225,
  right: 360,
  bottom: 225,
  x: 0,
  y: 0,
  toJSON: () => {},
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

const storageStore: Record<string, string> = {};
Object.defineProperty(globalThis, "localStorage", {
  value: {
    getItem: (k: string) => storageStore[k] || null,
    setItem: (k: string, v: string) => {
      storageStore[k] = String(v);
    },
    removeItem: (k: string) => {
      delete storageStore[k];
    },
    clear: () => {
      Object.keys(storageStore).forEach((k) => delete storageStore[k]);
    },
    key: () => null,
    length: 0,
  },
  writable: true,
});

/** A sprint already running, in the office. */
function runningOffice() {
  return {
    ...createInitialDuckGameState(1, "campaign"),
    status: "running" as const,
  };
}

describe("Working With Duck touch bridge (ADR 0061)", () => {
  let container: HTMLDivElement;
  let root: Root;
  let bridge: DuckTouchBridge;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    bridge = createDuckTouchBridge();
    vi.clearAllMocks();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("publishes the office scene, unpaused, once the game mounts", async () => {
    await act(async () => {
      root.render(
        <DuckTouchProvider bridge={bridge}>
          <WorkingWithDuck initialState={runningOffice()} />
        </DuckTouchProvider>
      );
    });

    expect(bridge.getSnapshot()).toEqual({
      scene: "office",
      aiming: false,
      paused: false,
    });
  });

  it("publishes the park scene during a dog park visit", async () => {
    const park = enterDogPark(runningOffice());
    await act(async () => {
      root.render(
        <DuckTouchProvider bridge={bridge}>
          <WorkingWithDuck initialState={park} />
        </DuckTouchProvider>
      );
    });

    expect(bridge.getSnapshot().scene).toBe("park");
  });

  it("pauses and resumes a running sprint through the pause command", async () => {
    await act(async () => {
      root.render(
        <DuckTouchProvider bridge={bridge}>
          <WorkingWithDuck initialState={runningOffice()} />
        </DuckTouchProvider>
      );
    });

    act(() => bridge.run("pause"));
    expect(bridge.getSnapshot().paused).toBe(true);

    act(() => bridge.run("pause"));
    expect(bridge.getSnapshot().paused).toBe(false);
  });

  it("pauses a running sprint on the cabinet's auto-pause, as P does", async () => {
    await act(async () => {
      root.render(
        <DuckTouchProvider bridge={bridge}>
          <WorkingWithDuck initialState={runningOffice()} />
        </DuckTouchProvider>
      );
    });

    act(() => bridge.run("auto-pause"));
    expect(bridge.getSnapshot().paused).toBe(true);
    // A second auto-pause while paused changes nothing: the player resumes.
    act(() => bridge.run("auto-pause"));
    expect(bridge.getSnapshot().paused).toBe(true);
  });

  it("stops taking commands once the game unmounts", async () => {
    await act(async () => {
      root.render(
        <DuckTouchProvider bridge={bridge}>
          <WorkingWithDuck initialState={runningOffice()} />
        </DuckTouchProvider>
      );
    });
    act(() => {
      root.unmount();
    });
    root = createRoot(container);
    expect(() => bridge.run("treat")).not.toThrow();
  });
});
