/**
 * @vitest-environment jsdom
 */

import { fromAny } from "@total-typescript/shoehorn";
import { beforeEach, describe, expect, it } from "vitest";
import {
  ARCADE_DAILY_GAMES,
  ARCADE_DAILY_GAME_IDS,
  ARCADE_DAILY_MAX_SEED,
  ARCADE_DAILY_STORAGE_KEY,
  arcadeDailyBest,
  arcadeDailyDate,
  arcadeDailyDateOfNumber,
  arcadeDailyHref,
  arcadeDailyKey,
  arcadeDailyNumber,
  arcadeDailySeed,
  arcadeDailyStreak,
  arcadeDailyTag,
  emptyArcadeDailyProgress,
  isArcadeDailyDate,
  parseArcadeDailyProgress,
  parseArcadeDailyTag,
  readArcadeDailyParam,
  withArcadeDailyResult,
} from "@/lib/arcade/daily";
import {
  getArcadeDailyProgress,
  recordArcadeDailyResult,
} from "@/lib/arcade/daily-store";
import { onAppEvent } from "@/lib/event-bus";
import { safeStorage } from "@/lib/safe-storage";
import {
  dailySeed as trialAndErrorDailySeed,
  parseChallengeHash,
} from "@/lib/trial-and-error";
import { dailySeed as fbbDailySeed } from "@/lib/for-better-or-bulk";
import { dailyResultFor } from "@/components/study-director/career";
import type { FinalReport } from "@/lib/study-director";

const NOON = Date.parse("2026-10-14T12:00:00Z");

describe("the shared Arcade Daily seed (#2113)", () => {
  it("is the same for the same date and game, and differs by game", () => {
    const seeds = ARCADE_DAILY_GAME_IDS.map((game) =>
      arcadeDailySeed("2026-10-14", game)
    );
    expect(seeds).toEqual(
      ARCADE_DAILY_GAME_IDS.map((game) => arcadeDailySeed("2026-10-14", game))
    );
    expect(new Set(seeds).size).toBe(seeds.length);
    for (const seed of seeds) {
      expect(Number.isInteger(seed)).toBe(true);
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(seed).toBeLessThan(2 ** 32);
    }
  });

  it("rolls over with the UTC date", () => {
    expect(arcadeDailySeed("2026-10-14", "study-director")).not.toBe(
      arcadeDailySeed("2026-10-15", "study-director")
    );
    expect(arcadeDailyDate(Date.parse("2026-10-14T23:59:59Z"))).toBe(
      "2026-10-14"
    );
    expect(arcadeDailyDate(Date.parse("2026-10-15T00:00:00Z"))).toBe(
      "2026-10-15"
    );
  });

  it("refuses anything but a real date", () => {
    expect(isArcadeDailyDate("2026-02-29")).toBe(false);
    expect(isArcadeDailyDate("2028-02-29")).toBe(true);
    expect(isArcadeDailyDate("2026-10-14T00:00")).toBe(false);
    expect(() => arcadeDailySeed("2026-13-01", "protocol-drift")).toThrow(
      RangeError
    );
    expect(() => arcadeDailyHref("trial-and-error", "today")).toThrow(
      RangeError
    );
  });

  it("keeps the salts Trial & Error and For Better or Bulk always used", () => {
    expect(arcadeDailyKey("2026-10-14", "trial-and-error")).toBe(
      "daily-protocol:2026-10-14"
    );
    expect(arcadeDailyKey("2026-10-14", "for-better-or-bulk")).toBe(
      "for-better-or-bulk:2026-10-14"
    );
    expect(arcadeDailyKey("2026-10-14", "patty-drive-thru")).toBe(
      "arcade-daily:patty-drive-thru:2026-10-14"
    );
  });

  it("gives Trial & Error and For Better or Bulk the seeds their old dailies gave", () => {
    // Pinned from the derivations on main before #2113.
    const before = [
      ["2026-09-30", "VX2G-N8KD", 491690718],
      ["2026-10-14", "3Q0S-607K", 1640507818],
      ["2030-01-01", "5JX6-5K4W", 1967854232],
    ] as const;
    for (const [date, te, fbb] of before) {
      expect(trialAndErrorDailySeed(date)).toBe(te);
      expect(fbbDailySeed(new Date(`${date}T08:00:00Z`))).toBe(fbb);
      expect(arcadeDailyNumber(date, "for-better-or-bulk")).toBe(fbb);
    }
  });

  it("keeps an old Trial & Error Daily Protocol link working", () => {
    expect(parseChallengeHash("#seed=3Q0S-607K&daily=2026-10-14")).toEqual({
      seed: "3Q0S-607K",
      daily: "2026-10-14",
    });
  });

  it("numbers stay from 1 to the largest seed", () => {
    for (const game of ARCADE_DAILY_GAME_IDS) {
      const n = arcadeDailyNumber("2026-10-14", game);
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(ARCADE_DAILY_MAX_SEED);
    }
  });

  it("finds the date of a daily number today or yesterday only", () => {
    const today = arcadeDailyNumber("2026-10-14", "protocol-drift");
    const yesterday = arcadeDailyNumber("2026-10-13", "protocol-drift");
    const older = arcadeDailyNumber("2026-10-12", "protocol-drift");
    expect(arcadeDailyDateOfNumber(today, "protocol-drift", NOON)).toBe(
      "2026-10-14"
    );
    expect(arcadeDailyDateOfNumber(yesterday, "protocol-drift", NOON)).toBe(
      "2026-10-13"
    );
    expect(arcadeDailyDateOfNumber(older, "protocol-drift", NOON)).toBeNull();
    expect(arcadeDailyDateOfNumber(0, "protocol-drift", NOON)).toBeNull();
  });

  it("tags string seeds with their date and checks the game", () => {
    const tag = arcadeDailyTag("2026-10-14", "study-director");
    expect(tag).toMatch(/^daily-2026-10-14-[0-9a-z]+$/);
    expect(tag.length).toBeLessThanOrEqual(40);
    expect(parseArcadeDailyTag(tag, "study-director")).toBe("2026-10-14");
    expect(parseArcadeDailyTag(tag, "patty-drive-thru")).toBeNull();
    expect(parseArcadeDailyTag("daily-2026-10-14-abc", "study-director")).toBe(
      null
    );
    expect(parseArcadeDailyTag("sd-xyz", "study-director")).toBeNull();
  });

  it("links each game to its daily the way it reads a seed", () => {
    const date = "2026-10-14";
    expect(arcadeDailyHref("trial-and-error", date)).toBe(
      "/arcade/trial-and-error#daily=2026-10-14"
    );
    expect(arcadeDailyHref("for-better-or-bulk", date)).toBe(
      "/arcade/for-better-or-bulk?daily=2026-10-14"
    );
    expect(arcadeDailyHref("protocol-drift", date)).toBe(
      "/protocol-drift?daily=2026-10-14"
    );
    expect(arcadeDailyHref("study-director", date)).toBe(
      `/arcade/study-director#mode=desk&seed=${arcadeDailyTag(date, "study-director")}`
    );
    expect(arcadeDailyHref("patty-drive-thru", date)).toBe(
      `/arcade/patty-drive-thru?seed=${arcadeDailyTag(date, "patty-drive-thru")}`
    );
    for (const game of ARCADE_DAILY_GAMES) {
      expect(arcadeDailyHref(game.id, date).startsWith(game.route)).toBe(true);
    }
  });

  it("opens a Trial & Error daily from the date alone", () => {
    const href = arcadeDailyHref("trial-and-error", "2026-10-14");
    expect(parseChallengeHash(href.slice(href.indexOf("#")))).toEqual({
      seed: trialAndErrorDailySeed("2026-10-14"),
      daily: "2026-10-14",
    });
  });

  it("reads a daily date from a query or a hash", () => {
    expect(readArcadeDailyParam("?daily=2026-10-14")).toBe("2026-10-14");
    expect(readArcadeDailyParam("#seed=x&daily=2026-10-14")).toBe("2026-10-14");
    expect(readArcadeDailyParam("?daily=2026-02-30")).toBeNull();
    expect(readArcadeDailyParam("")).toBeNull();
  });
});

