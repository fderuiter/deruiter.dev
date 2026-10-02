// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
} from "@testing-library/react";
import { LaserLoon } from "@/components/LaserLoon";

/**
 * Issue #1589: the Laser Loon render loop runs on useAnimationFrame. The
 * frames are driven by the test, so these checks pin that the loop ticks
 * while playing, stops while halted or with a lost context, and cancels its
 * pending frame on unmount.
 */

vi.mock("@/components/providers/AudioProvider", () => ({
  useAudio: () => ({
    playNote: vi.fn(),
    playHover: vi.fn(),
    playSubmit: vi.fn(),
    playSuccess: vi.fn(),
    playLaser: vi.fn(),
  }),
}));

vi.mock("@/hooks/useAnnouncer", () => ({
  useAnnouncer: () => ({ announce: vi.fn() }),
}));

vi.mock("@/hooks/useTelemetry", () => ({
  useTelemetry: () => ({
    recordEvent: vi.fn().mockResolvedValue(true),
  }),
}));

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

let scheduler: ReturnType<typeof installFrameScheduler>;

beforeEach(() => {
  scheduler = installFrameScheduler();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function startCampaign(): HTMLCanvasElement {
  render(<LaserLoon />);
  fireEvent.click(
    screen.getAllByRole("button", { name: /START CAMPAIGN/i })[0]
  );
  fireEvent.click(screen.getByRole("button", { name: /ENGAGE STAGE/i }));
  const canvas = document.querySelector("canvas");
  if (!canvas) throw new Error("Laser Loon canvas not rendered");
  return canvas;
}

function backdropPaints(canvas: HTMLCanvasElement): number {
  const ctx = canvas.getContext("2d") as unknown as {
    fillRect: { mock: { calls: unknown[] } };
  };
  return ctx.fillRect.mock.calls.length;
}

describe("Laser Loon render loop on useAnimationFrame (#1589)", () => {
  it("paints a frame on every tick while playing", () => {
    const canvas = startCampaign();
    expect(scheduler.pendingCount()).toBeGreaterThan(0);

    scheduler.tick(16);
    const afterFirst = backdropPaints(canvas);
    expect(afterFirst).toBeGreaterThan(0);

    scheduler.tick(32);
    expect(backdropPaints(canvas)).toBeGreaterThan(afterFirst);
    expect(scheduler.pendingCount()).toBeGreaterThan(0);
  });

  it("stops scheduling frames while paused and resumes after", () => {
    const canvas = startCampaign();
    scheduler.tick(16);

    const playfield = screen.getByRole("application", {
      name: /Laser Loon Arcade Game/i,
    }).parentElement as HTMLElement;
    fireEvent.keyDown(playfield, { key: "p" });
    expect(screen.getByText(/GAME PAUSED/i)).toBeDefined();

    const paused = backdropPaints(canvas);
    scheduler.tick(48);
    scheduler.tick(64);
    expect(backdropPaints(canvas)).toBe(paused);

    fireEvent.keyDown(playfield, { key: "p" });
    scheduler.tick(80);
    expect(backdropPaints(canvas)).toBeGreaterThan(paused);
  });

  it("halts on a lost context and restarts when it is restored", () => {
    const canvas = startCampaign();
    scheduler.tick(16);

    const lost = new Event("contextlost", { cancelable: true });
    act(() => {
      canvas.dispatchEvent(lost);
    });
    expect(lost.defaultPrevented).toBe(true);

    const atLoss = backdropPaints(canvas);
    scheduler.tick(32);
    expect(backdropPaints(canvas)).toBe(atLoss);

    act(() => {
      canvas.dispatchEvent(new Event("contextrestored"));
    });
    scheduler.tick(48);
    expect(backdropPaints(canvas)).toBeGreaterThan(atLoss);
  });

  it("cancels its pending frame on unmount", () => {
    const canvas = startCampaign();
    scheduler.tick(16);
    const painted = backdropPaints(canvas);
    cleanup();
    expect(scheduler.pendingCount()).toBe(0);
    scheduler.tick(32);
    expect(backdropPaints(canvas)).toBe(painted);
  });
});
