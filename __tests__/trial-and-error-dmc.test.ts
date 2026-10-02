// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  CPU_COSTS,
  DEMOGRAPHICS_SCENARIO,
  FIREWALL_CELL,
  UNBLINDING_RULE_ID,
  advanceTable,
  createTableState,
  deriveTableView,
  structuralQc,
  type StagedTable,
  type TableAction,
  type TableState,
} from "@/lib/trial-and-error";
import {
  BLINDED,
  CLOSED_VALUES,
  DMC_SCENARIO,
} from "./utils/trial-and-error-dmc";

const scenario = DMC_SCENARIO;
const [A, B, C] = BLINDED;
const run = (
  actions: TableAction[],
  from: TableState = createTableState(scenario)
) =>
  actions.reduce(
    (state, action) => advanceTable(scenario, state, action),
    from
  );
const view = (state: TableState) => deriveTableView(scenario, state);
const cardView = (state: TableState, id: string) =>
  view(state).hand.find((h) => h.card.id === id)!;
const draft = (id: string) =>
  DEMOGRAPHICS_SCENARIO.drawPile.find((d) => d.id === id) as StagedTable;
const shell = scenario.shells.find((s) => s.id === "T-14.1.1");
const allQc = BLINDED.map((cardId): TableAction => ({
  type: "STRUCTURAL_QC",
  cardId,
}));

describe("structuralQc", () => {
  it("passes a clean draft without reading a value", () => {
    const report = structuralQc(draft("T-14.1.1-C"), shell);
    expect(report.passed).toBe(true);
    expect(report.checks.map((c) => c.check)).toEqual([
      "COLUMN_BALANCE",
      "MISSING_DATA",
      "FORMAT",
    ]);
  });

  it("flags a row whose arms print different formats, naming the row only", () => {
    const report = structuralQc(draft("T-14.1.1-B"), shell);
    const format = report.checks.find((c) => c.check === "FORMAT")!;
    expect(format.passed).toBe(false);
    expect(format.detail).toMatch(/^Mixed formats across arms in: /);
    expect(format.detail).not.toMatch(/\d/);
  });

  it("flags a missing arm column and empty cells", () => {
    const base = draft("T-14.1.1-C");
    const oneArm: StagedTable = {
      ...base,
      columns: base.columns.filter((c) => c.arm !== "ACTIVE"),
      cells: base.cells.map((row) =>
        row.filter((_, i) => base.columns[i].arm !== "ACTIVE")
      ),
    };
    const report = structuralQc(oneArm, undefined);
    expect(report.checks[0]).toMatchObject({
      passed: false,
      detail: "No Active column.",
    });
    const holed: StagedTable = {
      ...base,
      cells: base.cells.map((row, r) =>
        r === 1 ? ["", ...row.slice(1)] : row
      ),
    };
    expect(structuralQc(holed, undefined).checks[1].passed).toBe(false);
  });
});

describe("DMC open session", () => {
  it("deals blinded outputs face down with no closed-session value in the view", () => {
    const state = createTableState(scenario);
    const v = view(state);
    expect(v.session).toBe("OPEN");
    for (const id of BLINDED) {
      const h = cardView(state, id);
      expect(h).toMatchObject({ blinded: true, faceDown: true });
      expect(h.stamps).toContain("BLINDED");
      expect(h.inspectable).toBe(false);
      expect(h.face.kind).toBe("TABLE");
      if (h.face.kind === "TABLE") {
        expect(
          h.face.rows.every((r) => r.values.every((x) => x === FIREWALL_CELL))
        ).toBe(true);
      }
    }
    const serialized = JSON.stringify(v);
    for (const value of CLOSED_VALUES) {
      expect(serialized).not.toContain(value);
    }
    // The same values are on the unblinded table, so the check is live.
    const plain = JSON.stringify(
      deriveTableView(
        DEMOGRAPHICS_SCENARIO,
        createTableState(DEMOGRAPHICS_SCENARIO)
      )
    );
    for (const value of CLOSED_VALUES) expect(plain).toContain(value);
  });

  it("refuses Inspect on a face-down output", () => {
    const state = run([{ type: "INSPECT_CARD", cardId: A }]);
    expect(state.inspecting).toBeNull();
    expect(state.lastEvent?.message).toBe(
      "Table 14.1.1 (Draft A) is face down in the DMC open session: run structural QC, or convene the closed session."
    );
  });

  it("runs structural QC across the firewall for Inspect CPU, and logs the access", () => {
    const start = createTableState(scenario);
    const state = run([{ type: "STRUCTURAL_QC", cardId: B }], start);
    expect(state.cpu.available).toBe(start.cpu.available - CPU_COSTS.INSPECT);
    const h = cardView(state, B);
    expect(h.structural?.passed).toBe(false);
    expect(h.unverified).toBe(false);
    expect(h.faceDown).toBe(true);
    expect(state.accessLog).toEqual([
      expect.objectContaining({
        seq: 1,
        kind: "STRUCTURAL_QC",
        cardId: B,
        session: "OPEN",
        authorized: true,
      }),
    ]);
    // Re-running is free and logs nothing new.
    const again = run([{ type: "STRUCTURAL_QC", cardId: B }], state);
    expect(again.cpu).toEqual(state.cpu);
    expect(again.accessLog).toHaveLength(1);
    expect(JSON.stringify(view(again))).not.toContain("49.8");
  });

  it("withholds a face-down output's finding evidence when it is played", () => {
    const state = run([
      { type: "TOGGLE_SELECT", cardId: A },
      { type: "PLAY_HAND" },
    ]);
    const evaluation = state.lastPlay!.evaluation;
    expect(evaluation.ruleResults.length).toBeGreaterThan(0);
    for (const r of evaluation.ruleResults) {
      expect(r.evidence).toBe(
        "Table 14.1.1 (Draft A): closed-session finding; its values are withheld in the open session."
      );
    }
    const serialized = JSON.stringify(view(state));
    for (const value of CLOSED_VALUES) {
      expect(serialized).not.toContain(value);
    }
  });
});

