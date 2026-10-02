// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  DEMOGRAPHICS_SCENARIO,
  QcReportSchema,
  validate,
  type PopulationSnapshot,
  type SapRulebook,
  type StagedTable,
} from "@/lib/trial-and-error";

const { populationSnapshot: snapshot, rulebook } = DEMOGRAPHICS_SCENARIO;
const [draftA, draftB, draftC] = DEMOGRAPHICS_SCENARIO.drawPile;

/** Draft C (clean) with some cells overridden. */
function withCells(overrides: Record<string, string>): StagedTable {
  return {
    ...draftC,
    cells: draftC.cells.map((row, r) =>
      row.map((cell, c) => overrides[`${r}:${c}`] ?? cell)
    ),
  };
}

describe("validate: Demographics QC Desk", () => {
  it("finds nothing wrong with the clean draft", () => {
    const report = validate(draftC, snapshot, rulebook);
    expect(report.findings).toEqual([]);
    expect(report.populationN).toBe(12);
    expect(report).toMatchObject({
      tableId: "T-14.1.1-C",
      rulebookId: "SAP-DM-001",
      populationSnapshotId: "SNAP-P1-v1",
    });
    expect(QcReportSchema.safeParse(report).success).toBe(true);
  });

  it("explains Draft A's seeded discrepancies in stable row, column order", () => {
    const report = validate(draftA, snapshot, rulebook);
    expect(
      report.findings.map((f) => [
        f.id,
        f.category,
        f.severity,
        f.observed,
        f.expected,
      ])
    ).toEqual([
      ["SAP-DM-03@r1c2", "ROUNDING", "MINOR", "45.3", "45.2"],
      ["SAP-DM-02@r2c1", "PRECISION", "MINOR", "4 (66.67)", "4 (66.7)"],
      ["SAP-DM-01@r2c2", "DENOMINATOR", "FATAL", "7 (63.6)", "7 (58.3)"],
      ["SAP-DM-01@r3c2", "DENOMINATOR", "FATAL", "5 (45.5)", "5 (41.7)"],
      ["SAP-DM-01@r4c2", "DENOMINATOR", "FATAL", "3 (27.3)", "3 (25.0)"],
    ]);
    const denominator = report.findings[2];
    expect(denominator.evidence).toBe(
      "63.6 divides by 11, the FAS N for Total. The SAP population is ITT (N=12): 7 × 100 / 12 gives 58.3."
    );
    expect(denominator.rule).toContain("FAS is a separate population");
    expect(report.findings[0].evidence).toContain("half-to-even");
    expect(report.findings[0].evidence).toContain(
      "45.3 is half-away-from-zero"
    );
    expect(report.findings[1].evidence).toBe(
      "66.67 shows 2 decimal places; the SAP specifies 1."
    );
  });

  it("flags an integer percentage in Draft B as a precision finding only", () => {
    const report = validate(draftB, snapshot, rulebook);
    expect(report.findings).toHaveLength(1);
    expect(report.findings[0]).toMatchObject({
      id: "SAP-DM-02@r2c0",
      category: "PRECISION",
      evidence: "50 shows 0 decimal places; the SAP specifies 1.",
    });
  });

  it("returns deep-equal output for the same input, twice, without mutating inputs", () => {
    const before = structuredClone({ draftA, snapshot, rulebook });
    const first = validate(draftA, snapshot, rulebook);
    const second = validate(draftA, snapshot, rulebook);
    expect(second).toEqual(first);
    expect(second).not.toBe(first);
    expect({ draftA, snapshot, rulebook }).toEqual(before);
  });

  it("derives denominators from the snapshot, not from the table", () => {
    // Drop S-012 (Active, male) from ITT: the same displayed table now fails.
    const amended: PopulationSnapshot = {
      ...snapshot,
      subjects: snapshot.subjects.map((s) =>
        s.id === "S-012" ? { ...s, populations: ["SCREENED"] } : s
      ),
    };
    const report = validate(draftC, amended, rulebook);
    expect(report.populationN).toBe(11);
    expect(report.findings.map((f) => f.id)).toContain("SAP-DM-01@r0c1");
    expect(
      report.findings.find((f) => f.id === "SAP-DM-01@r0c1")?.evidence
    ).toBe(
      "N=6 is the Screened count for Active; the SAP population is ITT (N=5)."
    );
  });

  it("treats FAS as equivalent to ITT only when the SAP declares an alias", () => {
    const fasTable = withCells({ "2:2": "7 (63.6)" });
    expect(validate(fasTable, snapshot, rulebook).findings[0].category).toBe(
      "DENOMINATOR"
    );

    for (const alias of [
      { population: "FAS" as const, equals: "ITT" as const },
      { population: "ITT" as const, equals: "FAS" as const },
    ]) {
      const aliased: SapRulebook = { ...rulebook, populationAliases: [alias] };
      const finding = validate(fasTable, snapshot, aliased).findings[0];
      expect(finding.category).toBe("VALUE");
      expect(finding.evidence).toBe(
        "63.6 cannot be reproduced from the snapshot: 7 × 100 / 12 gives 58.3."
      );
    }
  });

  it("classifies header N errors as denominator or value findings", () => {
    const report = validate(
      withCells({ "0:1": "5", "0:2": "13", "0:0": "six" }),
      snapshot,
      rulebook
    );
    expect(report.findings.map((f) => [f.id, f.evidence])).toEqual([
      ["SAP-DM-04@r0c0", '"six" is not a subject count.'],
      [
        "SAP-DM-01@r0c1",
        "N=5 is the FAS count for Active; the SAP population is ITT (N=6).",
      ],
      ["SAP-DM-04@r0c2", "N=13 does not match the snapshot's ITT count (12)."],
    ]);
  });

  it("classifies malformed and mismatched statistics", () => {
    const report = validate(
      withCells({
        "1:0": "old",
        "1:1": "44.4",
        "2:0": "three",
        "2:1": "5 (83.3)",
        "3:0": "3 (51.0)",
      }),
      snapshot,
      rulebook
    );
    expect(report.findings.map((f) => [f.id, f.expected, f.evidence])).toEqual([
      ["SAP-DM-04@r1c0", "49.8", '"old" is not a number.'],
      [
        "SAP-DM-04@r1c1",
        "40.7",
        "44.4 cannot be reproduced from the snapshot: 244 / 6 gives 40.7.",
      ],
      ["SAP-DM-04@r2c0", "3 (50.0)", '"three" is not in "n (%)" form.'],
      [
        "SAP-DM-04@r2c1",
        "4 (66.7)",
        "n=5 does not match the snapshot, which has 4 qualifying subjects.",
      ],
      [
        "SAP-DM-04@r3c0",
        "3 (50.0)",
        "51.0 cannot be reproduced from the snapshot: 3 × 100 / 6 gives 50.0.",
      ],
    ]);
  });

  it("reports a precision slip and a wrong denominator on the same cell", () => {
    const report = validate(
      withCells({ "2:2": "7 (63.64)" }),
      snapshot,
      rulebook
    );
    expect(report.findings.map((f) => f.category)).toEqual([
      "DENOMINATOR",
      "PRECISION",
    ]);
  });

  it("detects a mean age computed over the wrong population", () => {
    // FAS excludes S-008 (66): (543 − 66) / 11 = 43.36…
    const report = validate(withCells({ "1:2": "43.4" }), snapshot, rulebook);
    expect(report.findings[0]).toMatchObject({
      category: "DENOMINATOR",
      expected: "45.2",
    });
    expect(report.findings[0].evidence).toContain("the FAS N for Total");
  });

  it("handles columns with no subjects in the SAP population", () => {
    const empty: PopulationSnapshot = {
      ...snapshot,
      subjects: snapshot.subjects.map((s) =>
        s.arm === "PLACEBO" ? { ...s, populations: [] } : s
      ),
    };
    const table = withCells({
      "0:0": "0",
      "1:0": "—",
      "2:0": "—",
      "3:0": "0 (0.0)",
      "4:0": "—",
    });
    const report = validate(table, empty, rulebook);
    const placebo = report.findings.filter((f) => f.cell.col === 0);
    expect(placebo.map((f) => [f.id, f.expected])).toEqual([
      ["SAP-DM-04@r3c0", "—"],
    ]);
  });

  it("treats missing cells in a malformed table as empty rather than crashing", () => {
    const ragged = { ...draftC, cells: [draftC.cells[0]] };
    const report = validate(ragged, snapshot, rulebook);
    expect(report.findings.every((f) => f.observed === "")).toBe(true);
    expect(report.findings).toHaveLength(12);
  });
});
