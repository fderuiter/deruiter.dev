// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  BIOSTAT_OPS_CAMPAIGN,
  CSR_LOCK_SCENARIO,
  advanceRun,
  createRunState,
  deriveRunView,
  runBlinds,
  type RunState,
} from "@/lib/trial-and-error";
import { playBlind } from "./utils/trial-and-error-bot";

/**
 * #2149: once a won campaign was submitted and ended, "File protocol
 * amendment" still unlocked the CSR package and reopened the Boss.
 */

const C = BIOSTAT_OPS_CAMPAIGN;
const ENDED =
  "The run was submitted and has ended, so the package stays locked.";

/** A run whose current Blind is marked cleared, without playing it. */
const cleared = (run: RunState): RunState => ({
  ...run,
  table: { ...run.table, status: "CLEARED", rewardClaimed: "claimed" },
});

/** The campaign for `seed`, with CSR Lock played and the package locked. */
function lockedCampaign(seed: string): RunState {
  let run = createRunState(C, seed);
  while (runBlinds(C, run)[run.blindIndex].id !== CSR_LOCK_SCENARIO.id) {
    run = advanceRun(C, cleared(run), { type: "NEXT_BLIND" });
  }
  const { actions } = playBlind(
    deriveRunView(C, run).blind,
    run.table,
    "PERFECT"
  );
  for (const action of actions) {
    if (action.type === "RESET") continue;
    run = advanceRun(C, run, action);
  }
  return run;
}

describe("Trial & Error: an ended run keeps its CSR lock (#2149)", () => {
  it("offers the amendment on the won choice screen", () => {
    const won = lockedCampaign("alpha");
    expect(won.table.status).toBe("CLEARED");
    expect(won.table.lock).not.toBeNull();
    const lock = deriveRunView(C, won).table.csrLock;
    expect(lock?.lock).not.toBeNull();
    expect(lock?.amendRefusal).toBeNull();
  });

  it("refuses the amendment once the run is submitted and ended", () => {
    const ended = advanceRun(C, lockedCampaign("alpha"), { type: "END_RUN" });
    expect(ended.ended).toBe(true);
    expect(deriveRunView(C, ended).table.csrLock?.amendRefusal).toBe(ENDED);

    const after = advanceRun(C, ended, { type: "AMEND_PROTOCOL" });
    expect(after.table.lock).toEqual(ended.table.lock);
    expect(after.table.status).toBe("CLEARED");
    expect(after.table.amendments).toBe(ended.table.amendments);
    expect(after.table.lastEvent).toMatchObject({
      kind: "REFUSED",
      message: ENDED,
    });
  });
});
