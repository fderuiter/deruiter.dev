/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
//
// Regression coverage for #601: duck dialogs (win, failure, wardrobe,
// scrapbook) must expose real dialog semantics, and the topmost open dialog
// must own the Escape key instead of competing with the cabinet's
// fallback-fullscreen Escape-to-exit shortcut. Drives the real
// <WorkingWithDuck /> component; the hook-level coordination contract
// itself (useFocusTrap + useFullscreen) has dedicated unit coverage in
// __tests__/fullscreen-hook.test.tsx.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

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

function firstByTitle(container: HTMLElement, title: string): HTMLElement {
  const el =
    Array.from(container.querySelectorAll<HTMLElement>("[title]")).find(
      (e) => e.getAttribute("title") === title
    ) ?? null;
  expect(el).not.toBeNull();
  return el!;
}

async function clickEl(el: HTMLElement) {
  await act(async () => {
    // JSDOM's click() does not move focus the way a real browser does for
    // an activated <button>; focus explicitly so focus-restoration
    // assertions reflect real click behavior.
    el.focus();
    el.click();
  });
}

async function pressEscape() {
  await act(async () => {
    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      })
    );
    // useFocusTrap restores focus via a setTimeout(0) in its cleanup; let
    // that macrotask flush before asserting on document.activeElement.
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}

describe("Working With Duck - dialog semantics and Escape ownership (#601)", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.keys(storageStore).forEach((k) => delete storageStore[k]);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  async function mount() {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root.render(<WorkingWithDuck />);
    });
  }

  it("exposes named dialog semantics on the wardrobe and scrapbook surfaces", async () => {
    await mount();

    const wardrobeTrigger = firstByTitle(
      container,
      "Duck Wardrobe & Accessories"
    );
    await clickEl(wardrobeTrigger);
    let dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog!.getAttribute("aria-modal")).toBe("true");
    const wardrobeLabelId = dialog!.getAttribute("aria-labelledby");
    expect(wardrobeLabelId).toBeTruthy();
    expect(document.getElementById(wardrobeLabelId!)?.textContent).toContain(
      "Wardrobe"
    );
    // Close it before opening the next dialog.
    await pressEscape();

    const scrapbookTrigger = firstByTitle(container, "Duck Scrapbook & Facts");
    await clickEl(scrapbookTrigger);
    dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog!.getAttribute("aria-modal")).toBe("true");
    const scrapbookLabelId = dialog!.getAttribute("aria-labelledby");
    expect(scrapbookLabelId).toBeTruthy();
    expect(document.getElementById(scrapbookLabelId!)?.textContent).toContain(
      "Scrapbook"
    );
  });

  it("keeps the cabinet fullscreen when Escape dismisses the scrapbook, and restores focus to its trigger", async () => {
    await mount();

    // JSDOM has no real Fullscreen API, so entering fullscreen here
    // exercises the same pseudo-fullscreen fallback path the audit's
    // "fallback fullscreen" evidence was gathered against.
    const fullscreenButton = container.querySelector<HTMLElement>(
      '[aria-label="Enter Fullscreen (F)"]'
    );
    expect(fullscreenButton).not.toBeNull();
    await clickEl(fullscreenButton!);
    expect(
      container.querySelector('[aria-label="Exit Fullscreen (F)"]')
    ).not.toBeNull();

    const scrapbookTrigger = firstByTitle(container, "Duck Scrapbook & Facts");
    await clickEl(scrapbookTrigger);
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();

    // First Escape: the scrapbook owns it. The cabinet must stay fullscreen.
    await pressEscape();
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(
      container.querySelector('[aria-label="Exit Fullscreen (F)"]')
    ).not.toBeNull();
    expect(document.activeElement).toBe(scrapbookTrigger);

    // Second Escape, with no dialog open: now it exits fullscreen.
    await pressEscape();
    expect(
      container.querySelector('[aria-label="Enter Fullscreen (F)"]')
    ).not.toBeNull();
  });

  it("exposes accessible pause/resume controls with proper labels and disabled states (#602)", async () => {
    await mount();

    // In idle, pause buttons are disabled
    const desktopPauseBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Pause Sprint (P)"]'
    );
    expect(desktopPauseBtn).not.toBeNull();
    expect(desktopPauseBtn!.disabled).toBe(true);

    // Start sprint
    const startBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Start Sprint 1")
    );
    expect(startBtn).toBeDefined();
    await clickEl(startBtn!);

    // Now enabled
    expect(desktopPauseBtn!.disabled).toBe(false);

    // Pause via click
    await clickEl(desktopPauseBtn!);

    // Button label switches to Resume
    expect(desktopPauseBtn!.getAttribute("aria-label")).toBe(
      "Resume Sprint (P)"
    );

    // Pause overlay appears with resume button
    const overlay = container.querySelector(
      '[data-testid="duck-pause-overlay"]'
    );
    expect(overlay).not.toBeNull();
    const resumeBtn = overlay!.querySelector("button");
    expect(resumeBtn).not.toBeNull();
    expect(resumeBtn!.textContent).toContain("Resume Sprint");

    // Resume via overlay
    await clickEl(resumeBtn!);
    expect(
      container.querySelector('[data-testid="duck-pause-overlay"]')
    ).toBeNull();
    expect(desktopPauseBtn!.getAttribute("aria-label")).toBe(
      "Pause Sprint (P)"
    );
  });
});
