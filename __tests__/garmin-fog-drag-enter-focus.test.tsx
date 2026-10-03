// @vitest-environment jsdom
/**
 * Reproductions for #1648 (a fog-wiping drag turned into a swipe once the fog
 * cleared, pausing the run) and #1649 (device, theme and flash buttons kept
 * focus after a click, so Enter re-pressed them instead of starting or
 * rebooting the run).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { GarminWatchSimulator } from "@/components/GarminWatchSimulator";
import {
  createInitialState,
  startGame,
  type GameEngineState,
} from "@/lib/garmin-engine";

vi.mock("@/hooks/useAnnouncer", () => ({
  useAnnouncer: () => ({ announce: vi.fn() }),
}));

vi.mock("@/components/providers/AudioProvider", () => ({
  useAudio: () => ({
    playNote: vi.fn(),
    playSuccess: vi.fn(),
    playHover: vi.fn(),
  }),
  AudioProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/hooks/useTelemetry", () => ({
  useTelemetry: () => ({ recordEvent: vi.fn().mockResolvedValue(true) }),
}));

const vibrate = vi.fn().mockReturnValue(true);

function status(container: HTMLElement): string | undefined {
  const label = container.querySelector("canvas")?.getAttribute("aria-label");
  return label?.match(/Status: (\w+)\./)?.[1];
}

function watch(container: HTMLElement): HTMLDivElement {
  const el = container.querySelector<HTMLDivElement>(
    '[data-keyboard-boundary="true"]'
  );
  if (!el) throw new Error("watch container not rendered");
  return el;
}

function buttonByText(container: HTMLElement, text: string) {
  const btn = Array.from(container.querySelectorAll("button")).find((b) =>
    b.textContent?.includes(text)
  );
  if (!btn) throw new Error(`button "${text}" not rendered`);
  return btn;
}

/** A mouse or touch click; keyboard activation dispatches detail 0. */
function pointerClick(el: HTMLElement) {
  el.focus();
  el.dispatchEvent(
    new MouseEvent("click", { bubbles: true, cancelable: true, detail: 1 })
  );
}

function pressEnter(target: Element | null) {
  target?.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
    })
  );
}

function drag(canvas: HTMLCanvasElement, xs: number[], y = 140) {
  const [first, ...rest] = xs;
  canvas.dispatchEvent(
    new PointerEvent("pointerdown", {
      clientX: first,
      clientY: y,
      pointerId: 1,
      buttons: 1,
      bubbles: true,
    })
  );
  for (const x of rest) {
    canvas.dispatchEvent(
      new PointerEvent("pointermove", {
        clientX: x,
        clientY: y,
        pointerId: 1,
        buttons: 1,
        bubbles: true,
      })
    );
  }
  canvas.dispatchEvent(
    new PointerEvent("pointerup", {
      clientX: rest.at(-1) ?? first,
      clientY: y,
      pointerId: 1,
      bubbles: true,
    })
  );
}

