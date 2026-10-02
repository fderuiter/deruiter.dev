import { describe, expect, it } from "vitest";
import {
  STUDY_24_081,
  STUDY_24_081_SITES,
  STUDY_24_081_TEAM,
  buildRetrospectiveExport,
  createStudy,
  exportAuditFindingsCsv,
  exportDecisionLogCsv,
  exportMeterTrajectoryCsv,
  exportRetrospectiveJson,
  finalizeStudy,
  resolveDecision,
} from "@/lib/study-director";

const createCompletedReport = () => {
  let state = createStudy(
    "test-export-seed",
    STUDY_24_081,
    STUDY_24_081_SITES,
    STUDY_24_081_TEAM
  );

  // Add sample decisions while study is running
  const dec1 = resolveDecision(state, {
    eventId: "event-01",
    optionId: "opt-a",
    label: "Option A",
    effects: { meters: { integrity: 5 } },
    attentionCost: 1,
    debtIfUndocumented: 0,
    documented: true,
  });
  if (dec1.ok) state = dec1.state;

  const dec2 = resolveDecision(state, {
    eventId: "event-02",
    optionId: "opt-b",
    label: 'Option "Quotes & Comma, Test"',
    effects: {},
    attentionCost: 2,
    debtIfUndocumented: 10,
    documented: false,
  });
  if (dec2.ok) state = dec2.state;

  state = { ...state, day: 77, status: "complete" };
  return finalizeStudy(state);
};

describe("study director retrospective export", () => {
  it("produces a valid retrospective JSON structure with required nodes", () => {
    const report = createCompletedReport();
    const exportObj = buildRetrospectiveExport(report);

    expect(exportObj.version).toBe(1);
    expect(typeof exportObj.exportedAt).toBe("string");
    expect(exportObj.setup).toEqual(report.state.setup);
    expect(exportObj.decisions).toEqual(report.state.log);
    expect(Array.isArray(exportObj.meterHistory)).toBe(true);
    expect(exportObj.meterHistory.length).toBeGreaterThan(0);
    expect(exportObj.evaluations).toEqual(report.evaluations);
    expect(exportObj.inspection).toEqual(report.inspection);
    expect(exportObj.lock).toEqual(report.lock);
    expect(exportObj.profile).toEqual(report.profile);

    const jsonString = exportRetrospectiveJson(report);
    expect(() => JSON.parse(jsonString)).not.toThrow();
    const parsed = JSON.parse(jsonString);
    expect(parsed.setup.id).toBe("24-081");
  });

  it("exports normalized CSV for decision log with proper escaping", () => {
    const report = createCompletedReport();
    const csv = exportDecisionLogCsv(report);

    const lines = csv.split("\n");
    expect(lines[0]).toBe(
      "Day,Event ID,Option ID,Label,Documented,Attention Spent"
    );
    expect(lines.length).toBeGreaterThan(1);

    // Check escaping of quotes & commas
    const quotedRow = lines.find((l) => l.includes("Quotes & Comma"));
    expect(quotedRow).toBeDefined();
    expect(quotedRow).toContain('"Option ""Quotes & Comma, Test"""');
  });

  it("exports normalized CSV for meter trajectory", () => {
    const report = createCompletedReport();
    const csv = exportMeterTrajectoryCsv(report);

    const lines = csv.split("\n");
    expect(lines[0]).toBe(
      "Day,Integrity,Compliance,Timeline,Budget,Client,Team"
    );
    expect(lines.length).toBe(report.state.day + 2); // Header + day 0 through day N
    expect(lines[1]).toMatch(/^0,\d+,\d+,\d+,\d+,\d+,\d+$/);
  });

  it("exports normalized CSV for audit/inspection findings", () => {
    const report = createCompletedReport();
    const csv = exportAuditFindingsCsv(report);

    const lines = csv.split("\n");
    expect(lines[0]).toBe("Event ID,Day,Question,Documented,Answer,Outcome");
    expect(lines.length).toBeGreaterThanOrEqual(1);
  });
});
