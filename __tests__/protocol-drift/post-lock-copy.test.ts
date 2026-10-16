// @vitest-environment node
import { describe, expect, it } from "vitest";
import { isAwaitingLock } from "@/components/protocol-drift/store";
import {
  ISSUE_LABELS,
  LOCK_LABELS,
  pauseReasonText,
} from "@/components/protocol-drift/labels";
import { wireRefusal } from "@/components/protocol-drift/wire-refusal";
import { ok, playFullLevel, startEngine } from "./helpers";

describe("post-lock state and player-facing copy (#2276)", () => {
  it("stops saying 'Request Database Lock' once the study is locked", () => {
    const engine = startEngine();
    playFullLevel(engine);
    if (engine.view().fsmState === "WAVE_REVIEW")
      ok(engine, { type: "SET_PAUSED", isPaused: true });
    expect(isAwaitingLock(engine.view())).toBe(true);
    ok(engine, { type: "REQUEST_LOCK" });
    expect(isAwaitingLock(engine.view())).toBe(false);
    ok(engine, { type: "CONFIRM_LOCK" });
    expect(engine.view().fsmState).toBe("LOCKED");
    expect(isAwaitingLock(engine.view())).toBe(false);
  });

  it("names a new issue kind in words, never its code", () => {
    expect(pauseReasonText("NEW_ISSUE_CATEGORY:PARTIAL_DATE")).toBe(
      "new kind of issue, partial date"
    );
    for (const label of [
      ...Object.values(ISSUE_LABELS),
      ...Object.values(LOCK_LABELS),
    ]) {
      expect(label).not.toMatch(/[A-Z]{2,}_[A-Z]/);
    }
  });

  it("reads a type refusal as plain English", () => {
    expect(
      wireRefusal("ExtractField", "visit_date", "PivotToObservation", "dbp")
    ).toBe(
      "Can't wire ExtractField.visit_date to PivotToObservation.dbp: it sends date data to a field pin."
    );
  });
});
