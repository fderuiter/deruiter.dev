// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { CardTable } from "@/components/trial-and-error/CardTable";
import { LevelUpPlate } from "@/components/trial-and-error/LevelUpPlate";
import type { LevelUp } from "@/lib/trial-and-error";

/**
 * Issue #1589: the card table's Shift+R and H shortcuts are bound through
 * useHotkeys, and the level-up plate ticks on useAnimationFrame. These tests
 * pin the behaviour of the raw listeners and the hand-rolled loop.
 */

vi.mock("@/hooks/useAnnouncer", () => ({
  useAnnouncer: () => ({ announce: vi.fn() }),
}));
vi.mock("@/components/FieldManualButton", () => ({
  FieldManualButton: () => <button type="button">Manual</button>,
}));

beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: query.includes("reduce"),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const DRAFT_A = "C-T14.1.1-A";
const card = (id: string) =>
  document.querySelector<HTMLButtonElement>(`[data-card-id="${id}"]`)!;
const runInfo = () => screen.queryByRole("dialog", { name: "Run Info" });
const sheet = () => screen.queryByTestId("hand-sheet");

describe("Card table shortcuts on useHotkeys (#1589)", () => {
  it("opens Run Info only on an upper-case Shift+R with no other modifier", () => {
    render(<CardTable seed="keys" />);
    const target = card(DRAFT_A);
    target.focus();

    fireEvent.keyDown(target, { key: "R", shiftKey: true, ctrlKey: true });
    fireEvent.keyDown(target, { key: "R", shiftKey: true, metaKey: true });
    fireEvent.keyDown(target, { key: "R", shiftKey: true, altKey: true });
    // Caps Lock with Shift reports a lower-case key; the raw listener ignored it.
    fireEvent.keyDown(target, { key: "r", shiftKey: true });
    expect(runInfo()).toBeNull();

    fireEvent.keyDown(target, { key: "R", shiftKey: true });
    expect(runInfo()).not.toBeNull();
  });

  it("ignores Shift+R while focus is outside the table", () => {
    render(<CardTable seed="outside" />);
    const outside = document.createElement("button");
    document.body.appendChild(outside);
    try {
      outside.focus();
      fireEvent.keyDown(outside, { key: "R", shiftKey: true });
      expect(runInfo()).toBeNull();
    } finally {
      outside.remove();
    }
  });

  it("still fires inside a keyboard boundary, as the raw listeners did", () => {
    render(
      <div data-keyboard-boundary="true">
        <CardTable seed="boundary" />
      </div>
    );
    const target = card(DRAFT_A);
    target.focus();
    fireEvent.keyDown(target, { key: "h" });
    expect(sheet()).not.toBeNull();
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(sheet()).toBeNull();

    target.focus();
    fireEvent.keyDown(target, { key: "R", shiftKey: true });
    expect(runInfo()).not.toBeNull();
  });

  it("leaves H alone outside the table so the page still sees it", () => {
    const onWindow = vi.fn();
    window.addEventListener("keydown", onWindow);
    try {
      render(<CardTable seed="page-h" />);
      fireEvent.keyDown(document.body, { key: "h" });
      expect(sheet()).toBeNull();
      expect(onWindow).toHaveBeenCalledTimes(1);
      expect(onWindow.mock.calls[0][0].defaultPrevented).toBe(false);
    } finally {
      window.removeEventListener("keydown", onWindow);
    }
  });

  it("opens the cheat sheet on a Caps Lock H without Shift", () => {
    render(<CardTable seed="caps" />);
    fireEvent.keyDown(card(DRAFT_A), { key: "H" });
    expect(sheet()).not.toBeNull();
  });

  it("stops listening once the table unmounts", () => {
    const view = render(<CardTable seed="gone" />);
    const target = card(DRAFT_A);
    view.unmount();
    document.body.appendChild(target);
    try {
      const event = new KeyboardEvent("keydown", {
        key: "h",
        bubbles: true,
        cancelable: true,
      });
      target.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
    } finally {
      target.remove();
    }
  });
});

function installFrameScheduler() {
  let nextId = 1;
  const pending = new Map<number, FrameRequestCallback>();
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn((cb: FrameRequestCallback) => {
      const id = nextId++;
      pending.set(id, cb);
      return id;
    })
  );
  vi.stubGlobal(
    "cancelAnimationFrame",
    vi.fn((id: number) => {
      pending.delete(id);
    })
  );
  return {
    pendingCount: () => pending.size,
    tick(timestamp: number) {
      const batch = [...pending.values()];
      pending.clear();
      act(() => {
        for (const cb of batch) cb(timestamp);
      });
    },
  };
}

const LEVEL_UP: LevelUp = {
  guidanceId: "g-test",
  guidanceName: "FDA Study Data TCG",
  handType: "HIGH_TABLE",
  from: { level: 1, chips: 15, mult: 1 },
  to: { level: 2, chips: 25, mult: 2 },
};

const numbers = () => screen.getByTestId("level-up").textContent ?? "";

describe("LevelUpPlate tick on useAnimationFrame (#1589)", () => {
  it("ticks from the old values to the new over 600 ms, then stops", () => {
    const scheduler = installFrameScheduler();
    render(
      <LevelUpPlate levelUp={LEVEL_UP} reducedMotion={false} loud={false} />
    );
    expect(numbers()).toContain("[15] × [1]");

    scheduler.tick(1000);
    expect(numbers()).toContain("[15] × [1]");
    scheduler.tick(1300);
    expect(numbers()).toContain("[20] × [2]");
    // No delta clamp: a long frame lands the numbers at once.
    scheduler.tick(5000);
    expect(numbers()).toContain("[25] × [2]");
    expect(scheduler.pendingCount()).toBe(0);
  });

  it("shows the new values at once under reduced motion, with no frames", () => {
    const scheduler = installFrameScheduler();
    render(<LevelUpPlate levelUp={LEVEL_UP} reducedMotion loud={false} />);
    expect(numbers()).toContain("[25] × [2]");
    expect(scheduler.pendingCount()).toBe(0);
  });

  it("replays the tick from zero when reduced motion is turned off", () => {
    const scheduler = installFrameScheduler();
    const view = render(
      <LevelUpPlate levelUp={LEVEL_UP} reducedMotion loud={false} />
    );
    view.rerender(
      <LevelUpPlate levelUp={LEVEL_UP} reducedMotion={false} loud={false} />
    );
    expect(numbers()).toContain("[15] × [1]");
    expect(scheduler.pendingCount()).toBe(1);
    scheduler.tick(100);
    scheduler.tick(800);
    expect(numbers()).toContain("[25] × [2]");
  });

  it("cancels its pending frame on unmount", () => {
    const scheduler = installFrameScheduler();
    const view = render(
      <LevelUpPlate levelUp={LEVEL_UP} reducedMotion={false} loud={false} />
    );
    expect(scheduler.pendingCount()).toBe(1);
    view.unmount();
    expect(scheduler.pendingCount()).toBe(0);
  });
});
