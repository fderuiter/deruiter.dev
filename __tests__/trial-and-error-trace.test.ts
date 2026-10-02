// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  DEMOGRAPHICS_SCENARIO,
  FIREWALL_ALERT,
  PROVENANCE_ALERT,
  TLF_PAIR_SYNERGY,
  advanceTable,
  applyTransition,
  createTableState,
  deriveTableView,
  scoreTimeline,
  traceCell,
  type StagedTable,
  type TableAction,
  type TableState,
} from "@/lib/trial-and-error";

const scenario = DEMOGRAPHICS_SCENARIO;
const snapshot = scenario.populationSnapshot;
const rulebook = scenario.rulebook;
const run = (
  actions: TableAction[],
  from: TableState = createTableState(scenario)
) =>
  actions.reduce(
    (state, action) => advanceTable(scenario, state, action),
    from
  );

const DRAFT_A = "C-T14.1.1-A";
const DM_LISTING = "C-L16.2.4";
const draftA = scenario.drawPile.find(
  (d) => d.id === "T-14.1.1-A"
) as StagedTable;
// Female, Total: "7 (63.6)" divides by the FAS N, a fatal denominator error.
const FEMALE_TOTAL = { row: 2, col: 2 };
// Female, Active: "4 (66.67)" carries too many decimals.
const FEMALE_ACTIVE = { row: 2, col: 1 };

const inspectA: TableAction = { type: "INSPECT_CARD", cardId: DRAFT_A };
const inspectAt = (cell: { row: number; col: number }): TableAction => ({
  type: "INSPECT_CELL",
  ...cell,
});
const traceAt = (cell: { row: number; col: number }): TableAction => ({
  type: "TRACE_CELL",
  ...cell,
});

/** Inspects every cell of Draft A and corrects every finding on it. */
function fixDraftA(state: TableState): TableState {
  let next = run([inspectA], state);
  for (let row = 0; row < draftA.rows.length; row++) {
    for (let col = 0; col < draftA.columns.length; col++) {
      next = run([inspectAt({ row, col })], next);
    }
  }
  for (const f of deriveTableView(scenario, next).inspection!.openFindings) {
    next = run([{ type: "CORRECT_FINDING", findingId: f.id }], next);
  }
  return next;
}

const playPair = (state: TableState) =>
  run(
    [
      { type: "CLOSE_INSPECT" },
      { type: "TOGGLE_SELECT", cardId: DRAFT_A },
      { type: "TOGGLE_SELECT", cardId: DM_LISTING },
      { type: "PLAY_HAND" },
    ],
    state
  );

describe("traceCell", () => {
  it("lists the SAP population on the table's own snapshot and matches the subjects a cell counts", () => {
    const trace = traceCell(
      draftA,
      snapshot,
      rulebook,
      FEMALE_ACTIVE.row,
      FEMALE_ACTIVE.col
    )!;
    const itt = snapshot.subjects.filter(
      (s) => s.populations.includes("ITT") && s.arm === "ACTIVE"
    );
    expect(trace.snapshotId).toBe(snapshot.id);
    expect(trace.rows.map((r) => r.usubjid)).toEqual(
      itt.map((s) => s.id).sort()
    );
    expect(trace.matchedSubjectIds).toEqual(
      itt
        .filter((s) => s.sex === "F")
        .map((s) => s.id)
        .sort()
    );
    expect(trace.rows.every((r) => r.arm === "ACTIVE")).toBe(true);
    expect(trace.rows[0]).toMatchObject({
      visit: "Baseline",
      parameter: "Sex",
    });
  });

  it("counts every subject for an N or a mean and filters the Total column to no arm", () => {
    const n = traceCell(draftA, snapshot, rulebook, 0, 2)!;
    const itt = snapshot.subjects.filter((s) => s.populations.includes("ITT"));
    expect(n.rows).toHaveLength(itt.length);
    expect(n.matchedSubjectIds).toHaveLength(itt.length);
    const age = traceCell(draftA, snapshot, rulebook, 1, 0)!;
    expect(age.rows[0].parameter).toBe("Age (years)");
    expect(age.matchedSubjectIds).toHaveLength(age.rows.length);
    const old = traceCell(draftA, snapshot, rulebook, 4, 2)!;
    expect(old.matchedSubjectIds).toEqual(
      itt
        .filter((s) => s.age >= 65)
        .map((s) => s.id)
        .sort()
    );
  });

  it("matches adverse-event rows by subject, once however many events match", () => {
    const aeTable: StagedTable = {
      ...draftA,
      rows: [
        {
          id: "any",
          label: "Any TEAE",
          statistic: { kind: "AE_SUBJECT_COUNT_PCT" },
        },
      ],
      cells: [["", "", ""]],
    };
    const trace = traceCell(
      aeTable,
      snapshot,
      { ...rulebook, populationSuit: "SAFETY" },
      0,
      2
    )!;
    const withAe = snapshot.subjects.filter(
      (s) =>
        s.populations.includes("SAFETY") && (s.adverseEvents ?? []).length > 0
    );
    expect(trace.matchedSubjectIds).toEqual(withAe.map((s) => s.id).sort());
    const none = trace.rows.find(
      (r) => !trace.matchedSubjectIds.includes(r.usubjid)
    );
    if (none) expect(none.value).toBe("None matching");
    expect(trace.rows[0].visit).toBe("On treatment");
  });

  it("returns null outside the table", () => {
    expect(traceCell(draftA, snapshot, rulebook, 9, 0)).toBeNull();
    expect(traceCell(draftA, snapshot, rulebook, 0, 9)).toBeNull();
  });
});

