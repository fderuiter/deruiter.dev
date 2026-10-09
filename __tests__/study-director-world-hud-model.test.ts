import { describe, expect, it } from "vitest";
import type { HudReadout } from "@/lib/study-director-world";
import {
  LOW_LEVEL,
  PHASE_LABEL,
  dayPhase,
  hudChanges,
  meterTone,
} from "@/components/study-director-world/hud-model";

const hud = (over: Partial<HudReadout> = {}): HudReadout => ({
  day: 3,
  weekday: "Wednesday",
  clock: "9:00 AM",
  energy: 80,
  focus: 80,
  budget: { spent: 1000, total: 5000 },
  timeline: { day: 3, total: 100, slipDays: 0 },
  enrollment: { enrolled: 4, target: 48 },
  ...over,
});

describe("dayPhase", () => {
  it("walks through the working day and into the dim hours", () => {
    expect(dayPhase(8 * 60)).toBe("morning");
    expect(dayPhase(11 * 60 + 29)).toBe("morning");
    expect(dayPhase(11 * 60 + 30)).toBe("midday");
    expect(dayPhase(13 * 60)).toBe("afternoon");
    expect(dayPhase(17 * 60)).toBe("evening");
    expect(dayPhase(18 * 60)).toBe("night");
  });

  it("has a label for every phase", () => {
    for (const phase of [
      "morning",
      "midday",
      "afternoon",
      "evening",
      "night",
    ] as const)
      expect(PHASE_LABEL[phase].length).toBeGreaterThan(0);
  });
});

describe("meterTone", () => {
  it("is low under the low mark, mid under half, high otherwise", () => {
    expect(meterTone(LOW_LEVEL - 1)).toBe("low");
    expect(meterTone(LOW_LEVEL)).toBe("mid");
    expect(meterTone(49)).toBe("mid");
    expect(meterTone(50)).toBe("high");
  });
});

describe("hudChanges", () => {
  it("says nothing when nothing that matters moved", () => {
    expect(hudChanges(hud(), hud({ clock: "9:10 AM" }), 540, 550)).toEqual([]);
  });

  it("announces a new day instead of a phase", () => {
    const said = hudChanges(
      hud(),
      hud({ day: 4, weekday: "Thursday" }),
      17 * 60,
      8 * 60
    );
    expect(said).toEqual(["Day 4, Thursday."]);
  });

  it("announces a change of phase once", () => {
    const said = hudChanges(hud(), hud({ clock: "1:00 PM" }), 12 * 60, 13 * 60);
    expect(said).toEqual(["Afternoon, 1:00 PM."]);
  });

  it("announces energy and focus only when they cross the low mark", () => {
    expect(hudChanges(hud(), hud({ energy: 24 }), 540, 550)).toEqual([
      "Energy is low, 24 of 100.",
    ]);
    expect(hudChanges(hud({ focus: 10 }), hud({ focus: 5 }), 540, 550)).toEqual(
      []
    );
  });

  it("announces the budget going over only on the crossing", () => {
    const over = hud({ budget: { spent: 5200, total: 5000 } });
    expect(hudChanges(hud(), over, 540, 550)).toEqual(["The budget is over."]);
    expect(hudChanges(over, over, 540, 550)).toEqual([]);
  });

  it("announces slips and enrollment", () => {
    const next = hud({
      timeline: { day: 3, total: 100, slipDays: 2 },
      enrollment: { enrolled: 5, target: 48 },
    });
    expect(hudChanges(hud(), next, 540, 550)).toEqual([
      "The timeline slipped to 2 days late.",
      "Enrollment 5 of 48.",
    ]);
  });
});
