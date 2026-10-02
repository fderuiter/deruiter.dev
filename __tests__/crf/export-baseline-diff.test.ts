// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  serializeBaselineDiffToCsv,
  serializeBaselineDiffToJson,
  serializeBaselineDiffToText,
  generateExportFilename,
  exportBaselineDiffCsv,
  exportBaselineDiffJson,
  exportBaselineDiffText,
} from "@/lib/crf/export-baseline-diff";
import type { BaselineComparisonResult } from "@/lib/crf/study-baseline-diff";

vi.mock("@/lib/download", () => ({
  downloadFile: vi.fn().mockReturnValue(true),
}));

import { downloadFile } from "@/lib/download";

function buildSampleComparison(): BaselineComparisonResult {
  return {
    baselineId: "base-123",
    baselineVersionTag: "v1.0",
    baselineLabel: "Initial Protocol Approval",
    comparedAt: "2026-10-02T12:00:00.000Z",
    summary: {
      addedCount: 1,
      removedCount: 1,
      modifiedCount: 1,
      totalChanges: 3,
      hasChanges: true,
      byCategory: {
        study_metadata: { added: 0, removed: 0, modified: 1 },
        form: { added: 0, removed: 0, modified: 0 },
        section: { added: 0, removed: 0, modified: 0 },
        field: { added: 1, removed: 0, modified: 0 },
        rule: { added: 0, removed: 1, modified: 0 },
        formula: { added: 0, removed: 0, modified: 0 },
        codelist: { added: 0, removed: 0, modified: 0 },
        schedule: { added: 0, removed: 0, modified: 0 },
      },
    },
    entries: [
      {
        id: "study_metadata:studyName",
        category: "study_metadata",
        changeType: "modified",
        label: "Study Name",
        breadcrumb: ["Study Metadata", "Study Name"],
        changedFields: ["studyName"],
        oldValue: "Phase III Study",
        newValue: "Phase III Study (Amendment 1)",
      },
      {
        id: "fld_sysbp",
        category: "field",
        changeType: "added",
        label: "Systolic Blood Pressure",
        breadcrumb: ["Vital Signs", "Vital Signs", "Systolic Blood Pressure"],
        newValue: { variableName: "SYSBP", dataType: "number" },
      },
      {
        id: "rule_1",
        category: "rule",
        changeType: "removed",
        label: "Check SYSBP Limit",
        breadcrumb: ["Vital Signs", "Rules", "Check SYSBP Limit"],
        oldValue: { name: "Check SYSBP Limit", queryMessage: "Out of range" },
        affectedUses: ["Referenced field id(s): fld_sysbp"],
      },
    ],
  };
}

