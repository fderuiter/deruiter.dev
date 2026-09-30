/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
//
// Regression coverage for #599: earned scrapbook (DUCK_FACTS) unlocks must
// survive advancement, retry, cabinet remount, and page reload instead of
// being silently replaced by the [1] default. Covers both the pure engine
// contract (createInitialDuckGameState/advanceToNextLevel) and the real
// <WorkingWithDuck /> component's localStorage seed/persist path.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createInitialDuckGameState,
  advanceToNextLevel,
  DUCK_FACTS,
} from "@/lib/working-with-duck-engine";
import type { WorkingWithDuckState } from "@/lib/working-with-duck-engine";

describe("Working With Duck engine - scrapbook unlock preservation (#599)", () => {
  it("seeds unlockedFacts from preservedFacts, always including the baseline id 1", () => {
    const state = createInitialDuckGameState(
      1,
      "campaign",
      undefined,
      [2, 3, 4]
    );
    expect(state.unlockedFacts.sort()).toEqual([1, 2, 3, 4]);
  });

  it("merges preserved facts without duplicates", () => {
    const state = createInitialDuckGameState(
      1,
      "campaign",
      undefined,
      [1, 2, 2, 3]
    );
    expect(state.unlockedFacts.sort()).toEqual([1, 2, 3]);
  });

  it("drops ids that don't correspond to a real DUCK_FACTS entry", () => {
    const bogusId = Math.max(...DUCK_FACTS.map((f) => f.id)) + 999;
    const state = createInitialDuckGameState(1, "campaign", undefined, [
      2,
      bogusId,
    ]);
    expect(state.unlockedFacts).toContain(2);
    expect(state.unlockedFacts).not.toContain(bogusId);
  });

  it("defaults to just the baseline unlock when no facts are preserved", () => {
    const state = createInitialDuckGameState(1, "campaign");
    expect(state.unlockedFacts).toEqual([1]);
  });

  it("advanceToNextLevel forwards the current state's unlocked facts to the next sprint", () => {
    const won: WorkingWithDuckState = {
      ...createInitialDuckGameState(1, "campaign"),
      status: "won",
      unlockedFacts: [1, 2, 3],
    };
    const next = advanceToNextLevel(won);
    expect(next.unlockedFacts.sort()).toEqual([1, 2, 3]);
    expect(next.status).toBe("running");
  });

  it("advanceToNextLevel forwards unlocked facts into the endless-mode handoff", () => {
    const won: WorkingWithDuckState = {
      ...createInitialDuckGameState(5, "campaign"),
      status: "won",
      currentLevel: 5,
      unlockedFacts: [1, 2, 3, 4, 5],
    };
    const next = advanceToNextLevel(won);
    expect(next.mode).toBe("endless");
    expect(next.unlockedFacts.sort()).toEqual([1, 2, 3, 4, 5]);
  });
});

// --- Real component + localStorage coverage ---

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";

global.ResizeObserver = class {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
} as any;

global.IntersectionObserver = class {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
} as any;

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

HTMLCanvasElement.prototype.getContext = vi.fn(() => mockCtx as any);
HTMLCanvasElement.prototype.getBoundingClientRect = vi.fn(() => ({
  left: 0,
  top: 0,
  width: 800,
  height: 500,
  right: 800,
  bottom: 500,
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
    muted: true,
    profile: "8-bit",
    setVolume: vi.fn(),
    setMuted: vi.fn(),
    setProfile: vi.fn(),
  }),
  AudioProvider: ({ children }: any) => <>{children}</>,
}));

vi.mock("@/hooks/useTelemetry", () => ({
  useTelemetry: () => ({
    recordEvent: vi.fn().mockResolvedValue(true),
  }),
}));

let scriptedInitialState: WorkingWithDuckState | null = null;

vi.mock("@/lib/working-with-duck-engine", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/working-with-duck-engine")>();
  return {
    ...actual,
    createInitialDuckGameState: (
      level?: number,
      mode?: "campaign" | "endless",
      preservedAccessories?: any,
      preservedFacts?: number[]
    ) => {
      if (scriptedInitialState) {
        return scriptedInitialState;
      }
      return actual.createInitialDuckGameState(
        level,
        mode,
        preservedAccessories,
        preservedFacts
      );
    },
  };
});

import { WorkingWithDuck } from "@/components/WorkingWithDuck";
import { createInitialDuckGameState as realCreateInitialDuckGameState } from "@/lib/working-with-duck-engine";

const STORAGE_KEY = "working_with_duck_unlocked_facts";

let storageStore: Record<string, string> = {};
Object.defineProperty(globalThis, "localStorage", {
  value: {
    getItem: (k: string) =>
      Object.prototype.hasOwnProperty.call(storageStore, k)
        ? storageStore[k]
        : null,
    setItem: (k: string, v: string) => {
      storageStore[k] = String(v);
    },
    removeItem: (k: string) => {
      delete storageStore[k];
    },
    clear: () => {
      storageStore = {};
    },
    key: () => null,
    length: 0,
  },
  writable: true,
});

