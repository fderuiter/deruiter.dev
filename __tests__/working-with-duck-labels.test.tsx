/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
//
// #1316: the screen-reader progress read the raw work units ("118%") while
// the HUD showed the percent of the sprint target (75%), and the Dog Park
// help card said Space steers Duck, when Space jumps and W or the arrow keys
// steer.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createInitialDuckGameState } from "@/lib/working-with-duck-engine";

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

vi.mock("@/components/arcade/PlayCabinet", () => ({
  PlayCabinet: ({
    controls,
  }: {
    controls: Array<{ key: string; action: string }>;
  }) => (
    <ul data-testid="cabinet-controls">
      {controls.map((c) => (
        <li key={c.key}>{`${c.key}: ${c.action}`}</li>
      ))}
    </ul>
  ),
}));

import { WorkingWithDuck } from "@/components/WorkingWithDuck";
import { WorkingWithDuckClient } from "@/components/arcade/WorkingWithDuckClient";

describe("Working With Duck labels (#1316)", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("reads work progress as a percent of the sprint target", async () => {
    const seed = {
      ...createInitialDuckGameState(2, "campaign"),
      workProgress: 118,
      targetWorkProgress: 160,
    };
    await act(async () => {
      root.render(<WorkingWithDuck initialState={seed} />);
    });
    const output = container.querySelector('output[for="duck-work"]');
    expect(output?.textContent?.replace(/\s+/g, " ")).toBe(
      "Work Progress: 74%"
    );
  });

  it("tells players Space jumps and W or the arrows steer in the Dog Park", async () => {
    await act(async () => {
      root.render(<WorkingWithDuckClient />);
    });
    const text = container.textContent ?? "";
    expect(text).toContain(
      "Steer Duck around mud puddles with W or the arrow keys"
    );
    expect(text).toContain("press Space to jump hurdles");
    expect(text).not.toMatch(/Spacebar to steer/i);
  });

  // #1555: the cabinet controls said "Space: Steer Duck".
  it("lists Space as the work sprint and Park jump, and W or the arrows as steering (#1555)", async () => {
    await act(async () => {
      root.render(<WorkingWithDuckClient />);
    });
    const items = Array.from(
      container.querySelectorAll('[data-testid="cabinet-controls"] li')
    ).map((li) => li.textContent);
    expect(items).toContain("Space: Work Sprint (Park: Jump)");
    expect(items).toContain("W / ↑ ↓: Steer in the Park");
    expect(items).not.toContain("Space: Steer Duck");
  });

  // #1555: the W trick was "Paw" on its key but "High Five" everywhere else,
  // and "Total Score" reset every sprint.
  it("names the W trick High Five and calls the per-sprint score Sprint Score (#1555)", async () => {
    await act(async () => {
      root.render(<WorkingWithDuck />);
    });
    const text = container.textContent ?? "";
    expect(text).toContain("High Five 🐾");
    expect(text).not.toContain("Paw 🐾");
    expect(text).toContain("Sprint Score:");
    expect(text).not.toContain("Total Score");
  });
});