describe("TRACE_CELL", () => {
  it("links a Table and its supporting Listing on both faces", () => {
    const view = deriveTableView(scenario, createTableState(scenario));
    const pairs = (id: string) =>
      view.hand.find((h) => h.card.id === id)!.pairedWith;
    expect(pairs(DRAFT_A)).toEqual([DM_LISTING]);
    expect(pairs(DM_LISTING)).toContain(DRAFT_A);
    expect(pairs("C-T14.1.2")).toEqual(["C-L16.1.1"]);
  });

  it("refuses without an open Inspect view, and on a cell with no revealed redline", () => {
    expect(run([traceAt(FEMALE_TOTAL)]).lastEvent).toMatchObject({
      kind: "REFUSED",
      message: "Open a card's Inspect view first.",
    });
    const unrevealed = run([inspectA, traceAt(FEMALE_TOTAL)]);
    expect(unrevealed.lastEvent?.message).toMatch(/^Only a flagged cell/);
    const clean = run([
      inspectA,
      inspectAt({ row: 0, col: 0 }),
      traceAt({ row: 0, col: 0 }),
    ]);
    expect(clean.lastEvent?.kind).toBe("REFUSED");
    expect(clean.auditLog).toEqual([]);
  });

  it("records the traced subject rows in the audit log and keeps the hand and review state", () => {
    const before = run([
      { type: "TOGGLE_SELECT", cardId: DRAFT_A },
      inspectA,
      inspectAt(FEMALE_TOTAL),
    ]);
    const traced = run([traceAt(FEMALE_TOTAL)], before);
    const expected = traceCell(draftA, snapshot, rulebook, 2, 2)!;
    expect(traced.lastEvent?.kind).toBe("TRACED");
    expect(traced.lastEvent?.message).toContain(
      `Listing 16.2.4 on ${snapshot.id}`
    );
    expect(traced.auditLog).toEqual([
      {
        cardId: DRAFT_A,
        listingId: DM_LISTING,
        cell: FEMALE_TOTAL,
        findingIds: expect.any(Array),
        subjectIds: expected.rows.map((r) => r.usubjid),
        matchedSubjectIds: expected.matchedSubjectIds,
        snapshotId: snapshot.id,
        resolution: "OPEN",
        superseded: false,
      },
    ]);
    expect(traced.selected).toEqual(before.selected);
    expect(traced.inspections).toEqual(before.inspections);
    expect(traced.cpu).toEqual(before.cpu);
    // Tracing again cycles in the UI; the log keeps one entry per cell.
    expect(run([traceAt(FEMALE_TOTAL)], traced).auditLog).toHaveLength(1);

    const view = deriveTableView(scenario, traced).inspection!.trace;
    expect(view.listing?.id).toBe(DM_LISTING);
    expect(view.blocked).toBeNull();
    expect(view.cells["2:2"]).toEqual(expected);
    expect(view.synergy).toBe(false);
  });

  it("marks a trace resolved once every finding on its cell is corrected", () => {
    let state = run([inspectA, inspectAt(FEMALE_TOTAL), traceAt(FEMALE_TOTAL)]);
    for (const id of state.auditLog[0].findingIds) {
      state = run([{ type: "CORRECT_FINDING", findingId: id }], state);
    }
    expect(state.auditLog[0].resolution).toBe("RESOLVED");
    expect(deriveTableView(scenario, state).inspection!.trace.synergy).toBe(
      true
    );
    expect(deriveTableView(scenario, state).auditLog).toBe(state.auditLog);
  });

  it("refuses without a supporting Listing in hand", () => {
    const noListing = run([
      { type: "TOGGLE_SELECT", cardId: DM_LISTING },
      { type: "DISCARD" },
      inspectA,
      inspectAt(FEMALE_TOTAL),
    ]);
    expect(noListing.hand).not.toContain(DM_LISTING);
    const view = deriveTableView(scenario, noListing).inspection!.trace;
    expect(view.listing).toBeNull();
    expect(view.blocked).toMatch(/^No supporting Listing/);
    expect(run([traceAt(FEMALE_TOTAL)], noListing).lastEvent?.kind).toBe(
      "REFUSED"
    );
  });

  it("blocks stale provenance with an alert, and a recompile supersedes the old traces", () => {
    const traced = run([
      inspectA,
      inspectAt(FEMALE_TOTAL),
      traceAt(FEMALE_TOTAL),
    ]);
    const subject = snapshot.subjects.find((s) =>
      s.populations.includes("ITT")
    )!;
    const moved = applyTransition(snapshot, {
      id: "TX-TEST",
      subjectId: subject.id,
      reason: "DROPOUT",
      change: "LEAVE",
      populations: ["ITT"],
      effectiveAt: "2026-09-25T00:00:00Z",
      description: "Withdrew consent.",
    });
    if (!moved.ok) throw new Error(moved.message);
    const changed: TableState = {
      ...traced,
      snapshots: [snapshot, moved.snapshot],
    };
    const view = deriveTableView(scenario, changed).inspection!.trace;
    expect(view.blocked).toBe(PROVENANCE_ALERT);
    expect(run([traceAt(FEMALE_TOTAL)], changed).lastEvent).toMatchObject({
      kind: "REFUSED",
      message: PROVENANCE_ALERT,
    });
    const recompiled = run([{ type: "RECOMPILE", cardId: DRAFT_A }], changed);
    expect(recompiled.auditLog[0].superseded).toBe(true);
  });

  it("refuses under a DMC firewall", () => {
    const open = run([inspectA, inspectAt(FEMALE_TOTAL)]);
    const firewalled: TableState = {
      ...open,
      modifiers: [
        {
          id: "FW",
          name: "DMC firewall",
          description: "Blinded.",
          debuffType: "BLIND_FIREWALL",
        },
      ],
    };
    expect(run([traceAt(FEMALE_TOTAL)], firewalled).lastEvent?.message).toBe(
      FIREWALL_ALERT
    );
  });
});

