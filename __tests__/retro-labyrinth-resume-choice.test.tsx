// @vitest-environment jsdom
//
// The Launch screen's Resume / New run choice (#3466).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { RunResumeChoice } from "@/components/retro-labyrinth/RunResumeChoice";
import {
  loadRun,
  saveRun,
  takeRunResumeRequest,
  type RetroLabyrinthRunSave,
} from "@/lib/retro-labyrinth";
import { safeStorage } from "@/lib/safe-storage";

const RUN: Omit<RetroLabyrinthRunSave, "version"> = {
  seed: "LAB-3F9K2Q",
  route: [0, 4, 2],
  roomIndex: 2,
  runLength: 8,
  hp: 7,
  maxHp: 10,
  ram: 24,
  maxRam: 48,
  crypto: 130,
  ammo: { npm_install: 3 },
  loadout: { bonusWeapons: [], passives: [] },
  classId: "cryptanalyst",
  activeWeaponId: "npm_install",
  firmware: {
    maxRamTier: 0,
    scanSpeedTier: 0,
    exploitRadiusTier: 0,
    startChipsTier: 0,
  },
  score: 4200,
  elapsedMs: 183_500,
};

function renderChoice() {
  const launch = vi.fn();
  render(<RunResumeChoice launch={launch} prefetch={() => {}} />);
  return launch;
}

beforeEach(() => {
  window.localStorage.clear();
  safeStorage.clearCache();
  takeRunResumeRequest();
  saveRun(RUN);
});

afterEach(() => cleanup());

describe("RunResumeChoice", () => {
  it("names the saved room and hands the save to the session on Resume", () => {
    const launch = renderChoice();
    fireEvent.click(
      screen.getByRole("button", { name: "Resume run (Room 3 of 8)" })
    );
    expect(launch).toHaveBeenCalledOnce();
    expect(takeRunResumeRequest()?.seed).toBe(RUN.seed);
  });

  it("asks before New run discards the save, and Keep my run keeps it", () => {
    const launch = renderChoice();
    fireEvent.click(screen.getByRole("button", { name: "New run" }));

    const keep = screen.getByRole("button", { name: "Keep my run" });
    expect(document.activeElement).toBe(keep);
    fireEvent.click(keep);

    expect(launch).not.toHaveBeenCalled();
    expect(loadRun()?.seed).toBe(RUN.seed);
    expect(
      screen.getByRole("button", { name: "Resume run (Room 3 of 8)" })
    ).toBeTruthy();
  });

  it("discards the save and launches on Discard and start", () => {
    const launch = renderChoice();
    fireEvent.click(screen.getByRole("button", { name: "New run" }));
    fireEvent.click(screen.getByRole("button", { name: "Discard and start" }));

    expect(launch).toHaveBeenCalledOnce();
    expect(loadRun()).toBeNull();
    expect(takeRunResumeRequest()).toBeNull();
  });
});
