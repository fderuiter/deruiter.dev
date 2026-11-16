// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ok, playFullLevel, startEngine } from "./helpers";

/**
 * #2113: a study started on a seed other than the default must still play
 * through to a locked database. These are the seeds the Arcade Daily produced
 * for these dates before the simulator left it (#3197).
 */
describe("Protocol Drift on non-default seeds", () => {
  it.each([
    ["2026-10-14", 26_809_611],
    ["2026-10-15", 10_031_992],
    ["2027-03-01", 2_111_993_746],
  ])("locks the full study on the %s seed", (_date, seed) => {
    const engine = startEngine("full", seed);
    expect(engine.view().seed).toBe(seed);
    playFullLevel(engine);
    ok(engine, { type: "REQUEST_LOCK" });
    ok(engine, { type: "CONFIRM_LOCK" });
    expect(engine.view().fsmState).toBe("LOCKED");
  });
});
