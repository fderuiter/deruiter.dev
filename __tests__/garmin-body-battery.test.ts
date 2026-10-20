// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  BODY_BATTERY_MAX,
  BODY_BATTERY_RUN_DRAIN_PER_S,
  BODY_BATTERY_SPRINT_DRAIN_PER_S,
  BODY_BATTERY_REST_GAIN_PER_S,
  BODY_BATTERY_HIT_COST,
  BONK_RECOVER_AT,
  FRESH_BODY_BATTERY,
  adjustBodyBattery,
  bodyBatteryFraction,
  bodyBatteryLabel,
  effectiveRunInput,
  stepBodyBattery,
  type BodyBattery,
} from "@/lib/garmin-body-battery";

describe("garmin body battery", () => {
  describe("constants", () => {
    it("starts fresh at the maximum, unbonked", () => {
      expect(FRESH_BODY_BATTERY).toEqual({ value: 100, bonked: false });
      expect(BODY_BATTERY_MAX).toBe(100);
    });
  });

  describe("stepBodyBattery drain and recharge", () => {
    it("drains at the run rate while running on footing", () => {
      const next = stepBodyBattery(FRESH_BODY_BATTERY, 0, true, 1000);
      expect(next.value).toBeCloseTo(100 - BODY_BATTERY_RUN_DRAIN_PER_S, 9);
      expect(next.bonked).toBe(false);
    });

    it("drains at the sprint rate while sprinting on footing", () => {
      const next = stepBodyBattery(FRESH_BODY_BATTERY, 1, true, 1000);
      expect(next.value).toBeCloseTo(100 - BODY_BATTERY_SPRINT_DRAIN_PER_S, 9);
      expect(next.bonked).toBe(false);
    });

    it("recharges while braking on footing", () => {
      const start: BodyBattery = { value: 50, bonked: false };
      const next = stepBodyBattery(start, -1, true, 1000);
      expect(next.value).toBeCloseTo(50 + BODY_BATTERY_REST_GAIN_PER_S, 9);
    });

    it("clamps braking recharge at the maximum", () => {
      const next = stepBodyBattery(FRESH_BODY_BATTERY, -1, true, 1000);
      expect(next.value).toBe(BODY_BATTERY_MAX);
    });

    it("changes nothing in the air at a run or a jog", () => {
      const start: BodyBattery = { value: 60, bonked: false };
      expect(stepBodyBattery(start, 0, false, 1000)).toEqual(start);
      expect(stepBodyBattery(start, -1, false, 1000)).toEqual(start);
    });

    // #2022: the balance playtest never bonked in 120 runs, because a sprint
    // in the air (or a swim stroke) was free. A sprint now costs charge
    // wherever the runner is.
    it("drains at the sprint rate while sprinting in the air", () => {
      const start: BodyBattery = { value: 60, bonked: false };
      const next = stepBodyBattery(start, 1, false, 1000);
      expect(next.value).toBeCloseTo(60 - BODY_BATTERY_SPRINT_DRAIN_PER_S, 9);
    });

    it("lets a bonked runner in the air neither drain nor recharge", () => {
      const start: BodyBattery = { value: 10, bonked: true };
      expect(stepBodyBattery(start, 1, false, 1000)).toEqual(start);
      expect(stepBodyBattery(start, 0, false, 1000)).toEqual(start);
    });

    it("changes nothing for a NaN, zero or negative delta", () => {
      const start: BodyBattery = { value: 60, bonked: false };
      expect(stepBodyBattery(start, 1, true, Number.NaN)).toEqual(start);
      expect(stepBodyBattery(start, 1, true, 0)).toEqual(start);
      expect(stepBodyBattery(start, 1, true, -500)).toEqual(start);
    });

    it("treats an undefined input as a run", () => {
      const next = stepBodyBattery(FRESH_BODY_BATTERY, undefined, true, 1000);
      expect(next.value).toBeCloseTo(100 - BODY_BATTERY_RUN_DRAIN_PER_S, 9);
    });

    it("sets bonk when sprinting or running drains the battery to 0", () => {
      const low: BodyBattery = { value: 1, bonked: false };
      const next = stepBodyBattery(low, 1, true, 1000);
      expect(next).toEqual({ value: 0, bonked: true });
    });

    it("never goes below 0 when draining", () => {
      const low: BodyBattery = { value: 0.1, bonked: false };
      const next = stepBodyBattery(low, 1, true, 5000);
      expect(next.value).toBe(0);
      expect(next.bonked).toBe(true);
    });
  });

  describe("bonk", () => {
    it("drains a bonked sprint at the run rate", () => {
      const bonked: BodyBattery = { value: 10, bonked: true };
      const next = stepBodyBattery(bonked, 1, true, 1000);
      expect(next.value).toBeCloseTo(10 - BODY_BATTERY_RUN_DRAIN_PER_S, 9);
      expect(next.bonked).toBe(true);
    });

    it("stays bonked below the recovery threshold", () => {
      const bonked: BodyBattery = { value: BONK_RECOVER_AT - 1, bonked: true };
      const next = stepBodyBattery(bonked, -1, true, 1000);
      expect(next.bonked).toBe(true);
    });

    it("clears the bonk once braking recovers to the threshold", () => {
      const bonked: BodyBattery = { value: 10, bonked: true };
      const next = stepBodyBattery(bonked, -1, true, 20000);
      expect(next.value).toBeGreaterThanOrEqual(BONK_RECOVER_AT);
      expect(next.bonked).toBe(false);
    });

    it("stays bonked on 0 through adjustments below the threshold", () => {
      const hit = adjustBodyBattery({ value: 5, bonked: false }, -15);
      expect(hit).toEqual({ value: 0, bonked: true });
      const partial = adjustBodyBattery(hit, 10);
      expect(partial).toEqual({ value: 10, bonked: true });
    });

    it("clears the bonk exactly at the recovery threshold", () => {
      const bonked: BodyBattery = { value: 10, bonked: true };
      expect(adjustBodyBattery(bonked, BONK_RECOVER_AT - 10)).toEqual({
        value: BONK_RECOVER_AT,
        bonked: false,
      });
    });
  });

  describe("adjustBodyBattery", () => {
    it("removes a hit cost", () => {
      const next = adjustBodyBattery(
        FRESH_BODY_BATTERY,
        -BODY_BATTERY_HIT_COST
      );
      expect(next).toEqual({
        value: 100 - BODY_BATTERY_HIT_COST,
        bonked: false,
      });
    });

    it("clamps a hit at 0 and sets bonk", () => {
      const low: BodyBattery = { value: 8, bonked: false };
      expect(adjustBodyBattery(low, -BODY_BATTERY_HIT_COST)).toEqual({
        value: 0,
        bonked: true,
      });
    });

    it("clamps a gain at the maximum", () => {
      const next = adjustBodyBattery({ value: 90, bonked: false }, 25);
      expect(next).toEqual({ value: BODY_BATTERY_MAX, bonked: false });
    });

    it("adds Kudos and power-up charge", () => {
      const low: BodyBattery = { value: 20, bonked: false };
      expect(adjustBodyBattery(low, 2).value).toBe(22);
      expect(adjustBodyBattery(low, 25).value).toBe(45);
    });

    it("ignores a NaN or infinite amount", () => {
      const start: BodyBattery = { value: 40, bonked: false };
      expect(adjustBodyBattery(start, Number.NaN)).toEqual(start);
      expect(adjustBodyBattery(start, Number.POSITIVE_INFINITY)).toEqual(start);
    });
  });

  describe("effectiveRunInput", () => {
    it("turns a sprint into a steady run while bonked", () => {
      const bonked: BodyBattery = { value: 5, bonked: true };
      expect(effectiveRunInput(bonked, 1)).toBe(0);
      expect(effectiveRunInput(bonked, 0)).toBe(0);
      expect(effectiveRunInput(bonked, -1)).toBe(-1);
      expect(effectiveRunInput(bonked, undefined)).toBe(0);
    });

    it("recharges a bonked runner at a steady pace", () => {
      const bonked: BodyBattery = { value: 5, bonked: true };
      expect(stepBodyBattery(bonked, 0, true, 1000).value).toBeCloseTo(
        5 + BODY_BATTERY_REST_GAIN_PER_S,
        5
      );
    });

    it("keeps the requested input when not bonked", () => {
      expect(effectiveRunInput(FRESH_BODY_BATTERY, 1)).toBe(1);
      expect(effectiveRunInput(FRESH_BODY_BATTERY, 0)).toBe(0);
      expect(effectiveRunInput(FRESH_BODY_BATTERY, -1)).toBe(-1);
      expect(effectiveRunInput(FRESH_BODY_BATTERY, undefined)).toBe(0);
    });
  });

  describe("bodyBatteryFraction", () => {
    it("is the value as a fraction of the maximum", () => {
      expect(bodyBatteryFraction({ value: 50, bonked: false })).toBe(0.5);
      expect(bodyBatteryFraction(FRESH_BODY_BATTERY)).toBe(1);
      expect(bodyBatteryFraction({ value: 0, bonked: true })).toBe(0);
    });

    it("clamps to 0..1", () => {
      expect(bodyBatteryFraction({ value: 150, bonked: false })).toBe(1);
      expect(bodyBatteryFraction({ value: -20, bonked: false })).toBe(0);
    });
  });

  describe("bodyBatteryLabel", () => {
    it("labels HIGH from 75", () => {
      expect(bodyBatteryLabel({ value: 100, bonked: false })).toBe("HIGH");
      expect(bodyBatteryLabel({ value: 75, bonked: false })).toBe("HIGH");
    });

    it("labels MED from 40 up to 75", () => {
      expect(bodyBatteryLabel({ value: 74.9, bonked: false })).toBe("MED");
      expect(bodyBatteryLabel({ value: 40, bonked: false })).toBe("MED");
    });

    it("labels LOW above 0 and below 40", () => {
      expect(bodyBatteryLabel({ value: 39.9, bonked: false })).toBe("LOW");
      expect(bodyBatteryLabel({ value: 0.5, bonked: false })).toBe("LOW");
    });

    it("labels BONK when bonked, whatever the value", () => {
      expect(bodyBatteryLabel({ value: 10, bonked: true })).toBe("BONK");
      expect(bodyBatteryLabel({ value: 0, bonked: true })).toBe("BONK");
    });
  });

  describe("undefined and NaN guards", () => {
    it("treats an undefined battery as fresh", () => {
      expect(bodyBatteryFraction(undefined)).toBe(1);
      expect(bodyBatteryLabel(undefined)).toBe("HIGH");
      expect(effectiveRunInput(undefined, 1)).toBe(1);
      expect(adjustBodyBattery(undefined, -15)).toEqual({
        value: 85,
        bonked: false,
      });
    });

    it("treats an undefined input as a run when stepping an undefined battery", () => {
      const next = stepBodyBattery(undefined, undefined, true, 1000);
      expect(next.value).toBeCloseTo(100 - BODY_BATTERY_RUN_DRAIN_PER_S, 9);
      expect(next.bonked).toBe(false);
    });

    it("treats a NaN value as fresh", () => {
      const broken: BodyBattery = { value: Number.NaN, bonked: false };
      expect(bodyBatteryFraction(broken)).toBe(1);
      expect(bodyBatteryLabel(broken)).toBe("HIGH");
      expect(adjustBodyBattery(broken, 0)).toEqual(FRESH_BODY_BATTERY);
    });

    it("never returns a NaN value", () => {
      const broken: BodyBattery = { value: Number.NaN, bonked: false };
      expect(Number.isNaN(stepBodyBattery(broken, 1, true, 1000).value)).toBe(
        false
      );
      expect(Number.isNaN(adjustBodyBattery(broken, Number.NaN).value)).toBe(
        false
      );
    });
  });

  describe("immutability", () => {
    it("does not mutate the input battery when stepping or adjusting", () => {
      const frozen = Object.freeze({ value: 50, bonked: false });
      const stepped = stepBodyBattery(frozen, 1, true, 1000);
      const adjusted = adjustBodyBattery(frozen, -15);
      expect(frozen).toEqual({ value: 50, bonked: false });
      expect(stepped).not.toBe(frozen);
      expect(adjusted).not.toBe(frozen);
    });
  });
});
