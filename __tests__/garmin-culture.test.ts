import { describe, it, expect } from "vitest";
import {
  GPS_LOCK_MS,
  TOASTS,
  gpsBannerText,
  gpsBars,
  pickToast,
  recoveryHours,
  trainingEffect,
  trainingEffectLabel,
  trainingStatus,
  type StageEffort,
} from "@/lib/garmin-culture";

const effort = (overrides: Partial<StageEffort> = {}): StageEffort => ({
  foesDefeated: 0,
  hitsTaken: 1,
  livesLost: 0,
  poleHeight: 0,
  ...overrides,
});

describe("gpsBars", () => {
  it("starts at zero and rises monotonically to four", () => {
    const samples = Array.from(
      { length: 61 },
      (_, i) => (i * GPS_LOCK_MS) / 50
    );
    const bars = samples.map((ms) => gpsBars(ms));
    expect(bars[0]).toBe(0);
    for (let i = 1; i < bars.length; i += 1) {
      expect(bars[i]).toBeGreaterThanOrEqual(bars[i - 1]);
      expect(bars[i]).toBeGreaterThanOrEqual(0);
      expect(bars[i]).toBeLessThanOrEqual(4);
    }
    expect(bars[bars.length - 1]).toBe(4);
  });

  it("steps through each bar as the lock approaches", () => {
    expect(gpsBars(0)).toBe(0);
    expect(gpsBars(299)).toBe(0);
    expect(gpsBars(300)).toBe(1);
    expect(gpsBars(600)).toBe(2);
    expect(gpsBars(900)).toBe(3);
    expect(gpsBars(GPS_LOCK_MS - 1)).toBe(3);
  });

  it("shows four bars at and after lock", () => {
    expect(gpsBars(GPS_LOCK_MS)).toBe(4);
    expect(gpsBars(GPS_LOCK_MS + 1)).toBe(4);
    expect(gpsBars(5000)).toBe(4);
  });

  it("guards negative and non-finite elapsed times", () => {
    expect(gpsBars(-500)).toBe(0);
    expect(gpsBars(Number.NaN)).toBe(0);
  });
});

describe("gpsBannerText", () => {
  it("waits for GPS before lock", () => {
    expect(gpsBannerText(0)).toBe("WAITING FOR GPS…");
    expect(gpsBannerText(GPS_LOCK_MS - 1)).toBe("WAITING FOR GPS…");
  });

  it("announces GO at and after lock", () => {
    expect(gpsBannerText(GPS_LOCK_MS)).toBe("GPS READY · GO!");
    expect(gpsBannerText(GPS_LOCK_MS * 3)).toBe("GPS READY · GO!");
  });

  it("treats a NaN elapsed time as not yet locked", () => {
    expect(gpsBannerText(Number.NaN)).toBe("WAITING FOR GPS…");
  });
});

describe("trainingEffect", () => {
  it("starts from a base of 2.0", () => {
    expect(trainingEffect(effort({ hitsTaken: 1 }))).toBe(2.0);
  });

  it("adds 0.4 per foe defeated, capped at 1.6", () => {
    expect(trainingEffect(effort({ foesDefeated: 1 }))).toBe(2.4);
    expect(trainingEffect(effort({ foesDefeated: 3 }))).toBe(3.2);
    expect(trainingEffect(effort({ foesDefeated: 4 }))).toBe(3.6);
    expect(trainingEffect(effort({ foesDefeated: 40 }))).toBe(3.6);
  });

  it("adds 0.8 for a stage with no hits taken", () => {
    expect(trainingEffect(effort({ hitsTaken: 0 }))).toBe(2.8);
    expect(trainingEffect(effort({ hitsTaken: 1 }))).toBe(2.0);
  });

  it("adds 0.6 for a top-step pole grab at 0.9 or higher", () => {
    expect(trainingEffect(effort({ poleHeight: 0.9 }))).toBe(2.6);
    expect(trainingEffect(effort({ poleHeight: 1 }))).toBe(2.6);
    expect(trainingEffect(effort({ poleHeight: 0.89 }))).toBe(2.0);
  });

  it("takes 0.5 off per life lost, never below zero", () => {
    expect(trainingEffect(effort({ livesLost: 1 }))).toBe(1.5);
    expect(trainingEffect(effort({ livesLost: 3 }))).toBe(0.5);
    expect(trainingEffect(effort({ livesLost: 10 }))).toBe(0);
  });

  it("clamps the total to 0.0..5.0", () => {
    const best = effort({
      foesDefeated: 4,
      hitsTaken: 0,
      livesLost: 0,
      poleHeight: 1,
    });
    expect(trainingEffect(best)).toBe(5.0);
    expect(
      trainingEffect(effort({ foesDefeated: 4, hitsTaken: 0, poleHeight: 1 }))
    ).toBe(5.0);
  });

  it("rounds to one decimal place", () => {
    const te = trainingEffect(effort({ foesDefeated: 3, hitsTaken: 1 }));
    expect(te).toBe(3.2);
    expect(Math.round(te * 10)).toBe(32);
  });

  it("treats non-finite fields as absent", () => {
    expect(
      trainingEffect({
        foesDefeated: Number.NaN,
        hitsTaken: Number.NaN,
        livesLost: Number.NaN,
        poleHeight: Number.NaN,
      })
    ).toBe(2.0);
  });
});

