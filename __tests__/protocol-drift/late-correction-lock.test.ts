// @vitest-environment node
import { describe, expect, it } from "vitest";
import { FULL_GRAPH, WAVE1_GRAPH, minuteAt } from "@/lib/protocol-drift";
import {
  WAVE_END_MINUTES,
  ok,
  publish,
  resolveAll,
  runUntil,
  startEngine,
} from "./helpers";

/**
 * #2164: a Wave 1 correction accepted only after the analysis lane is
 * published re-derives an unpaired ADVS row, which goes stale. The lock gate
 * counts stale unpaired rows, so replaying them has to clear the gate too.
 */
describe("database lock after a late site correction", () => {
  it("clears a stale unpaired derivation on replay and then locks", () => {
    const engine = startEngine();
    publish(engine, WAVE1_GRAPH, "p1");
    runUntil(engine, WAVE_END_MINUTES[1]);
    // Leave Wave 1 undispositioned until the amendment pipeline is live.
    runUntil(engine, minuteAt(20, 8, 0));
    publish(engine, FULL_GRAPH, "p2");
    runUntil(engine, WAVE_END_MINUTES[2]);
    runUntil(engine, WAVE_END_MINUTES[3]);
    resolveAll(engine);
    if (engine.view().fsmState === "WAVE_REVIEW")
      ok(engine, { type: "SET_PAUSED", isPaused: true });

    const first = engine.view();
    const staleUnpaired = first.unpaired.filter((r) => r.stale);
    expect(staleUnpaired.length).toBeGreaterThan(0);

    ok(engine, { type: "REQUEST_LOCK" });
    expect(
      engine
        .view()
        .lastLockAudit?.discrepancies.filter(
          (d) => d.code === "STALE_DERIVATIONS_EXIST"
        )
        .map((d) => d.entityId)
    ).toEqual(expect.arrayContaining(staleUnpaired.map((r) => r.rowId)));
    ok(engine, { type: "RETURN_TO_WORKBENCH" });

    ok(engine, { type: "REPLAY_DERIVATIONS" });
    const after = engine.view();
    expect([...after.adamRows, ...after.unpaired].some((r) => r.stale)).toBe(
      false
    );
    const review = ok(engine, { type: "REQUEST_LOCK" });
    const audit = review.find((e) => e.type === "LOCK_AUDIT");
    expect(
      audit && audit.type === "LOCK_AUDIT" ? audit.result.discrepancies : null
    ).toEqual([]);
    ok(engine, { type: "CONFIRM_LOCK" });
    expect(engine.view().fsmState).toBe("LOCKED");
  });
});
