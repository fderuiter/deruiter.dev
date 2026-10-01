// @vitest-environment jsdom
//
// Component coverage for #1645 (pause freezes play), #1646 (score in the
// HUD) and #1647 (tips, controls and location per scene).

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { fromAny } from "@total-typescript/shoehorn";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

// ResizeObserver and IntersectionObserver come from vitest.setup.ts.
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
import {
  createInitialDuckGameState,
  enterDogPark,
  enterBathtub,
  type WorkingWithDuckState,
} from "@/lib/working-with-duck-engine";

const FRAME_MS = 1000 / 60;

function runningState(
  overrides: Partial<WorkingWithDuckState> = {}
): WorkingWithDuckState {
  return {
    ...createInitialDuckGameState(1),
    status: "running",
    excitement: 42,
    bladder: 40,
    naughtyVsGood: 15,
    totalScore: 1046,
    ...overrides,
  };
}

function meter(container: HTMLElement, label: string): number {
  const bar = container.querySelector(`[aria-label="${label}"]`);
  expect(bar).not.toBeNull();
  return Number(bar!.getAttribute("aria-valuenow"));
}

function srOutput(container: HTMLElement, prefix: string): string {
  const out = Array.from(container.querySelectorAll("output")).find((o) =>
    o.textContent?.startsWith(prefix)
  );
  expect(out).toBeDefined();
  return out!.textContent!.replace(/\s+/g, " ").trim();
}

function visibleScore(container: HTMLElement): number {
  const el = container.querySelector('[data-testid="duck-hud-score-value"]');
  expect(el).not.toBeNull();
  return Number(el!.textContent);
}

function dockButton(container: HTMLElement, title: string): HTMLButtonElement {
  const dock = container.querySelector('[data-testid="duck-action-dock"]');
  const btn = dock
    ? (Array.from(dock.querySelectorAll<HTMLButtonElement>("button")).find(
        (b) => b.getAttribute("title") === title
      ) ?? null)
    : null;
  expect(btn).not.toBeNull();
  return btn!;
}

async function pressKey(key: string, code?: string) {
  await act(async () => {
    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key,
        code: code ?? "",
        bubbles: true,
        cancelable: true,
      })
    );
  });
}