describe("TLF Pair synergy", () => {
  it("multiplies a traced, fully resolved Pair and shows as an X_MULT timeline step", () => {
    const plain = playPair(fixDraftA(createTableState(scenario)));
    const tracedState = run(
      [traceAt(FEMALE_TOTAL)],
      fixDraftA(createTableState(scenario))
    );
    const traced = playPair(tracedState);
    const base = plain.lastPlay!.evaluation;
    const boosted = traced.lastPlay!.evaluation;
    expect(boosted.handType).toBe("TLF_PAIR");
    expect(boosted.xMult.factors).toEqual([
      { sourceId: `TLF-PAIR@${DRAFT_A}`, value: TLF_PAIR_SYNERGY },
    ]);
    expect(boosted.finalMult).toBe(base.finalMult * TLF_PAIR_SYNERGY);
    expect(boosted.score).toBe(base.score * TLF_PAIR_SYNERGY);
    // The audit log outlives the played cards, for end-of-Blind grading.
    expect(traced.auditLog).toHaveLength(1);

    const steps = scoreTimeline(boosted, { roundScoreBefore: 0, target: 1000 });
    const step = steps.find((s) => s.kind === "X_MULT");
    expect(step).toMatchObject({ source: `TLF-PAIR@${DRAFT_A}`, factor: 2 });
    expect(step?.text).toContain("traced to Listing 16.2.4");
  });

  it("is not earned while a traced discrepancy is open", () => {
    let state = run([
      inspectA,
      inspectAt(FEMALE_TOTAL),
      inspectAt(FEMALE_ACTIVE),
    ]);
    state = run([traceAt(FEMALE_TOTAL), traceAt(FEMALE_ACTIVE)], state);
    for (const id of state.auditLog[0].findingIds) {
      state = run([{ type: "CORRECT_FINDING", findingId: id }], state);
    }
    expect(state.auditLog.map((e) => e.resolution)).toEqual([
      "RESOLVED",
      "OPEN",
    ]);
    const played = playPair(state);
    expect(
      played.lastPlay!.evaluation.xMult.factors.map((f) => f.sourceId)
    ).not.toContain(`TLF-PAIR@${DRAFT_A}`);
  });

  it("previews the synergy on the selection before the hand is played", () => {
    const state = run(
      [
        traceAt(FEMALE_TOTAL),
        { type: "TOGGLE_SELECT", cardId: DRAFT_A },
        { type: "TOGGLE_SELECT", cardId: DM_LISTING },
      ],
      fixDraftA(createTableState(scenario))
    );
    expect(deriveTableView(scenario, state).preview?.xMult.product).toBe(
      TLF_PAIR_SYNERGY
    );
  });
});
