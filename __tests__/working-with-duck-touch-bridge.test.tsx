// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { fireEvent } from "@testing-library/react";
import { CabinetTouchContext } from "@/components/arcade/mobile";
import {
  createInitialDuckGameState,
  enterDogPark,
  type WorkingWithDuckState,
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
      manualPause: false,
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

describe("Working With Duck: keys and touch run the same game (#2039 round 2)", () => {
  let container: HTMLDivElement;
  let root: Root;
  let bridge: DuckTouchBridge;

  /** Mounts the game fresh, optionally inside the touch cabinet context. */
  async function mountGame(state: WorkingWithDuckState, inCabinet = false) {
    await act(async () => {
      root.render(
        <CabinetTouchContext.Provider value={inCabinet}>
          <DuckTouchProvider bridge={bridge}>
            <WorkingWithDuck initialState={state} />
          </DuckTouchProvider>
        </CabinetTouchContext.Provider>
      );
    });
  }

  /** Unmounts and mounts a clean container, so each path starts from the same state. */
  function freshRoot() {
    act(() => {
      root.unmount();
    });
    container.remove();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  }

  function focusGame() {
    const boundary = container.querySelector<HTMLElement>(
      '[data-keyboard-boundary="true"]'
    );
    expect(boundary).not.toBeNull();
    act(() => {
      boundary!.focus();
    });
    return boundary!;
  }

  beforeEach(() => {
    // No animation frames: the sprint clock stays still, so the two paths
    // can be compared frame for frame.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-13T12:00:00Z"));
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 0);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    bridge = createDuckTouchBridge();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  /** Kong is held, so the 1 key changes the selection and shows it. */
  const paritySprint = () => ({
    ...runningOffice(),
    selectedItem: "kong" as const,
  });

  it.each<[string, string, "toy-1" | "trick-sit" | "space"]>([
    ["the 1 key", "1", "toy-1"],
    ["the Q key", "q", "trick-sit"],
    ["the Space key", " ", "space"],
  ])(
    "%s and its touch command leave the same game state",
    async (_label, key, command) => {
      await mountGame(paritySprint());
      const baseline = container.innerHTML;

      freshRoot();
      await mountGame(paritySprint());
      const boundary = focusGame();
      fireEvent.keyDown(boundary, {
        key,
        code: key === " " ? "Space" : undefined,
      });
      const viaKey = container.innerHTML;

      freshRoot();
      await mountGame(paritySprint());
      act(() => bridge.run(command));
      const viaTouch = container.innerHTML;

      // The action did something, and both paths did the same thing.
      expect(viaKey).not.toBe(baseline);
      expect(viaTouch).toBe(viaKey);
    }
  );

  it("ignores every command but pause while the sprint is paused", async () => {
    const paused = { ...runningOffice(), status: "paused" as const };
    await mountGame(paused);
    const before = container.innerHTML;

    act(() => {
      bridge.run("toy-1");
      bridge.run("treat");
      bridge.run("trick-sit");
      bridge.run("space");
      bridge.run("steer-up");
      bridge.run("auto-pause");
    });

    expect(container.innerHTML).toBe(before);
  });

  it("draws the game's own duplicate deck outside the cabinet, and not inside it", async () => {
    const hasButton = (label: string) =>
      Array.from(container.querySelectorAll("button")).some((b) =>
        b.textContent?.includes(label)
      );

    await mountGame(runningOffice(), false);
    expect(hasButton("Toys")).toBe(true);
    expect(hasButton("Focus Work Sprint")).toBe(true);
    const outsideStage = container.querySelector("canvas")?.parentElement;
    expect(outsideStage?.className).not.toContain("justify-end");
    const outsideChips = container.querySelector(
      '[aria-label="Duck Companion Interactive Actions"]'
    );
    expect(outsideChips?.hasAttribute("hidden")).toBe(false);
    expect(
      container.querySelector('[data-testid="duck-cabinet-actions"]')
    ).toBeNull();

    freshRoot();
    await mountGame(runningOffice(), true);
    expect(hasButton("Toys")).toBe(false);
    expect(hasButton("Focus Work Sprint")).toBe(false);
    expect(hasButton("Jump Hurdle")).toBe(false);
    // The actions with no dock control stay, in one compact row.
    expect(hasButton("Dog Park")).toBe(true);
    expect(hasButton("Bathtub")).toBe(true);
    const row = container.querySelector('[data-testid="duck-cabinet-actions"]');
    expect(row?.getAttribute("role")).toBe("group");
    expect(row?.querySelectorAll("button").length).toBeGreaterThanOrEqual(4);
    // The stage anchors the room to its bottom, and the game's own chips
    // (screen-reader copies of the dock) leave the layout and taps.
    const insideStage = container.querySelector("canvas")?.parentElement;
    expect(insideStage?.className).toContain("justify-end");
    const insideChips = container.querySelector(
      '[aria-label="Duck Companion Interactive Actions"]'
    );
    expect(insideChips?.hasAttribute("hidden")).toBe(true);
  });
});