describe("Arcade Daily streak", () => {
  const progress = (played: string[], longest = 0) => ({ played, longest });

  it("counts consecutive days ending today", () => {
    expect(
      arcadeDailyStreak(
        progress(["2026-10-11", "2026-10-12", "2026-10-13", "2026-10-14"]),
        "2026-10-14"
      )
    ).toEqual({ current: 4, longest: 4 });
  });

  it("stays alive through today until a whole day is missed", () => {
    expect(
      arcadeDailyStreak(progress(["2026-10-12", "2026-10-13"]), "2026-10-14")
        .current
    ).toBe(2);
    expect(
      arcadeDailyStreak(progress(["2026-10-11", "2026-10-12"]), "2026-10-14")
        .current
    ).toBe(0);
  });

  it("breaks on a gap and remembers the longest", () => {
    expect(
      arcadeDailyStreak(
        progress(["2026-10-01", "2026-10-02", "2026-10-14"], 7),
        "2026-10-14"
      )
    ).toEqual({ current: 1, longest: 7 });
  });

  it("crosses month and year ends", () => {
    expect(
      arcadeDailyStreak(
        progress(["2026-12-30", "2026-12-31", "2027-01-01"]),
        "2027-01-01"
      ).current
    ).toBe(3);
  });
});

describe("Arcade Daily bests", () => {
  it("keeps the best result per game per day and marks the day played", () => {
    let p = emptyArcadeDailyProgress();
    p = withArcadeDailyResult(
      p,
      "patty-drive-thru",
      "2026-10-14",
      { score: 300 },
      "2026-10-14"
    );
    p = withArcadeDailyResult(
      p,
      "patty-drive-thru",
      "2026-10-14",
      { score: 200 },
      "2026-10-14"
    );
    p = withArcadeDailyResult(
      p,
      "protocol-drift",
      "2026-10-14",
      { score: 80 },
      "2026-10-14"
    );
    expect(arcadeDailyBest(p, "patty-drive-thru", "2026-10-14")).toEqual({
      score: 300,
    });
    expect(arcadeDailyBest(p, "protocol-drift", "2026-10-14")).toEqual({
      score: 80,
    });
    expect(arcadeDailyBest(p, "trial-and-error", "2026-10-14")).toBeNull();
    expect(p.played).toEqual(["2026-10-14"]);
    expect(p.longest).toBe(1);
  });

  it("counts yesterday's daily but not an older one", () => {
    const start = emptyArcadeDailyProgress();
    const late = withArcadeDailyResult(
      start,
      "study-director",
      "2026-10-13",
      { score: 54, label: "Grade A, 4 stars" },
      "2026-10-14"
    );
    expect(late.played).toEqual(["2026-10-13"]);
    expect(
      withArcadeDailyResult(
        start,
        "study-director",
        "2026-10-01",
        { score: 54 },
        "2026-10-14"
      )
    ).toBe(start);
  });

  it("drops bests older than a month", () => {
    let p = withArcadeDailyResult(
      emptyArcadeDailyProgress(),
      "trial-and-error",
      "2026-09-01",
      { score: 10 },
      "2026-09-01"
    );
    p = withArcadeDailyResult(
      p,
      "trial-and-error",
      "2026-10-14",
      { score: 20 },
      "2026-10-14"
    );
    expect(Object.keys(p.bests["trial-and-error"] ?? {})).toEqual([
      "2026-10-14",
    ]);
    expect(p.played).toEqual(["2026-09-01", "2026-10-14"]);
  });

  it("reads a damaged record as safely as it can", () => {
    expect(parseArcadeDailyProgress("nonsense")).toEqual(
      emptyArcadeDailyProgress()
    );
    expect(
      parseArcadeDailyProgress({
        bests: {
          "patty-drive-thru": {
            "2026-10-14": { score: 5 },
            "not-a-date": { score: 9 },
            "2026-10-13": { score: "lots" },
          },
          "laser-loon": { "2026-10-14": { score: 1 } },
        },
        played: ["2026-10-14", "2026-10-14", 3, "2026-10-13"],
        longest: -2,
      })
    ).toEqual({
      version: 1,
      bests: { "patty-drive-thru": { "2026-10-14": { score: 5 } } },
      played: ["2026-10-13", "2026-10-14"],
      longest: 0,
    });
  });
});

