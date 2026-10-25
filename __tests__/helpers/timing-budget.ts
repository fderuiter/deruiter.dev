import { expect } from "vitest";

/** The variable that turns wall-clock budgets on (#2791). */
export const TIMING_BUDGETS_ENV = "TIMING_BUDGETS";

/** Whether `TIMING_BUDGETS` asks for wall-clock budgets to be enforced. */
export function areTimingBudgetsEnforced(): boolean {
  const flag = process.env[TIMING_BUDGETS_ENV];
  return flag === "1" || flag === "true";
}

/**
 * Checks an elapsed time against its budget, only when asked to.
 *
 * A wall-clock budget measures the machine as much as the code: one that
 * holds on an idle runner fails under a parallel build or a mutation run
 * (#2791). The unit gate never sets `TIMING_BUDGETS`, so there the work still
 * runs and every functional assertion beside it still holds, while the
 * budget is recorded but not enforced. Run `TIMING_BUDGETS=1 npx vitest run`
 * on an idle machine to enforce them.
 *
 * @param label - What was timed, shown when the budget is exceeded.
 * @param elapsedMs - The measured time.
 * @param budgetMs - The most the work may take.
 */
export function expectWithinTimingBudget(
  label: string,
  elapsedMs: number,
  budgetMs: number
): void {
  expect(Number.isFinite(elapsedMs), `${label}: elapsed time`).toBe(true);
  if (!areTimingBudgetsEnforced()) return;
  expect(
    elapsedMs,
    `${label} took ${elapsedMs.toFixed(1)} ms; budget ${budgetMs} ms`
  ).toBeLessThan(budgetMs);
}
