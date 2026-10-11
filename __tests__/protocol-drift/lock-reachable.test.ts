// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ok, playFullLevel, startEngine } from "./helpers";

/**
 * #1946: the inspector offers Accept correction and Accept uncertainty but, until
 * this fix, nothing closed the answered query thread, so the lock audit failed
 * on "Open queries" for a player who did everything right.
 */
describe("database lock through the inspector's issue actions", () => {
  it("locks without ever sending CLOSE_QUERY", () => {
    const engine = startEngine();
    playFullLevel(engine, { closeAnswered: false });
    expect(
      engine
        .view()
        .queries.filter((q) => q.communicationState !== "Closed")
        .map((q) => `${q.queryId} ${q.communicationState}`)
    ).toEqual([]);
    const review = ok(engine, { type: "REQUEST_LOCK" });
    const audit = review.find((e) => e.type === "LOCK_AUDIT");
    expect(
      audit && audit.type === "LOCK_AUDIT" ? audit.result.discrepancies : null
    ).toEqual([]);
    ok(engine, { type: "CONFIRM_LOCK" });
    expect(engine.view().fsmState).toBe("LOCKED");
  });

  it("records who closed each settled thread in the audit trail", () => {
    const engine = startEngine();
    playFullLevel(engine, { closeAnswered: false });
    const closed = engine
      .view()
      .auditTrail.filter((a) => a.type === "QUERY_CLOSED");
    expect(closed.length).toBeGreaterThan(0);
    expect(closed.every((a) => a.actor === "DATA_ARCHITECT")).toBe(true);
  });
});
