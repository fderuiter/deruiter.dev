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
import { MountainMap } from "@/components/patrol/MountainMap";
import { OetCanvas } from "@/components/patrol/OetCanvas";
import { OetDescentEngine, type PatrolScenario } from "@/lib/patrol";

/**
 * Frame scheduler driven by the test: frames run only on `tick(timestamp)`,
 * so every delta the Patrol loops see is exact.
 */
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

function mockMobileViewport(isMobile: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: isMobile && query.includes("max-width: 767px"),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
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

describe("MountainMap descent loop on useAnimationFrame (#1133)", () => {
  function startDescent() {
    render(
      <MountainMap
        incidentsCompleted={0}
        onAwaitDispatch={vi.fn()}
        onCompleteShift={vi.fn()}
      />
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Long Way Home, green difficulty/i })
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Simulate Run Down Trail/i })
    );
  }

  /** Descent progress as a percentage, read from the overlay's progress bar. */
  function progressPercent(): number {
    const bar = screen
      .getByTestId("simulation-control-overlay")
      .querySelector<HTMLElement>(".bg-brand-cyan.h-full");
    if (!bar) throw new Error("progress bar not rendered");
    return Number.parseFloat(bar.style.width);
  }

  it("commits on every frame on desktop, advancing 8 s per full descent", () => {
    mockMobileViewport(false);
    startDescent();

    scheduler.tick(1000);
    expect(progressPercent()).toBe(0);
    scheduler.tick(1016);
    expect(progressPercent()).toBeCloseTo((16 / 8000) * 100, 6);
    scheduler.tick(1032);
    expect(progressPercent()).toBeCloseTo((32 / 8000) * 100, 6);
  });

  it("throttles commits to 30 fps on mobile and carries skipped frame time", () => {
    mockMobileViewport(true);
    startDescent();

    // 60 Hz frames; each commit must wait for 1000 / 30 ms of accrued time.
    for (const t of [0, 16, 32]) scheduler.tick(t);
    expect(progressPercent()).toBe(0);
    scheduler.tick(48);
    expect(progressPercent()).toBeCloseTo((48 / 8000) * 100, 6);
    scheduler.tick(64);
    expect(progressPercent()).toBeCloseTo((48 / 8000) * 100, 6);
    scheduler.tick(82);
    expect(progressPercent()).toBeCloseTo((82 / 8000) * 100, 6);
  });

  it("advances by the full real gap between frames, as before the hook", () => {
    mockMobileViewport(false);
    startDescent();

    scheduler.tick(0);
    scheduler.tick(2000);
    expect(progressPercent()).toBeCloseTo(25, 6);
  });

  it("stops the loop while paused and does not count paused time", () => {
    mockMobileViewport(false);
    startDescent();

    scheduler.tick(0);
    scheduler.tick(800);
    expect(progressPercent()).toBeCloseTo(10, 6);

    fireEvent.click(screen.getByLabelText("Pause simulation"));
    expect(scheduler.pendingCount()).toBe(0);

    fireEvent.click(screen.getByLabelText("Resume simulation"));
    scheduler.tick(60_000);
    scheduler.tick(60_016);
    expect(progressPercent()).toBeCloseTo(10 + (16 / 8000) * 100, 6);
  });
});

const scenario: PatrolScenario = {
  id: "pine-ridge-sweep",
  title: "Pine Ridge Morning Sweep",
  location: "Upper Ridge - Chair 4",
  actions: [],
  debriefRules: [],
  environment: {
    snowConditions: "Hardpack / Groomed",
    temperatureFahrenheit: 18,
    visibility: "Clear",
  },
};

describe("OetCanvas physics loop on useAnimationFrame (#1133)", () => {
  function trackEngine(engine: OetDescentEngine, log: string[], name: string) {
    const init = engine.init.bind(engine);
    const update = engine.update.bind(engine);
    vi.spyOn(engine, "init").mockImplementation(() => {
      log.push(`${name}.init`);
      init();
    });
    const updateSpy = vi.spyOn(engine, "update").mockImplementation((dt) => {
      log.push(`${name}.update`);
      update(dt);
    });
    vi.spyOn(engine, "render").mockImplementation(() => {
      log.push(`${name}.render`);
    });
    return updateSpy;
  }

  it("clamps each physics step to 50 ms and starts with a zero step", () => {
    const engine = new OetDescentEngine();
    const log: string[] = [];
    const update = trackEngine(engine, log, "a");
    render(
      <OetCanvas scenario={scenario} engine={engine} onArriveAtBase={vi.fn()} />
    );

    scheduler.tick(100);
    scheduler.tick(116);
    scheduler.tick(216);

    expect(update.mock.calls.map(([dt]) => dt)).toEqual([0, 0.016, 0.05]);
  });

  it("restarts the loop on the new engine only after it is initialised", () => {
    const first = new OetDescentEngine();
    const second = new OetDescentEngine();
    const log: string[] = [];
    trackEngine(first, log, "a");
    const secondUpdate = trackEngine(second, log, "b");

    const { rerender } = render(
      <OetCanvas scenario={scenario} engine={first} onArriveAtBase={vi.fn()} />
    );
    scheduler.tick(0);
    scheduler.tick(16);
    log.length = 0;

    rerender(
      <OetCanvas scenario={scenario} engine={second} onArriveAtBase={vi.fn()} />
    );
    // Only the restarted loop's frame is pending, never the old one.
    expect(scheduler.pendingCount()).toBe(1);
    scheduler.tick(32);
    scheduler.tick(48);

    expect(log).toEqual([
      "b.init",
      "b.update",
      "b.render",
      "b.update",
      "b.render",
    ]);
    // The restarted loop's first step is zero, as with a fresh effect.
    expect(secondUpdate.mock.calls.map(([dt]) => dt)).toEqual([0, 0.016]);
  });

  it("stops stepping while paused and resumes with a zero step", () => {
    const engine = new OetDescentEngine();
    const log: string[] = [];
    const update = trackEngine(engine, log, "a");
    render(
      <OetCanvas scenario={scenario} engine={engine} onArriveAtBase={vi.fn()} />
    );
    scheduler.tick(0);
    scheduler.tick(16);

    act(() => {
      fireEvent.keyDown(window, { code: "KeyP" });
    });
    scheduler.tick(32);
    scheduler.tick(48);
    expect(update).toHaveBeenCalledTimes(2);

    act(() => {
      fireEvent.keyDown(window, { code: "KeyP" });
    });
    scheduler.tick(5000);
    scheduler.tick(5016);
    expect(update.mock.calls.map(([dt]) => dt)).toEqual([0, 0.016, 0, 0.016]);
  });
});