describe("Working With Duck: pause, score and per-scene tips (#1645, #1646, #1647)", () => {
  let randomSpy: ReturnType<typeof vi.spyOn>;
  let rafCallback: { current: FrameRequestCallback | null };
  let originalRaf: typeof window.requestAnimationFrame;
  let originalCancelRaf: typeof window.cancelAnimationFrame;
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    localStorage.clear();
    randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.95);
    rafCallback = { current: null };
    originalRaf = window.requestAnimationFrame;
    originalCancelRaf = window.cancelAnimationFrame;
    window.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      rafCallback.current = cb;
      return 1;
    }) as typeof window.requestAnimationFrame;
    window.cancelAnimationFrame = () => {};
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    randomSpy.mockRestore();
    window.requestAnimationFrame = originalRaf;
    window.cancelAnimationFrame = originalCancelRaf;
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  async function render(state: WorkingWithDuckState) {
    await act(async () => {
      root.render(<WorkingWithDuck initialState={state} />);
    });
    container
      .querySelector<HTMLElement>('[data-keyboard-boundary="true"]')!
      .focus();
  }

  async function advanceFrames(count: number) {
    let ts = 0;
    for (let i = 0; i < count; i++) {
      const cb = rafCallback.current;
      expect(cb).not.toBeNull();
      await act(async () => {
        cb!(ts);
      });
      ts += FRAME_MS;
    }
  }

  describe("#1645 pause freezes play", () => {
    it("ignores treat, trick, toy and arrow keys while paused, and P resumes", async () => {
      await render(runningState());
      await pressKey("p");
      expect(
        container.querySelector('[data-testid="duck-pause-overlay"]')
      ).not.toBeNull();

      const excitement = meter(container, "Duck Excitement Meter");
      const goodBoy = meter(container, "Naughty versus Good Boy Scale");
      const score = srOutput(container, "Sprint Score");

      await pressKey("4");
      await pressKey("q");
      await pressKey("2");
      await pressKey("ArrowRight");
      await pressKey("ArrowUp");
      await pressKey(" ", "Space");
      await pressKey("Enter");

      expect(meter(container, "Duck Excitement Meter")).toBe(excitement);
      expect(meter(container, "Naughty versus Good Boy Scale")).toBe(goodBoy);
      expect(srOutput(container, "Sprint Score")).toBe(score);
      expect(
        dockButton(
          container,
          "Throw ball to play fetch & drain Excitement"
        ).getAttribute("aria-pressed")
      ).toBe("true");

      await pressKey("p");
      expect(
        container.querySelector('[data-testid="duck-pause-overlay"]')
      ).toBeNull();
      await pressKey("4");
      expect(meter(container, "Duck Excitement Meter")).toBeLessThan(
        excitement
      );
    });

    it("disables the dock actions while paused and names the reason", async () => {
      await render(runningState());
      await pressKey("p");

      const treat = dockButton(
        container,
        "Give treat (trades ball during No Take Only Throw)"
      );
      const sit = dockButton(
        container,
        "Command Sit: Calms Excitement (-20) & boosts Good Boy scale"
      );
      const burst = dockButton(
        container,
        "Focus work sprint at desk (Spacebar)"
      );
      for (const btn of [treat, sit, burst]) {
        expect(btn.disabled).toBe(true);
        expect(btn.getAttribute("aria-describedby")).toBe("duck-paused-reason");
      }
      expect(
        container.querySelector("#duck-paused-reason")?.textContent
      ).toMatch(/paused/i);

      const excitement = meter(container, "Duck Excitement Meter");
      await act(async () => {
        treat.click();
        sit.click();
      });
      expect(meter(container, "Duck Excitement Meter")).toBe(excitement);

      // The pause button itself stays usable.
      const resume = container.querySelector<HTMLButtonElement>(
        'button[aria-label="Resume Sprint (P)"]'
      );
      expect(resume?.disabled).toBe(false);
      await act(async () => {
        resume!.click();
      });
      expect(treat.disabled).toBe(false);
      expect(sit.disabled).toBe(false);
    });
  });

  describe("#1646 score in the HUD", () => {
    it("shows the running score and updates it after a code burst", async () => {
      await render(runningState({ totalScore: 0 }));
      expect(visibleScore(container)).toBe(0);
      await pressKey(" ", "Space");
      const after = visibleScore(container);
      expect(after).toBeGreaterThan(0);
      expect(srOutput(container, "Sprint Score")).toBe(
        `Sprint Score: ${after}`
      );
      expect(
        container
          .querySelector('[data-testid="duck-hud-score"]')
          ?.className.includes("tabular-nums")
      ).toBe(true);
    });

    it("shows the saved high score on the start screen and in the HUD", async () => {
      localStorage.setItem("working_with_duck_high_score", "2519");
      await render(createInitialDuckGameState(1));
      expect(
        container.querySelector('[data-testid="duck-start-highscore"]')
          ?.textContent
      ).toContain("2519");
      expect(
        container.querySelector('[data-testid="duck-hud-highscore-value"]')
          ?.textContent
      ).toBe("2519");
      expect(srOutput(container, "High Score")).toBe("High Score: 2519");
    });
  });

  describe("#1647 tips, controls and location match the scene", () => {
    function tipText(): string {
      return Array.from(container.querySelectorAll("span"))
        .map((s) => s.textContent ?? "")
        .filter((t) => /Tip:|Dog Park:|Bath time:|flopped/.test(t))
        .join(" | ");
    }

    it("office shows office tips and Office Workspace", async () => {
      await render(runningState());
      await advanceFrames(2);
      expect(tipText()).toContain("Tip: Work advances automatically");
      expect(srOutput(container, "Location")).toBe(
        "Location: Office Workspace"
      );
      expect(
        dockButton(
          container,
          "Command Sit: Calms Excitement (-20) & boosts Good Boy scale"
        ).disabled
      ).toBe(false);
    });

    it("Dog Park explains its own controls, disables office-only actions and reports Dog Park", async () => {
      await render(enterDogPark(runningState()));
      await advanceFrames(2);
      const tip = tipText();
      expect(tip).toContain("Dog Park:");
      expect(tip).toMatch(/throw/);
      expect(tip).toMatch(/Space to jump/);
      expect(tip).toMatch(/pause until you return to the office/);
      expect(tip).not.toContain("Work advances automatically");
      expect(srOutput(container, "Location")).toBe("Location: Dog Park");

      for (const title of [
        "Command Sit: Calms Excitement (-20) & boosts Good Boy scale",
        "Command Spin: Playful trick (+50 pts) with 360 rotation",
        "Drop chew toy to distract Duck away from desk hazards",
      ]) {
        const btn = dockButton(container, title);
        expect(btn.disabled).toBe(true);
        expect(btn.getAttribute("aria-describedby")).toBe(
          "duck-office-only-reason"
        );
      }
      expect(
        container.querySelector("#duck-office-only-reason")?.textContent
      ).toMatch(/only work in the office/);
    });

    it("Bathtub explains the bath, hides the belly-rub prompt and reports Bathtub", async () => {
      const bath = enterBathtub(runningState());
      await render({ ...bath, duck: { ...bath.duck, state: "THE_FLOP" } });
      await advanceFrames(1);
      const tip = tipText();
      expect(tip).toContain("Bath time:");
      expect(tip).not.toContain("flopped");
      expect(tip).not.toContain("Work advances automatically");
      expect(srOutput(container, "Location")).toBe("Location: Bathtub");
      expect(
        dockButton(
          container,
          "Command High Five: Morale boost (+45 pts) & tail wag"
        ).disabled
      ).toBe(true);
    });
  });
});