describe("Baseline Diff Serializers & Export Helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("serializeBaselineDiffToCsv", () => {
    it("generates a valid CSV with headers and escaped cell values", () => {
      const comparison = buildSampleComparison();
      const csv = serializeBaselineDiffToCsv(comparison);

      const lines = csv.split("\r\n");
      expect(lines[0]).toBe(
        '"Category","Change Type","Label","Breadcrumb","Changed Fields","Old Value","New Value","Affected Uses"'
      );
      expect(lines.length).toBe(4); // Header + 3 entries

      // Row 1: study metadata change
      expect(lines[1]).toContain('"Study Metadata"');
      expect(lines[1]).toContain('"Modified"');
      expect(lines[1]).toContain('"Study Name"');
      expect(lines[1]).toContain('"Phase III Study"');
      expect(lines[1]).toContain('"Phase III Study (Amendment 1)"');

      // Row 2: field added
      expect(lines[2]).toContain('"Fields"');
      expect(lines[2]).toContain('"Added"');
      expect(lines[2]).toContain('"Systolic Blood Pressure"');

      // Row 3: rule removed
      expect(lines[3]).toContain('"Edit Check Rules"');
      expect(lines[3]).toContain('"Removed"');
      expect(lines[3]).toContain('"Referenced field id(s): fld_sysbp"');
    });

    it("handles special characters like double quotes and commas in CSV cells", () => {
      const comparison = buildSampleComparison();
      comparison.entries[0].label = 'Name with "Quotes" and, Comma';
      const csv = serializeBaselineDiffToCsv(comparison);

      expect(csv).toContain('"Name with ""Quotes"" and, Comma"');
    });
  });

  describe("serializeBaselineDiffToJson", () => {
    it("serializes the comparison result to formatted JSON matching structure", () => {
      const comparison = buildSampleComparison();
      const jsonStr = serializeBaselineDiffToJson(comparison);

      const parsed = JSON.parse(jsonStr);
      expect(parsed.baselineId).toBe("base-123");
      expect(parsed.baselineVersionTag).toBe("v1.0");
      expect(parsed.summary.totalChanges).toBe(3);
      expect(parsed.entries).toHaveLength(3);
    });
  });

  describe("serializeBaselineDiffToText", () => {
    it("produces a readable text report with metadata, summary table, and itemized entries", () => {
      const comparison = buildSampleComparison();
      const text = serializeBaselineDiffToText(comparison);

      expect(text).toContain("PROTOCOL AMENDMENT BASELINE COMPARISON REPORT");
      expect(text).toContain("Baseline Tag   : v1.0");
      expect(text).toContain("Baseline Label : Initial Protocol Approval");
      expect(text).toContain("Total Changes : 3");
      expect(text).toContain("1. [MODIFIED] Study Metadata › Study Name");
      expect(text).toContain("Old Value     : Phase III Study");
      expect(text).toContain("New Value     : Phase III Study (Amendment 1)");
      expect(text).toContain(
        "2. [ADDED] Vital Signs › Vital Signs › Systolic Blood Pressure"
      );
      expect(text).toContain(
        "3. [REMOVED] Vital Signs › Rules › Check SYSBP Limit"
      );
      expect(text).toContain(
        "Affected Uses : Referenced field id(s): fld_sysbp"
      );
    });

    it("handles zero-change comparison cleanly in plain text", () => {
      const comparison = buildSampleComparison();
      comparison.entries = [];
      comparison.summary.totalChanges = 0;
      comparison.summary.hasChanges = false;

      const text = serializeBaselineDiffToText(comparison);
      expect(text).toContain(
        "No differences detected between the current draft and baseline snapshot."
      );
    });
  });

  describe("Export Trigger Functions", () => {
    it("generateExportFilename sanitizes baseline tag and extension", () => {
      const comparison = buildSampleComparison();
      comparison.baselineVersionTag = "v1.0-beta/test";
      const filename = generateExportFilename(comparison, "csv");
      expect(filename).toMatch(
        /^baseline-diff-v1_0-beta_test-\d{4}-\d{2}-\d{2}\.csv$/
      );
    });

    it("exportBaselineDiffCsv invokes downloadFile with text/csv mime type", () => {
      const comparison = buildSampleComparison();
      exportBaselineDiffCsv(comparison);

      expect(downloadFile).toHaveBeenCalledWith(
        expect.stringContaining('"Category","Change Type"'),
        expect.stringMatching(/\.csv$/),
        { mimeType: "text/csv;charset=utf-8" }
      );
    });

    it("exportBaselineDiffJson invokes downloadFile with application/json mime type", () => {
      const comparison = buildSampleComparison();
      exportBaselineDiffJson(comparison);

      expect(downloadFile).toHaveBeenCalledWith(
        expect.stringContaining('"baselineId": "base-123"'),
        expect.stringMatching(/\.json$/),
        { mimeType: "application/json;charset=utf-8" }
      );
    });

    it("exportBaselineDiffText invokes downloadFile with text/plain mime type", () => {
      const comparison = buildSampleComparison();
      exportBaselineDiffText(comparison);

      expect(downloadFile).toHaveBeenCalledWith(
        expect.stringContaining(
          "PROTOCOL AMENDMENT BASELINE COMPARISON REPORT"
        ),
        expect.stringMatching(/\.txt$/),
        { mimeType: "text/plain;charset=utf-8" }
      );
    });
  });
});
