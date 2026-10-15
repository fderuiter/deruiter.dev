// Laser Loon saved stars (#2143): each act keeps its best stars and time,
// the act intro shows them, and all twelve stars unlock a trophy.
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import {
  LASER_LOON_STARS_KEY,
  countActStars,
  mergeActBest,
  parseActBestRecord,
} from "@/lib/laser-loon";
import { ARCADE_TROPHIES } from "@/lib/arcade-achievements";
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

vi.mock("@/components/arcade/CabinetSetupContext", async (original) => ({
  ...(await original<object>()),
  useSkipTitleScreen: () => true,
}));

describe("act best record (#2143)", () => {
  it("keeps the most stars and the fastest time independently", () => {
    let merge = mergeActBest({}, 1, 2, 30);
    expect(merge).toMatchObject({ newStars: true, newTime: true });
    merge = mergeActBest(merge.record, 1, 1, 18);
    expect(merge).toMatchObject({ newStars: false, newTime: true });
    expect(merge.record[1]).toEqual({ stars: 2, bestSeconds: 18 });
    merge = mergeActBest(merge.record, 1, 3, 25);
    expect(merge).toMatchObject({ newStars: true, newTime: false });
    expect(merge.record[1]).toEqual({ stars: 3, bestSeconds: 18 });
  });

  it("counts stars across the four acts", () => {
    const record = {
      1: { stars: 3 as const, bestSeconds: 10 },
      2: { stars: 2 as const, bestSeconds: 20 },
    };
    expect(countActStars(record)).toBe(5);
    expect(countActStars({})).toBe(0);
  });

  it("survives damaged storage", () => {
    expect(parseActBestRecord(null)).toEqual({});
    expect(parseActBestRecord("not json")).toEqual({});
    expect(parseActBestRecord("[1,2]")).toEqual({});
    expect(
      parseActBestRecord(
        JSON.stringify({
          1: { stars: 3, bestSeconds: 12.4 },
          2: { stars: 7, bestSeconds: 5 },
          3: { stars: 2, bestSeconds: -1 },
          9: { stars: 3, bestSeconds: 1 },
        })
      )
    ).toEqual({ 1: { stars: 3, bestSeconds: 12 } });
  });
});

describe("act intro best line (#2143)", () => {
  beforeEach(() => {
    globalThis.localStorage?.clear?.();
  });
  afterEach(() => {
    cleanup();
  });

  it("names the par when the act has never been cleared", () => {
    render(<LaserLoon />);
    expect(screen.getByTestId("laser-loon-act-best").textContent).toContain(
      "Par 20s"
    );
  });

  it("shows the saved best stars and time", () => {
    globalThis.localStorage?.setItem(
      LASER_LOON_STARS_KEY,
      JSON.stringify({ 1: { stars: 2, bestSeconds: 17 } })
    );
    render(<LaserLoon />);
    expect(screen.getByTestId("laser-loon-act-best").textContent).toContain(
      "Your best: ★★☆ · 17s"
    );
  });
});

describe("all-stars trophy (#2143)", () => {
  it("is a Laser Loon milestone trophy", () => {
    const trophy = ARCADE_TROPHIES.find((t) => t.id === "laser_loon_all_stars");
    expect(trophy).toMatchObject({
      gameId: "laser-loon",
      milestone: "all_stars",
    });
  });
});
