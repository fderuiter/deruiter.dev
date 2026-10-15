import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { GarminWatchSimulator } from "@/components/GarminWatchSimulator";
import { safeRemoveItem } from "@/lib/safe-storage";
import {
  createInitialState,
  startGame,
  setRules,
  allocateVariable,
  type GameEngineState,
} from "@/lib/garmin-engine";

const mockAnnounce = vi.fn();
vi.mock("@/hooks/useAnnouncer", () => ({
  useAnnouncer: () => ({ announce: mockAnnounce }),
}));
vi.mock("@/components/providers/AudioProvider", () => ({
  useAudio: () => ({
    playNote: vi.fn(),
    playSuccess: vi.fn(),
    playHover: vi.fn(),
  }),
}));
vi.mock("@/hooks/useTelemetry", () => ({
  useTelemetry: () => ({ recordEvent: vi.fn().mockResolvedValue(true) }),
}));

const fitnessRun = (over: Partial<GameEngineState> = {}): GameEngineState => ({
  ...startGame(setRules(createInitialState("fenix", 0), "fitness"), "fenix"),
  obstacles: [],
  lastObstacleTime: Date.now() + 60_000,
  lastAllocTime: Date.now() + 60_000,
  ...over,
});

const watch = () => {
  const el = document.querySelector('[data-keyboard-boundary="true"]');
  if (!el) throw new Error("watch keyboard boundary missing");
  return el;
};

// #2010: normal runs are fitness runs; the firmware rules live behind an
// opt-in Dev Mode that is remembered on this device.
describe("Garmin Dev Mode toggle (#2010)", () => {
  beforeEach(() => {
    mockAnnounce.mockClear();
    // Through safe storage, so its in-memory copy is cleared too.
    safeRemoveItem("garmin_dev_mode");
  });
  afterEach(() => cleanup());

  it("starts with Dev Mode off and hides the firmware tools", () => {
    render(<GarminWatchSimulator />);
    const toggle = screen.getByRole("switch", { name: /Dev Mode/ });
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    expect(screen.queryByText("Write NV Flash (+8KB)")).toBeNull();
    expect(screen.queryByText("Drain Battery (-20%)")).toBeNull();
    expect(screen.queryByText("DOWN / Jettison Variable Button")).toBeNull();
    expect(screen.getByRole("meter", { name: "BODY BATTERY" })).toBeTruthy();
    expect(screen.queryByRole("meter", { name: "RAM" })).toBeNull();
  });

  it("turning Dev Mode on persists it and shows the firmware tools", () => {
    render(<GarminWatchSimulator />);
    fireEvent.click(screen.getByRole("switch", { name: /Dev Mode/ }));
    expect(window.localStorage.getItem("garmin_dev_mode")).toBe("1");
    expect(
      screen
        .getByRole("switch", { name: /Dev Mode/ })
        .getAttribute("aria-checked")
    ).toBe("true");
    expect(screen.getByText("Write NV Flash (+8KB)")).toBeTruthy();
    expect(screen.getByRole("meter", { name: "RAM" })).toBeTruthy();
  });

  it("starts a fitness run by default and a dev run with Dev Mode on", () => {
    const { unmount } = render(<GarminWatchSimulator />);
    fireEvent.keyDown(watch(), { key: "Enter" });
    expect(screen.getByRole("img", { name: /Body Battery: 100/ })).toBeTruthy();
    unmount();

    window.localStorage.setItem("garmin_dev_mode", "1");
    render(<GarminWatchSimulator />);
    fireEvent.keyDown(watch(), { key: "Enter" });
    expect(screen.getByRole("img", { name: /Memory:/ })).toBeTruthy();
  });

  it("reads out a fitness run's own numbers, and firmware only in Dev Mode (#2240)", () => {
    const { unmount } = render(
      <GarminWatchSimulator
        initialState={fitnessRun({
          runClockMs: 83_450,
          distanceMeters: 1234,
          lives: 2,
          kudos: 7,
        })}
      />
    );
    expect(screen.getByText("Run Time: 1:23.45")).toBeTruthy();
    expect(screen.getByText("Distance: 1.23 km")).toBeTruthy();
    expect(screen.getByText("Lives: 2")).toBeTruthy();
    expect(screen.getByText("Kudos: 7")).toBeTruthy();
    expect(
      screen.queryByText(/RAM Memory:|Thermal Stress:|Condensation Fog:/)
    ).toBeNull();
    unmount();

    window.localStorage.setItem("garmin_dev_mode", "1");
    render(<GarminWatchSimulator />);
    expect(screen.getByText(/RAM Memory:/)).toBeTruthy();
    expect(screen.getByText(/Battery Level:/)).toBeTruthy();
    expect(screen.queryByText(/^Run Time:/)).toBeNull();
  });

  it("ignores Down and turns Backspace into the action key in a fitness run", () => {
    const state = allocateVariable(fitnessRun(), "array", "probe").state;
    render(<GarminWatchSimulator initialState={state} />);
    // A pop or a GC would score; the fitness readouts carry no RAM (#2240).
    const scoreBefore = screen.getByText(/^Score:/).textContent;
    expect(screen.queryByText(/RAM Memory:/)).toBeNull();
    fireEvent.keyDown(watch(), { key: "ArrowDown" });
    fireEvent.keyDown(watch(), { key: "Backspace" });
    fireEvent.keyDown(watch(), { key: "g" });
    // Neither a pop nor a GC freeze happened.
    expect(screen.getByText(/State: playing/)).toBeTruthy();
    const telemetry = screen.getByText("Read Telemetry");
    fireEvent.click(telemetry);
    const said = mockAnnounce.mock.calls.map((c) => c[0] as string).join(" ");
    expect(said).toMatch(/Body Battery: 100/);
    expect(said).not.toMatch(/Garbage collection active/);
    expect(screen.getByText(/^Score:/).textContent).toBe(scoreBefore);
  });

  it("names a fitness crash by its gym cause on the result card", () => {
    const crashed = fitnessRun({
      gameState: "crashed",
      crashReport: {
        errorType: "Null Pointer",
        file: "run.mc",
        line: 1,
        stackTrace: [],
        heapUsedKb: 0,
        heapLimitKb: 32,
      },
    });
    render(<GarminWatchSimulator initialState={crashed} />);
    expect(screen.getByText("COUCH POTATO")).toBeTruthy();
    expect(screen.getByText(/A Couch Potato got you/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Run Again/ })).toBeTruthy();
  });
});
