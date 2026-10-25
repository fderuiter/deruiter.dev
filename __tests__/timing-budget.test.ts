// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import {
  TIMING_BUDGETS_ENV,
  areTimingBudgetsEnforced,
  expectWithinTimingBudget,
} from "./helpers/timing-budget";

const original = process.env[TIMING_BUDGETS_ENV];

afterEach(() => {
  if (original === undefined) delete process.env[TIMING_BUDGETS_ENV];
  else process.env[TIMING_BUDGETS_ENV] = original;
});

describe("expectWithinTimingBudget (#2791)", () => {
  it("records but does not enforce a budget when TIMING_BUDGETS is unset", () => {
    delete process.env[TIMING_BUDGETS_ENV];
    expect(areTimingBudgetsEnforced()).toBe(false);
    expect(() => expectWithinTimingBudget("slow work", 900, 500)).not.toThrow();
  });

  it.each(["1", "true"])(
    "enforces the budget when TIMING_BUDGETS=%s",
    (flag) => {
      process.env[TIMING_BUDGETS_ENV] = flag;
      expect(areTimingBudgetsEnforced()).toBe(true);
      expect(() =>
        expectWithinTimingBudget("fast work", 10, 500)
      ).not.toThrow();
      expect(() => expectWithinTimingBudget("slow work", 900, 500)).toThrow(
        /slow work took 900\.0 ms; budget 500 ms/
      );
    }
  );

  it("still rejects an elapsed time that is not a number", () => {
    delete process.env[TIMING_BUDGETS_ENV];
    expect(() =>
      expectWithinTimingBudget("broken timer", Number.NaN, 500)
    ).toThrow();
  });
});
