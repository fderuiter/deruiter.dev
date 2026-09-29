import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { GarminWatchSimulator } from "@/components/GarminWatchSimulator";
import {
  createInitialState,
  allocateVariable,
  startGame,
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

const announced = () =>
  mockAnnounce.mock.calls.map((c) => c[0] as string).join(" | ");

const running = (over: Partial<GameEngineState> = {}): GameEngineState => ({
  ...startGame(createInitialState("fenix", 0), "fenix"),
  obstacles: [],
  lastObstacleTime: Date.now() + 60_000,
  lastAllocTime: Date.now() + 60_000,
  ...over,
});

describe("Garmin accessible controls match the visible watch (#1215)", () => {
  beforeEach(() => {
    mockAnnounce.mockClear();
  });
  afterEach(() => cleanup());

  it("exposes Jump on UP, Jettison on DOWN and GC on BACK, in bezel order", () => {
    render(<GarminWatchSimulator />);
    const group = screen.getByRole("group", {
      name: "Garmin Watch Physical Controls",
    });
    const names = Array.from(group.querySelectorAll("button")).map(
      (b) => b.textContent
    );
    expect(names.slice(0, 5)).toEqual([
      "LIGHT / Backlight Button",
      "UP / Jump Button",
      "DOWN / Jettison Variable Button",
      "START / STOP Button",
      "BACK / Force GC Button",
    ]);
    expect(screen.queryByText(/UP \/ Jettison/)).toBeNull();
    expect(screen.queryByText(/DOWN \/ Force GC/)).toBeNull();
  });

  it("disables gameplay controls unless a run is in progress", () => {
    render(<GarminWatchSimulator />);
    for (const name of [
      "UP / Jump Button",
      "DOWN / Jettison Variable Button",
      "BACK / Force GC Button",
    ]) {
      expect(
        (screen.getByRole("button", { name }) as HTMLButtonElement).disabled
      ).toBe(true);
    }
    fireEvent.click(
      screen.getByRole("button", { name: "START / STOP Button" })
    );
    for (const name of [
      "UP / Jump Button",
      "DOWN / Jettison Variable Button",
      "BACK / Force GC Button",
    ]) {
      expect(
        (screen.getByRole("button", { name }) as HTMLButtonElement).disabled
      ).toBe(false);
    }
  });

  it("announces the resulting state on START/STOP, not the previous one", () => {
    render(<GarminWatchSimulator />);
    fireEvent.click(
      screen.getByRole("button", { name: "START / STOP Button" })
    );
    expect(announced()).toContain("Run in progress.");
    expect(announced()).not.toContain("idle");
    fireEvent.click(
      screen.getByRole("button", { name: "START / STOP Button" })
    );
    expect(announced()).toContain("Run paused.");
  });

  it("runs the launch, jump, GC, crash, restart journey by button", () => {
    // Launch is covered above; seed a running heap with collectible garbage.
    const seeded = allocateVariable(
      allocateVariable(running(), "int").state,
      "float"
    ).state;
    const { rerender } = render(<GarminWatchSimulator initialState={seeded} />);
    fireEvent.click(screen.getByRole("button", { name: "UP / Jump Button" }));
    expect(announced()).toContain("Jumped.");
    fireEvent.click(
      screen.getByRole("button", { name: "DOWN / Jettison Variable Button" })
    );
    expect(announced()).toContain("Jettisoned oldest variable");
    fireEvent.click(
      screen.getByRole("button", { name: "BACK / Force GC Button" })
    );
    expect(announced()).toContain("Garbage collection active");
    rerender(
      <GarminWatchSimulator
        key="crashed"
        initialState={running({
          gameState: "crashed",
          crashReport: {
            errorType: "Out Of Memory",
            file: "Heap.mc",
            line: 1,
            stackTrace: [],
            heapUsedKb: 32,
            heapLimitKb: 32,
          },
        })}
      />
    );
    expect(announced()).toContain("System crash: Out Of Memory");
    fireEvent.click(
      screen.getByRole("button", { name: "START / STOP Button" })
    );
    expect(announced().endsWith("Run in progress.")).toBe(true);
  });

  it("does not put continuously changing telemetry in a live region", () => {
    const { container } = render(<GarminWatchSimulator />);
    const polite = container.querySelector('[aria-live="polite"]');
    expect(polite?.textContent).toContain("Garmin Simulator Telemetry");
    expect(polite?.textContent).not.toMatch(/Memory|Battery|Thermal|Score/);
    for (const out of Array.from(container.querySelectorAll("output"))) {
      expect(out.getAttribute("aria-live")).toBe("off");
    }
  });

  it("reads telemetry on demand", () => {
    render(<GarminWatchSimulator />);
    fireEvent.click(screen.getByRole("button", { name: "Read Telemetry" }));
    expect(announced()).toMatch(/Memory: 1\.8 of 32 KB.*Battery: 100%/);
  });

  it("announces low battery once and power loss", () => {
    const { rerender } = render(
      <GarminWatchSimulator initialState={running({ battery: 10 })} />
    );
    expect(announced()).toContain("low battery");
    rerender(
      <GarminWatchSimulator
        key="off"
        initialState={running({ gameState: "shutdown", battery: 0 })}
      />
    );
    expect(announced()).toContain("Power loss");
  });
});
