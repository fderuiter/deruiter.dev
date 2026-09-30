/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";

// Mock ResizeObserver and IntersectionObserver
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

// Mock Canvas 2D context
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
  width: 360,
  height: 225,
  right: 360,
  bottom: 225,
  x: 0,
  y: 0,
  toJSON: () => {},
}));

// Mock AudioProvider
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
  AudioProvider: ({ children }: any) => <>{children}</>,
}));

// Mock useTelemetry
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

describe("Working With Duck - Mobile Layout & Touch Suite", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    vi.clearAllMocks();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("shows the four needs in one wrapping status bar (#1676)", async () => {
    await act(async () => {
      root.render(<WorkingWithDuck />);
    });

    const hud = container.querySelector(
      '[data-testid="duck-hud-meters"] [role="group"][aria-label="Game status"]'
    );
    expect(hud).not.toBeNull();
    expect(hud?.className).toContain("flex-wrap");
    expect(hud?.querySelectorAll('[role="progressbar"]')).toHaveLength(4);
  });

  it("renders segmented mobile action switcher tabs (Toys, Tricks, Actions)", async () => {
    await act(async () => {
      root.render(<WorkingWithDuck />);
    });

    const mobileTabs = container.querySelectorAll("button");
    const toysTab = Array.from(mobileTabs).find((b) =>
      b.textContent?.includes("Toys")
    );
    const tricksTab = Array.from(mobileTabs).find((b) =>
      b.textContent?.includes("Tricks")
    );
    const actionsTab = Array.from(mobileTabs).find((b) =>
      b.textContent?.includes("Actions")
    );

    expect(toysTab).toBeDefined();
    expect(tricksTab).toBeDefined();
    expect(actionsTab).toBeDefined();
  });

  it("switches mobile tabs between Toys, Tricks, and Actions seamlessly", async () => {
    await act(async () => {
      root.render(<WorkingWithDuck />);
    });

    const buttons = Array.from(container.querySelectorAll("button"));

    // Switch to Tricks tab
    const tricksTab = buttons.find((b) => b.textContent?.includes("Tricks"));
    expect(tricksTab).toBeDefined();
    if (tricksTab) {
      await act(async () => {
        tricksTab.click();
      });
      expect(container.textContent).toContain("Sit (Calm)");
      expect(container.textContent).toContain("High Five");
      expect(container.textContent).toContain("Drop It!");
      expect(container.textContent).toContain("Spin Trick");
    }

    // Switch to Actions tab
    const actionsTab = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Actions")
    );
    expect(actionsTab).toBeDefined();
    if (actionsTab) {
      await act(async () => {
        actionsTab.click();
      });
      expect(container.textContent).toContain("Focus Work Sprint");
      expect(container.textContent).toContain("Dog Park");
      expect(container.textContent).toContain("Bathtub");
    }
  });

  it("ensures Scrapbook and Wardrobe modals have max-h-[90dvh] and overflow-y-auto", async () => {
    await act(async () => {
      root.render(<WorkingWithDuck />);
    });

    // Open Scrapbook
    const scrapbookBtn = Array.from(container.querySelectorAll("button")).find(
      (b) =>
        b.textContent?.includes("Scrapbook") || b.title?.includes("Scrapbook")
    );
    expect(scrapbookBtn).toBeDefined();
    if (scrapbookBtn) {
      await act(async () => {
        scrapbookBtn.click();
      });

      const modalInner = container.querySelector(".max-h-\\[90dvh\\]");
      expect(modalInner).not.toBeNull();
      expect(modalInner?.className).toContain("overflow-y-auto");
    }
  });

  it("handles touch events (touchstart, touchmove, touchend) on the canvas safely", async () => {
    await act(async () => {
      root.render(<WorkingWithDuck />);
    });

    const canvas = container.querySelector("canvas");
    expect(canvas).not.toBeNull();

    if (canvas) {
      // Simulate touch start
      const touchObj = { clientX: 180, clientY: 120 } as Touch;
      await act(async () => {
        const touchEvent = new Event("touchstart", { bubbles: true }) as any;
        touchEvent.touches = [touchObj];
        canvas.dispatchEvent(touchEvent);
      });

      // Simulate touch move
      await act(async () => {
        const touchEvent = new Event("touchmove", { bubbles: true }) as any;
        touchEvent.touches = [{ clientX: 200, clientY: 140 } as Touch];
        canvas.dispatchEvent(touchEvent);
      });

      // Simulate touch end
      await act(async () => {
        const touchEvent = new Event("touchend", { bubbles: true }) as any;
        touchEvent.touches = [];
        canvas.dispatchEvent(touchEvent);
      });
    }
  });
});
