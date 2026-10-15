// @vitest-environment node
import { describe, expect, it } from "vitest";
import { arcadeDailyNumber } from "@/lib/arcade/daily";
import { ok, playFullLevel, startEngine } from "./helpers";

/**
 * #2113: the Arcade Daily starts Protocol Drift on a seed other than the
 * default. A daily seed must still play through to a locked database.
 */
describe("Protocol Drift on Arcade Daily seeds", () => {
  it.each(["2026-10-14", "2026-10-15", "2027-03-01"])(
    "locks the full study on the %s daily",
    (date) => {
      const seed = arcadeDailyNumber(date, "protocol-drift");
      const engine = startEngine("full", seed);
      expect(engine.view().seed).toBe(seed);
      playFullLevel(engine);
      ok(engine, { type: "REQUEST_LOCK" });
      ok(engine, { type: "CONFIRM_LOCK" });
      expect(engine.view().fsmState).toBe("LOCKED");
    }
  );
});
