import { describe, it, expect } from "vitest";
import {
  ACT_I,
  challengeHash,
  challengeOrigin,
  dailySeed,
  isIsoDate,
  normalizeSeed,
  parseChallengeHash,
  parseRunSave,
  parseSeed,
  replayRun,
  seedFromBytes,
  serializeRun,
  utcDate,
  type Act,
  type RunLog,
} from "@/lib/trial-and-error";

const act: Act = { ...ACT_I, crisisDeck: undefined };

describe("run seeds (#1528)", () => {
  it("writes five bytes as eight Crockford base32 characters", () => {
    expect(seedFromBytes([0, 0, 0, 0, 0])).toBe("0000-0000");
    expect(seedFromBytes([255, 255, 255, 255, 255])).toBe("ZZZZ-ZZZZ");
    expect(seedFromBytes([0, 0, 0, 0, 1])).toBe("0000-0001");
    expect(seedFromBytes([0, 0, 0, 0, 32])).toBe("0000-0010");
    expect(() => seedFromBytes([1, 2, 3, 4])).toThrow(RangeError);
  });

  it("forgives case, spaces, hyphens and look-alike letters", () => {
    expect(normalizeSeed("7k3m-q9px")).toBe("7K3M-Q9PX");
    expect(normalizeSeed(" 7K3M Q9PX ")).toBe("7K3M-Q9PX");
    expect(normalizeSeed("7K3MQ9PX")).toBe("7K3M-Q9PX");
    // I and L read as 1, O as 0.
    expect(normalizeSeed("ILO0-0000")).toBe("1100-0000");
    // U is not in the alphabet, and the length must be exactly eight.
    expect(normalizeSeed("UUUU-UUUU")).toBeNull();
    expect(normalizeSeed("7K3M-Q9P")).toBeNull();
  });

  it("still accepts named seeds from before the codec, as written", () => {
    expect(parseSeed("fold-change")).toBe("fold-change");
    expect(parseSeed("  7k3m-q9px ")).toBe("7K3M-Q9PX");
    expect(parseSeed("")).toBeNull();
    expect(parseSeed("no spaces here")).toBeNull();
    expect(parseSeed("x".repeat(33))).toBeNull();
  });

  it("checks real calendar dates", () => {
    expect(isIsoDate("2026-09-30")).toBe(true);
    expect(isIsoDate("2028-02-29")).toBe(true);
    expect(isIsoDate("2026-02-29")).toBe(false);
    expect(isIsoDate("2026-13-01")).toBe(false);
    expect(isIsoDate("26-09-30")).toBe(false);
  });
});

describe("the Daily Protocol (#1528)", () => {
  it("gives everyone the same seed on the same UTC day, and a new one the next", () => {
    const today = dailySeed("2026-09-30");
    expect(normalizeSeed(today)).toBe(today);
    expect(dailySeed("2026-09-30")).toBe(today);
    expect(dailySeed("2026-10-01")).not.toBe(today);
    expect(() => dailySeed("2026-02-30")).toThrow(RangeError);
  });

  it("turns over at midnight UTC, whatever the player's time zone", () => {
    // 23:59:59 UTC is still the 30th in UTC, even where it is already the
    // 1st locally (Tokyo) or still the 30th (Chicago).
    const lastSecond = Date.UTC(2026, 8, 30, 23, 59, 59);
    expect(utcDate(lastSecond)).toBe("2026-09-30");
    expect(utcDate(lastSecond + 1000)).toBe("2026-10-01");
    // The same instant written with offsets is the same UTC day.
    expect(utcDate(Date.parse("2026-10-01T08:59:59+09:00"))).toBe("2026-09-30");
    expect(utcDate(Date.parse("2026-09-30T18:59:59-05:00"))).toBe("2026-09-30");
  });
});

describe("challenge links (#1528)", () => {
  it("carries a seed, and a Daily Protocol date", () => {
    expect(challengeHash("7K3M-Q9PX", { kind: "SEEDED" })).toBe(
      "#seed=7K3M-Q9PX"
    );
    const daily = dailySeed("2026-09-30");
    const hash = challengeHash(daily, { kind: "DAILY", date: "2026-09-30" });
    expect(hash).toBe(`#seed=${daily}&daily=2026-09-30`);
    const challenge = parseChallengeHash(hash)!;
    expect(challenge).toEqual({ seed: daily, daily: "2026-09-30" });
    expect(challengeOrigin(challenge)).toEqual({
      kind: "DAILY",
      date: "2026-09-30",
    });
  });

  it("normalizes a typed seed and ignores unknown parameters", () => {
    expect(parseChallengeHash("#seed=7k3m-q9px&stake=3")).toEqual({
      seed: "7K3M-Q9PX",
      daily: null,
    });
    expect(parseChallengeHash("#seed=fold-change")).toEqual({
      seed: "fold-change",
      daily: null,
    });
  });

  it("rejects a missing or invalid seed", () => {
    expect(parseChallengeHash("")).toBeNull();
    expect(parseChallengeHash("#daily=2026-09-30")).toBeNull();
    expect(parseChallengeHash("#seed=%20")).toBeNull();
    expect(parseChallengeHash("#seed=<script>")).toBeNull();
  });

  it("does not let a link pass another seed off as the Daily Protocol", () => {
    const challenge = parseChallengeHash("#seed=7K3M-Q9PX&daily=2026-09-30")!;
    expect(challenge.daily).toBeNull();
    expect(challengeOrigin(challenge)).toEqual({ kind: "SEEDED" });
  });
});

describe("a saved run's origin (#1528)", () => {
  const NOW = new Date("2026-09-30T20:00:00Z");

  it("round-trips how the seed was chosen", () => {
    const seed = dailySeed("2026-09-30");
    const log: RunLog = {
      actId: act.id,
      seed,
      origin: { kind: "DAILY", date: "2026-09-30" },
      actions: [{ type: "TOGGLE_SELECT", cardId: "C-T14.1.1-A" }],
    };
    const restored = parseRunSave(serializeRun(log, NOW), [act])!;
    expect(restored.log.origin).toEqual(log.origin);
    // A restored selection is cleared as recorded moves, so replay the
    // restored log rather than the original one.
    expect(restored.run).toEqual(replayRun(act, restored.log));
  });

  it("still loads a save written before origins were recorded", () => {
    const log: RunLog = {
      actId: act.id,
      seed: "old-save",
      actions: [{ type: "TOGGLE_SELECT", cardId: "C-T14.1.1-A" }],
    };
    const raw = serializeRun(log, NOW);
    expect(JSON.parse(raw)).not.toHaveProperty("origin");
    const restored = parseRunSave(raw, [act])!;
    expect(restored.log.origin).toBeUndefined();
  });

  it("drops a save whose Daily Protocol date is malformed", () => {
    const log: RunLog = {
      actId: act.id,
      seed: "bad-date",
      origin: { kind: "DAILY", date: "2026-09-30" },
      actions: [{ type: "TOGGLE_SELECT", cardId: "C-T14.1.1-A" }],
    };
    // serializeRun refuses to write it, so tamper with a written save.
    const raw = serializeRun(log, NOW).replace(
      `"date":"2026-09-30"`,
      `"date":"tomorrow"`
    );
    expect(raw).toContain(`"date":"tomorrow"`);
    expect(parseRunSave(raw, [act])).toBeNull();
  });
});
