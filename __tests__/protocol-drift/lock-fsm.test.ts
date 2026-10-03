// @vitest-environment node
import { describe, expect, it } from "vitest";
import { WAVE1_GRAPH } from "@/lib/protocol-drift";
import { ok, playFullLevel, publish, startEngine } from "./helpers";

describe("lock review FSM", () => {
  it("moves PAUSED to LOCK_REVIEW, back to PAUSED, then to LOCKED", () => {
    const engine = startEngine();
    playFullLevel(engine);
    const review = ok(engine, { type: "REQUEST_LOCK" });
    expect(engine.view().fsmState).toBe("LOCK_REVIEW");
    const audit = review.find((e) => e.type === "LOCK_AUDIT");
    expect(audit && audit.type === "LOCK_AUDIT" && audit.result.canLock).toBe(
      true
    );
    expect(
      engine.dispatch({ type: "TICK", realMs: 5000 }).length
    ).toBeGreaterThan(0);
    expect(
      engine
        .dispatch({ type: "ADVANCE_TO", minute: 99999 })
        .some((e) => e.type === "COMMAND_REJECTED")
    ).toBe(true);
    ok(engine, { type: "RETURN_TO_WORKBENCH" });
    expect(engine.view().fsmState).toBe("PAUSED");
    ok(engine, { type: "REQUEST_LOCK" });
    const locked = ok(engine, { type: "CONFIRM_LOCK" });
    expect(engine.view().fsmState).toBe("LOCKED");
    expect(locked.some((e) => e.type === "LOCKED")).toBe(true);
    expect(engine.view().auditTrail.at(-1)?.type).toBe("DATABASE_LOCKED");
  });

  it("rejects mutations after lock", () => {
    const engine = startEngine();
    playFullLevel(engine);
    ok(engine, { type: "REQUEST_LOCK" });
    ok(engine, { type: "CONFIRM_LOCK" });
    const minute = engine.view().minute;
    for (const cmd of [
      { type: "LOAD_GRAPH", ...WAVE1_GRAPH },
      { type: "SET_PAUSED", isPaused: false },
      { type: "SET_SPEED", speed: 2 },
      { type: "STEP_TICK" },
      { type: "REPLAY_DERIVATIONS" },
      { type: "DRAFT_QUERY", issueId: "x", evidenceLinked: false },
      { type: "CONFIRM_LOCK" },
    ] as const) {
      const events = engine.dispatch(cmd);
      expect(
        events.some((e) => e.type === "COMMAND_REJECTED"),
        cmd.type
      ).toBe(true);
    }
    engine.dispatch({ type: "TICK", realMs: 10000 });
    expect(engine.view().minute).toBe(minute);
    expect(engine.view().fsmState).toBe("LOCKED");
  });

  it("refuses to confirm a lock while checks fail", () => {
    const engine = startEngine();
    publish(engine, WAVE1_GRAPH, "p1");
    ok(engine, { type: "REQUEST_LOCK" });
    const events = engine.dispatch({ type: "CONFIRM_LOCK" });
    const rejected = events.find((e) => e.type === "COMMAND_REJECTED");
    expect(
      rejected && rejected.type === "COMMAND_REJECTED" && rejected.reason
    ).toMatch(/failing checks/);
    expect(engine.view().fsmState).toBe("LOCK_REVIEW");
    expect(engine.view().lastLockAudit?.canLock).toBe(false);
  });
});