describe("trainingEffectLabel", () => {
  it.each([
    [0, "No Benefit"],
    [0.9, "No Benefit"],
    [1.0, "Minor"],
    [1.9, "Minor"],
    [2.0, "Maintaining"],
    [2.9, "Maintaining"],
    [3.0, "Improving"],
    [3.9, "Improving"],
    [4.0, "Highly Improving"],
    [4.9, "Highly Improving"],
    [5.0, "Overreaching"],
  ])("labels %s as %s", (te, label) => {
    expect(trainingEffectLabel(te)).toBe(label);
  });

  it("falls back to No Benefit for negative or non-finite values", () => {
    expect(trainingEffectLabel(-1)).toBe("No Benefit");
    expect(trainingEffectLabel(Number.NaN)).toBe("No Benefit");
  });
});

describe("trainingStatus", () => {
  it("is Peaking for any finished 5K", () => {
    expect(trainingStatus(1, true)).toBe("Peaking");
    expect(trainingStatus(5, true)).toBe("Peaking");
  });

  it.each([
    [1, "Unproductive"],
    [2, "Recovery"],
    [3, "Maintaining"],
    [4, "Maintaining"],
    [5, "Productive"],
  ])("stage %s is %s when not finished", (stage, status) => {
    expect(trainingStatus(stage, false)).toBe(status);
  });

  it("clamps out-of-range stages", () => {
    expect(trainingStatus(0, false)).toBe("Unproductive");
    expect(trainingStatus(9, false)).toBe("Productive");
    expect(trainingStatus(Number.NaN, false)).toBe("Unproductive");
  });
});

describe("recoveryHours", () => {
  it.each([
    [0, 6],
    [1, 18],
    [2, 30],
    [5, 66],
    [6, 72],
    [99, 72],
  ])("%s stages cleared gives %s hours", (stages, hours) => {
    expect(recoveryHours(stages, false)).toBe(hours);
  });

  it("is 72 hours for a finished 5K", () => {
    expect(recoveryHours(0, true)).toBe(72);
    expect(recoveryHours(5, true)).toBe(72);
  });

  it("guards negative and non-finite stage counts", () => {
    expect(recoveryHours(-3, false)).toBe(6);
    expect(recoveryHours(Number.NaN, false)).toBe(6);
  });
});

describe("toasts", () => {
  const entries = Object.entries(TOASTS);

  it("has three to five lines per event", () => {
    expect(entries).toHaveLength(7);
    for (const [, lines] of entries) {
      expect(lines.length).toBeGreaterThanOrEqual(3);
      expect(lines.length).toBeLessThanOrEqual(5);
    }
  });

  it("keeps every line at 24 characters or fewer and uppercase", () => {
    for (const [, lines] of entries) {
      for (const line of lines) {
        expect(line.length).toBeLessThanOrEqual(24);
        expect(line).toBe(line.toUpperCase());
      }
    }
  });

  it("picks the same line for the same seed", () => {
    expect(pickToast("hit", 7)).toBe(pickToast("hit", 7));
    expect(pickToast("bonk", 2)).toBe(TOASTS.bonk[2]);
  });

  it("wraps seeds past the end of the list", () => {
    expect(pickToast("rep-max", 4)).toBe(TOASTS["rep-max"][0]);
    expect(pickToast("rep-max", 9)).toBe(TOASTS["rep-max"][1]);
  });

  it("handles negative seeds", () => {
    expect(pickToast("power-up", -1)).toBe(TOASTS["power-up"][1]);
    expect(pickToast("power-up", -4)).toBe(TOASTS["power-up"][0]);
  });

  it("floors fractional seeds", () => {
    expect(pickToast("stage-clear", 2.9)).toBe(TOASTS["stage-clear"][2]);
    expect(pickToast("stage-clear", -0.5)).toBe(TOASTS["stage-clear"][1]);
  });

  it("falls back to the first line for NaN and infinite seeds", () => {
    expect(pickToast("kudos-life", Number.NaN)).toBe(TOASTS["kudos-life"][0]);
    expect(pickToast("kudos-life", Number.POSITIVE_INFINITY)).toBe(
      TOASTS["kudos-life"][0]
    );
  });
});