describe("unauthorized unblinding", () => {
  it("reveals the card, logs a violation and zeroes the next hand", () => {
    const state = run([{ type: "PEEK_BLINDED", cardId: A }]);
    expect(cardView(state, A).faceDown).toBe(false);
    expect(state.pendingViolations).toEqual([A]);
    expect(state.accessLog.at(-1)).toMatchObject({
      kind: "UNAUTHORIZED_UNBLINDING",
      cardId: A,
      authorized: false,
    });
    expect(state.lastEvent?.message).toBe(
      "Unauthorized unblinding of Table 14.1.1 (Draft A) in the open session. Audit finding logged; the next hand played scores ×0 Mult."
    );

    const selected = run([{ type: "TOGGLE_SELECT", cardId: C }], state);
    expect(view(selected).preview?.zeroRule.ruleIds).toEqual([
      UNBLINDING_RULE_ID,
    ]);
    const played = run([{ type: "PLAY_HAND" }], selected);
    expect(played.lastPlay?.evaluation).toMatchObject({
      finalMult: 0,
      score: 0,
      zeroRule: { triggered: true, ruleIds: [UNBLINDING_RULE_ID] },
    });
    expect(played.roundScore).toBe(0);
    expect(played.pendingViolations).toEqual([]);
    const zero = view(played).lastTimeline?.find((s) => s.kind === "ZERO_RULE");
    expect(zero).toMatchObject({ label: "UNBLINDING" });
  });

  it("refuses to peek at a card that is not face down", () => {
    const state = run([{ type: "PEEK_BLINDED", cardId: "C-T14.1.2" }]);
    expect(state.lastEvent?.message).toBe("Table 14.1.2 is not face down.");
    expect(state.accessLog).toEqual([]);
  });
});

describe("DMC session changes", () => {
  it("convenes the closed session only after structural QC of every blinded output", () => {
    const early = run([
      { type: "STRUCTURAL_QC", cardId: A },
      { type: "SET_SESSION", session: "CLOSED" },
    ]);
    expect(early.session).toBe("OPEN");
    expect(view(early).sessionRefusal).toBe(
      "Run structural QC on every blinded output before convening the closed session: Table 14.1.1 (Draft B), Table 14.1.1 (Draft C)."
    );

    const closed = run([...allQc, { type: "SET_SESSION", session: "CLOSED" }]);
    expect(closed.session).toBe("CLOSED");
    expect(closed.accessLog.at(-1)).toMatchObject({
      kind: "SESSION_CLOSED",
      authorized: true,
      session: "CLOSED",
      text: "Closed DMC session convened under DMC Charter §7.2 (closed-session procedures): 3 blinded outputs revealed.",
    });
    for (const id of BLINDED) expect(cardView(closed, id).faceDown).toBe(false);
    expect(JSON.stringify(view(closed))).toContain("49.8");

    const inspected = run([{ type: "INSPECT_CARD", cardId: A }], closed);
    expect(inspected.inspecting).toBe(A);
  });

  it("returning to the open session re-blinds and withdraws closed-session reviews", () => {
    const reviewed = run([
      ...allQc,
      { type: "SET_SESSION", session: "CLOSED" },
      { type: "INSPECT_CARD", cardId: A },
    ]);
    const reopened = run([{ type: "SET_SESSION", session: "OPEN" }], reviewed);
    expect(reopened.session).toBe("OPEN");
    expect(reopened.inspections[A]).toBeUndefined();
    expect(reopened.inspecting).toBeNull();
    expect(cardView(reopened, A).faceDown).toBe(true);
    expect(reopened.accessLog.at(-1)?.text).toBe(
      "Returned to the open session: 3 blinded outputs face down again. Reviews withdrawn: Table 14.1.1 (Draft A)."
    );
    expect(reopened.accessLog.map((e) => e.seq)).toEqual([1, 2, 3, 4, 5]);
  });

  it("refuses a session change without a chartered DMC", () => {
    const plain = createTableState(DEMOGRAPHICS_SCENARIO);
    const state = advanceTable(DEMOGRAPHICS_SCENARIO, plain, {
      type: "SET_SESSION",
      session: "CLOSED",
    });
    expect(state.lastEvent?.message).toBe(
      "No Data Monitoring Committee is chartered for this Blind."
    );
    expect(deriveTableView(DEMOGRAPHICS_SCENARIO, plain).dmcCharter).toBeNull();
  });
});
