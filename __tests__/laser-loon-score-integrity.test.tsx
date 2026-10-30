// Laser Loon score integrity (#2140): a retried act starts from the score it
// began with, campaign and arcade keep separate bests, and sandbox saves none.
import React from "react";
import fs from "fs";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { LaserLoon } from "@/components/LaserLoon";

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

// The session logic lives in its hook since #3436.
const source = [
  "components/LaserLoon.tsx",
  "components/laser-loon/useLaserLoonSession.ts",
]
  .map((file) => fs.readFileSync(path.resolve(process.cwd(), file), "utf8"))
  .join("\n");

async function chooseMode(name: RegExp) {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name }));
  });
}

describe("Laser Loon per-mode bests (#2140)", () => {
  beforeEach(() => {
    globalThis.localStorage?.clear?.();
    globalThis.localStorage?.setItem("laser_loon_high_score", "7500");
    globalThis.localStorage?.setItem("laser_loon_arcade_best", "1200");
  });
  afterEach(() => {
    cleanup();
  });

  it("shows the campaign best in campaign and the arcade best in arcade", async () => {
    render(<LaserLoon />);
    const hud = () => screen.getByLabelText("Game status").textContent ?? "";
    expect(hud()).toContain("7500");

    await chooseMode(/Arcade Survival/i);
    expect(hud()).toContain("1200");
    expect(hud()).not.toContain("7500");
  });

  it("shows no best in sandbox, which never saves a score", async () => {
    render(<LaserLoon />);
    await chooseMode(/Zero-G Sandbox/i);
    const hud = screen.getByLabelText("Game status").textContent ?? "";
    expect(hud).not.toMatch(/Hi/i);
    expect(source).toMatch(
      /const key = BEST_SCORE_KEYS\[mode\];\s+if \(!key\) return;/
    );
    expect(source).not.toMatch(/sandbox:\s*"laser_loon/);
  });
});

describe("Laser Loon act retry (#2140)", () => {
  it("restores the act's starting score before replaying the act", () => {
    const retry = source.slice(source.indexOf("const retryAct = useCallback"));
    const body = retry.slice(0, retry.indexOf("}, ["));
    expect(body).toContain("scoreRef.current = actStartScoreRef.current");
    expect(body).toContain("setScore(actStartScoreRef.current)");
    expect(body.indexOf("scoreRef.current = actStartScoreRef")).toBeLessThan(
      body.indexOf("startAct(currentActNum)")
    );
  });

  it("routes both the Space key and the Try again button through the retry", () => {
    expect(source).toMatch(/gameState === "act-failed"\) \{\s+retryAct\(\);/);
    expect(source).toMatch(/onClick: \(\) => \{\s+retryAct\(\);/);
  });
});