describe("Garmin watch fog drag and Enter focus (#1648, #1649)", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.defineProperty(navigator, "vibrate", {
      value: vibrate,
      writable: true,
      configurable: true,
    });
    HTMLCanvasElement.prototype.getBoundingClientRect = vi.fn(() =>
      DOMRect.fromRect({ x: 0, y: 0, width: 280, height: 280 })
    );
    HTMLCanvasElement.prototype.setPointerCapture = vi.fn();
    HTMLCanvasElement.prototype.releasePointerCapture = vi.fn();
    HTMLCanvasElement.prototype.hasPointerCapture = vi.fn(() => true);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    vibrate.mockClear();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  async function render(initialState?: GameEngineState) {
    await act(async () => {
      root.render(<GarminWatchSimulator initialState={initialState} />);
    });
  }

  // A crashed run opens the result card over the companion panel; the
  // panel's tools are reachable once the player puts it away (#1520).
  async function inspectWatch() {
    await act(async () => {
      pointerClick(buttonByText(container, "Inspect watch"));
    });
  }

  function foggedRun(fogLevel: number): GameEngineState {
    return { ...startGame(createInitialState("fenix")), fogLevel };
  }

  describe("#1648 fog wipe drag", () => {
    it("keeps the run playing when a rightward wipe clears the fog mid-drag", async () => {
      await render(foggedRun(0.3));
      const canvas = container.querySelector("canvas")!;
      expect(status(container)).toBe("playing");

      await act(async () => {
        drag(canvas, [40, 100, 160, 220, 160, 100, 40, 220]);
      });

      expect(
        container.querySelector("canvas")?.getAttribute("aria-label")
      ).toContain("Condensation: 0%");
      expect(status(container)).toBe("playing");
      // processSwipeGesture is the only path that buzzes for 15ms.
      expect(vibrate).not.toHaveBeenCalledWith(15);
    });

    it("never fires a GC freeze for a leftward wipe that clears the fog", async () => {
      await render(foggedRun(0.3));
      const canvas = container.querySelector("canvas")!;

      await act(async () => {
        drag(canvas, [240, 180, 120, 60]);
      });

      expect(status(container)).toBe("playing");
      expect(vibrate).not.toHaveBeenCalledWith(15);
      expect(vibrate).not.toHaveBeenCalledWith(20);
    });

    it("still reads a swipe that starts on a fog-free screen", async () => {
      await render(foggedRun(0));
      const canvas = container.querySelector("canvas")!;

      await act(async () => {
        drag(canvas, [100, 160]);
      });

      expect(vibrate).toHaveBeenCalledWith(15);
      expect(status(container)).toBe("paused");
    });
  });

  describe("#1649 Enter after clicking a setup button", () => {
    it("returns focus to the watch after a device click, so Enter starts the run", async () => {
      await render();
      const forerunner = buttonByText(container, "Forerunner (64KB)");

      await act(async () => {
        pointerClick(forerunner);
      });

      expect(document.activeElement).toBe(watch(container));
      await act(async () => {
        pressEnter(document.activeElement);
      });
      expect(status(container)).toBe("playing");
    });

    it("returns focus to the watch after a theme click", async () => {
      await render();
      await act(async () => {
        pointerClick(buttonByText(container, "Solar"));
      });
      expect(document.activeElement).toBe(watch(container));
    });

    it("reboots a crashed run on Enter after Write NV Flash instead of writing again", async () => {
      await render({
        ...createInitialState("fenix"),
        gameState: "crashed",
      });
      await inspectWatch();
      const flashLabel = () =>
        container.textContent?.match(/FLASH:\s*([\d.]+) \//)?.[1];

      const beforeWrite = Number(flashLabel());
      await act(async () => {
        pointerClick(buttonByText(container, "Write NV Flash"));
      });
      const afterWrite = flashLabel();
      expect(Number(afterWrite)).toBe(beforeWrite + 8);
      expect(document.activeElement).toBe(watch(container));

      await act(async () => {
        pressEnter(document.activeElement);
      });
      expect(status(container)).toBe("playing");
      expect(Number(flashLabel())).toBeLessThanOrEqual(Number(afterWrite));
    });

    it("returns focus to the watch after Clear Flash Storage and Drain Battery clicks", async () => {
      await render(foggedRun(0));
      for (const text of ["Clear Flash Storage", "Drain Battery"]) {
        await act(async () => {
          pointerClick(buttonByText(container, text));
        });
        expect(document.activeElement).toBe(watch(container));
      }
    });

    it("keeps focus on a button a keyboard user activates, so Enter can repeat it", async () => {
      await render({
        ...createInitialState("fenix"),
        gameState: "crashed",
      });
      await inspectWatch();
      const write = buttonByText(container, "Write NV Flash");
      write.focus();

      // Keyboard activation of a button dispatches a click with detail 0.
      await act(async () => {
        write.click();
      });

      expect(document.activeElement).toBe(write);
      expect(status(container)).toBe("crashed");
    });
  });
});
