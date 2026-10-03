// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React from "react";
import { render, screen, cleanup, act } from "@testing-library/react";
import { CabinetSetupContext } from "@/components/arcade/CabinetSetupContext";
import { getSavedSetupConfig } from "@/components/arcade/PreGameSetupWizard";

vi.mock("@/components/providers/AudioProvider", () => ({
  useAudio: () => ({
    playNote: vi.fn(),
    playSuccess: vi.fn(),
    playHover: vi.fn(),
    volume: 0.8,
    muted: false,
    setMuted: vi.fn(),
  }),
  AudioProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/hooks/useTelemetry", () => ({
  useTelemetry: () => ({ recordEvent: vi.fn().mockResolvedValue(true) }),
}));

import { LaserLoon } from "@/components/LaserLoon";
import { WorkingWithDuck } from "@/components/WorkingWithDuck";

function InCabinet({
  gameId,
  skip,
  children,
}: {
  gameId: string;
  skip: boolean;
  children: React.ReactNode;
}) {
  return (
    <CabinetSetupContext.Provider
      value={{
        config: getSavedSetupConfig(gameId),
        runRevision: 0,
        isSetupOpen: false,
        skipTitleScreen: skip,
      }}
    >
      {children}
    </CabinetSetupContext.Provider>
  );
}

describe("one title screen per game (#1516)", () => {
  afterEach(cleanup);

  it("Laser Loon opens on the Act 1 intro inside a cabinet", async () => {
    await act(async () => {
      render(
        <InCabinet gameId="laser-loon" skip>
          <LaserLoon />
        </InCabinet>
      );
    });
    expect(screen.queryByRole("button", { name: /START CAMPAIGN/ })).toBeNull();
    expect(screen.getByRole("button", { name: /engage stage/i })).toBeDefined();
    // The museum stays reachable from the options panel.
    expect(screen.getAllByRole("button", { name: /museum/i }).length).toBe(1);
  });

  it("Laser Loon keeps its title screen outside a cabinet", async () => {
    await act(async () => {
      render(<LaserLoon />);
    });
    expect(
      screen.getByRole("button", { name: /START CAMPAIGN/ })
    ).toBeDefined();
  });

  it("Laser Loon keeps its title when the cabinet opts out", async () => {
    await act(async () => {
      render(
        <InCabinet gameId="laser-loon" skip={false}>
          <LaserLoon />
        </InCabinet>
      );
    });
    expect(
      screen.getByRole("button", { name: /START CAMPAIGN/ })
    ).toBeDefined();
  });

  it("Duck starts Sprint 1 at once inside a cabinet", async () => {
    await act(async () => {
      render(
        <InCabinet gameId="working-with-duck" skip>
          <WorkingWithDuck />
        </InCabinet>
      );
    });
    expect(screen.queryByTestId("duck-sprint-briefing")).toBeNull();
    // Scrapbook and Wardrobe remain in the action dock.
    expect(screen.getByTestId("duck-action-dock")).toBeDefined();
  });

  it("Duck keeps its briefing outside a cabinet", async () => {
    await act(async () => {
      render(<WorkingWithDuck />);
    });
    expect(screen.getByTestId("duck-sprint-briefing")).toBeDefined();
  });
});
