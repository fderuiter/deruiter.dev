// @vitest-environment jsdom
/**
 * Reproduction for #2130: clicking a run mode, race course, category or
 * Virtual Partner option kept keyboard focus on that option, so Enter picked
 * it again instead of starting the run. Keyboard picks keep their focus.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { GarminWatchSimulator } from "@/components/GarminWatchSimulator";

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

function radio(container: HTMLElement, text: string): HTMLButtonElement {
  const btn = Array.from(
    container.querySelectorAll<HTMLButtonElement>('[role="radio"]')
  ).find((b) => b.textContent?.trim() === text);
  if (!btn) throw new Error(`option "${text}" not rendered`);
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

describe("Garmin run choices hand the keyboard back after a click (#2130)", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    window.localStorage.clear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    window.localStorage.clear();
  });

  async function render() {
    await act(async () => {
      root.render(<GarminWatchSimulator />);
    });
  }

  it("starts the race on Enter after Race Mode is clicked", async () => {
    await render();
    await act(async () => {
      pointerClick(radio(container, "Race Mode"));
    });
    expect(radio(container, "Race Mode").getAttribute("aria-checked")).toBe(
      "true"
    );
    expect(document.activeElement).toBe(watch(container));
    await act(async () => {
      pressEnter(document.activeElement);
    });
    expect(status(container)).toBe("playing");
  });

  it.each(["Daily Workout", "All Kudos"])(
    "returns focus to the watch after %s is clicked",
    async (option) => {
      await render();
      await act(async () => {
        pointerClick(radio(container, "Race Mode"));
      });
      await act(async () => {
        pointerClick(radio(container, option));
      });
      expect(radio(container, option).getAttribute("aria-checked")).toBe(
        "true"
      );
      expect(document.activeElement).toBe(watch(container));
    }
  );

  it("keeps focus on an option picked from the keyboard", async () => {
    await render();
    const race = radio(container, "Race Mode");
    await act(async () => {
      race.focus();
      // Keyboard activation dispatches a click with detail 0.
      race.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true, detail: 0 })
      );
    });
    expect(document.activeElement).toBe(radio(container, "Race Mode"));
  });
});