async function clickByText(container: HTMLElement, text: string | RegExp) {
  const btn = Array.from(container.querySelectorAll("button")).find((b) =>
    typeof text === "string"
      ? b.textContent?.includes(text)
      : text.test(b.textContent || "")
  );
  expect(btn).toBeDefined();
  await act(async () => {
    btn!.click();
  });
  return btn!;
}

// Mirrors what the component's own getStoredUnlockedFacts() + mount-time
// createInitialDuckGameState call would have produced, so the scripted
// mount state reflects whatever this test seeded into storageStore instead
// of silently reverting to the [1] default.
function scriptOneTickFromWin(level: number) {
  const raw = storageStore[STORAGE_KEY];
  const preservedFacts: number[] = raw ? JSON.parse(raw) : [1];
  const base = realCreateInitialDuckGameState(
    level,
    "campaign",
    undefined,
    preservedFacts
  );
  scriptedInitialState = {
    ...base,
    status: "idle",
    workProgress: base.targetWorkProgress - 0.01,
    naughtyVsGood: 15,
  };
}

async function mountFresh() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<WorkingWithDuck />);
  });
  return { container, root };
}

async function unmount(root: Root, container: HTMLElement) {
  await act(async () => {
    root.unmount();
  });
  container.remove();
}

describe("Working With Duck component - scrapbook unlock preservation (#599)", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    storageStore = {};
    scriptedInitialState = null;
  });

  afterEach(async () => {
    if (root) await unmount(root, container);
  });

  it("loads a seeded save instead of replacing it with the [1] default on launch", async () => {
    storageStore[STORAGE_KEY] = JSON.stringify([1, 2, 3, 4]);

    ({ container, root } = await mountFresh());

    // The scrapbook is a one-card-at-a-time carousel starting at card 1
    // (DUCK_FACTS[0], level 1). Step through cards 1-4 (levels 1-4, the
    // seeded ids) and confirm each renders its real content rather than
    // the "Locked Milestone" placeholder — proving launch read the seeded
    // save instead of resetting to the [1] default.
    await clickByText(container, /Scrapbook/i);
    expect(container.textContent).not.toContain("Locked Milestone");
    for (let i = 0; i < 3; i++) {
      await clickByText(container, "Next →");
      expect(container.textContent).not.toContain("Locked Milestone");
    }
    // Card 5 (level 5) was never seeded, so it's still genuinely locked —
    // a control confirming the assertions above aren't vacuous.
    await clickByText(container, "Next →");
    expect(container.textContent).toContain("Locked Milestone");
  });

  it("preserves earned collectibles through advancement (Proceed to Sprint)", async () => {
    storageStore[STORAGE_KEY] = JSON.stringify([1, 2, 3]);
    scriptOneTickFromWin(1);

    // Install the RAF stub before mounting so it captures the component's
    // very first requestAnimationFrame(render) registration.
    const rafCallback: { current: FrameRequestCallback | null } = {
      current: null,
    };
    const originalRaf = window.requestAnimationFrame;
    window.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      rafCallback.current = cb;
      return 1;
    }) as any;

    ({ container, root } = await mountFresh());
    await clickByText(container, /Start Sprint 1/);
    scriptedInitialState = null;

    // One fixed-timestep frame (per #600) is enough to cross the win
    // threshold from one tick away.
    expect(rafCallback.current).not.toBeNull();
    await act(async () => {
      rafCallback.current!(0);
    });
    window.requestAnimationFrame = originalRaf;

    expect(container.textContent).toContain("Completed!");

    await clickByText(container, /Proceed to Sprint 2/);

    expect(JSON.parse(storageStore[STORAGE_KEY]).sort()).toEqual([1, 2, 3]);
  });

  it("preserves earned collectibles through a cabinet remount and reload", async () => {
    storageStore[STORAGE_KEY] = JSON.stringify([1, 2, 3, 4]);

    ({ container, root } = await mountFresh());
    await unmount(root, container);

    // A cabinet remount / page reload is, from this component's point of
    // view, indistinguishable from a fresh mount reading localStorage again.
    ({ container, root } = await mountFresh());

    expect(JSON.parse(storageStore[STORAGE_KEY]).sort()).toEqual([1, 2, 3, 4]);
    // #1507: the write goes through safeSetRawItem and must stay a plain JSON
    // array, never the safeStorage metadata envelope.
    expect(storageStore[STORAGE_KEY]).toMatch(/^\[\d+(,\d+)*\]$/);
  });

  it("does not crash and falls back safely when saved unlocks are malformed", async () => {
    storageStore[STORAGE_KEY] = "{not valid json";

    await expect(mountFresh()).resolves.toBeDefined();
    const mounted = await mountFresh();
    container = mounted.container;
    root = mounted.root;

    expect(container.textContent).toContain("Start Sprint 1");
  });

  it("does not crash when saved unlocks are the wrong shape (not an array)", async () => {
    storageStore[STORAGE_KEY] = JSON.stringify({ not: "an array" });

    ({ container, root } = await mountFresh());
    expect(container.textContent).toContain("Start Sprint 1");
  });
});