describe("Arcade Daily store", () => {
  beforeEach(() => {
    safeStorage.clear();
    window.localStorage.clear();
  });

  it("records a daily result, tells the hub and reads it back", () => {
    const heard: string[] = [];
    const stop = onAppEvent("arcade_daily_updated", (d) =>
      heard.push(`${d.gameId}@${d.date}`)
    );
    expect(
      recordArcadeDailyResult(
        "for-better-or-bulk",
        "2026-10-14",
        { score: 41 },
        NOON
      )
    ).toBe(true);
    stop();
    expect(heard).toEqual(["for-better-or-bulk@2026-10-14"]);
    expect(
      arcadeDailyBest(
        getArcadeDailyProgress(),
        "for-better-or-bulk",
        "2026-10-14"
      )
    ).toEqual({ score: 41 });
    expect(getArcadeDailyProgress().played).toEqual(["2026-10-14"]);
    expect(window.localStorage.getItem(ARCADE_DAILY_STORAGE_KEY)).not.toBe(
      null
    );
  });

  it("ignores an old date", () => {
    expect(
      recordArcadeDailyResult(
        "for-better-or-bulk",
        "2026-01-01",
        { score: 41 },
        NOON
      )
    ).toBe(false);
    expect(window.localStorage.getItem(ARCADE_DAILY_STORAGE_KEY)).toBeNull();
  });

  it("reads empty from a damaged record", () => {
    window.localStorage.setItem(ARCADE_DAILY_STORAGE_KEY, "{oops");
    expect(getArcadeDailyProgress()).toEqual(emptyArcadeDailyProgress());
    // Set aside, never thrown away (#2548).
    expect(
      window.localStorage.getItem(`${ARCADE_DAILY_STORAGE_KEY}:corrupt`)
    ).toBe("{oops");
  });
});

describe("Study Director daily result", () => {
  const report = (grade: string, stars: number) =>
    fromAny<FinalReport, unknown>({
      evaluations: { regulatory: { grade }, sponsor: { stars } },
    });

  it("ranks grade first and stars second", () => {
    expect(dailyResultFor(report("A", 1)).score).toBeGreaterThan(
      dailyResultFor(report("B", 5)).score
    );
    expect(dailyResultFor(report("A", 5))).toEqual({
      score: 55,
      label: "Grade A, 5 stars",
    });
    expect(dailyResultFor(report("F", 1))).toEqual({
      score: 11,
      label: "Grade F, 1 star",
    });
  });
});
