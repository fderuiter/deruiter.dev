/**
 * Serializers and Export Utilities for Protocol Amendment Baseline Diffs
 * Supports CSV, JSON, and Plain Text formatting for offline audit archiving
 * and cross-team baseline comparison reviews.
 */

import { downloadFile } from "../download";
import {
  BaselineComparisonResult,
  BaselineDiffCategory,
  describeBaselineDiffCategory,
  describeBaselineDiffChangeType,
} from "./study-baseline-diff";

function escapeCsvCell(cell: unknown): string {
  if (cell === null || cell === undefined) return '""';
  const str = typeof cell === "object" ? JSON.stringify(cell) : String(cell);
  if (
    str.includes('"') ||
    str.includes(",") ||
    str.includes("\n") ||
    str.includes("\r")
  ) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

/**
 * Serializes a baseline comparison result into RFC-4180 compliant tabular CSV format.
 */
export function serializeBaselineDiffToCsv(
  comparison: BaselineComparisonResult
): string {
  const headers = [
    "Category",
    "Change Type",
    "Label",
    "Breadcrumb",
    "Changed Fields",
    "Old Value",
    "New Value",
    "Affected Uses",
  ];

  const rows: string[] = [headers.map(escapeCsvCell).join(",")];

  for (const entry of comparison.entries) {
    const categoryLabel = describeBaselineDiffCategory(entry.category);
    const changeTypeLabel = describeBaselineDiffChangeType(entry.changeType);
    const breadcrumbStr = entry.breadcrumb ? entry.breadcrumb.join(" › ") : "";
    const changedFieldsStr =
      entry.changedFields && entry.changedFields.length > 0
        ? entry.changedFields.join(", ")
        : "";
    const oldValueStr = entry.oldValue !== undefined ? entry.oldValue : "";
    const newValueStr = entry.newValue !== undefined ? entry.newValue : "";
    const affectedUsesStr =
      entry.affectedUses && entry.affectedUses.length > 0
        ? entry.affectedUses.join("; ")
        : "";

    const row = [
      categoryLabel,
      changeTypeLabel,
      entry.label || "",
      breadcrumbStr,
      changedFieldsStr,
      oldValueStr,
      newValueStr,
      affectedUsesStr,
    ];

    rows.push(row.map(escapeCsvCell).join(","));
  }

  return rows.join("\r\n");
}

/**
 * Serializes a baseline comparison result into a complete JSON document.
 */
export function serializeBaselineDiffToJson(
  comparison: BaselineComparisonResult
): string {
  return JSON.stringify(comparison, null, 2);
}

function formatValueText(val: unknown): string {
  if (val === undefined || val === null || val === "") return "—";
  if (typeof val === "object") {
    try {
      return JSON.stringify(val);
    } catch {
      return String(val);
    }
  }
  return String(val);
}

/**
 * Serializes a baseline comparison result into a formatted plain text summary report.
 */
export function serializeBaselineDiffToText(
  comparison: BaselineComparisonResult
): string {
  const lines: string[] = [];

  lines.push(
    "================================================================================"
  );
  lines.push("PROTOCOL AMENDMENT BASELINE COMPARISON REPORT");
  lines.push(
    "================================================================================"
  );
  lines.push(
    `Baseline Tag   : ${comparison.baselineVersionTag || comparison.baselineId}`
  );
  lines.push(`Baseline Label : ${comparison.baselineLabel || "—"}`);
  lines.push(`Compared At    : ${comparison.comparedAt}`);
  lines.push("");

  lines.push(
    "--------------------------------------------------------------------------------"
  );
  lines.push("SUMMARY OF CHANGES");
  lines.push(
    "--------------------------------------------------------------------------------"
  );
  lines.push(`Total Changes : ${comparison.summary.totalChanges}`);
  lines.push(`Added         : ${comparison.summary.addedCount}`);
  lines.push(`Removed       : ${comparison.summary.removedCount}`);
  lines.push(`Modified      : ${comparison.summary.modifiedCount}`);
  lines.push("");

  lines.push("Category Breakdown:");
  for (const [category, counts] of Object.entries(
    comparison.summary.byCategory
  )) {
    const total = counts.added + counts.removed + counts.modified;
    if (total > 0) {
      const catLabel = describeBaselineDiffCategory(
        category as BaselineDiffCategory
      );
      lines.push(
        `  - ${catLabel.padEnd(25)} : ${total} change(s) (${counts.added} added, ${counts.removed} removed, ${counts.modified} modified)`
      );
    }
  }
  lines.push("");

  lines.push(
    "--------------------------------------------------------------------------------"
  );
  lines.push("DETAILED DIFFERENCES");
  lines.push(
    "--------------------------------------------------------------------------------"
  );

  if (comparison.entries.length === 0) {
    lines.push(
      "No differences detected between the current draft and baseline snapshot."
    );
  } else {
    comparison.entries.forEach((entry, idx) => {
      const changeTag = describeBaselineDiffChangeType(
        entry.changeType
      ).toUpperCase();
      const breadcrumbStr = entry.breadcrumb
        ? entry.breadcrumb.join(" › ")
        : entry.label;
      lines.push(`${idx + 1}. [${changeTag}] ${breadcrumbStr}`);
      lines.push(
        `   Category      : ${describeBaselineDiffCategory(entry.category)}`
      );
      lines.push(`   Label         : ${entry.label}`);
      if (entry.changedFields && entry.changedFields.length > 0) {
        lines.push(`   Changed Fields: ${entry.changedFields.join(", ")}`);
      }
      if (entry.oldValue !== undefined) {
        lines.push(`   Old Value     : ${formatValueText(entry.oldValue)}`);
      }
      if (entry.newValue !== undefined) {
        lines.push(`   New Value     : ${formatValueText(entry.newValue)}`);
      }
      if (entry.affectedUses && entry.affectedUses.length > 0) {
        lines.push(`   Affected Uses : ${entry.affectedUses.join("; ")}`);
      }
      lines.push("");
    });
  }

  return lines.join("\n");
}

/**
 * Generates a default download filename for baseline diff exports.
 */
export function generateExportFilename(
  comparison: BaselineComparisonResult,
  ext: "csv" | "json" | "txt"
): string {
  const version = (comparison.baselineVersionTag || "baseline")
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_");
  const dateStr = (comparison.comparedAt || new Date().toISOString()).slice(
    0,
    10
  );
  return `baseline-diff-${version}-${dateStr}.${ext}`;
}

/**
 * Downloads baseline comparison result as a CSV file.
 */
export function exportBaselineDiffCsv(
  comparison: BaselineComparisonResult,
  customFilename?: string
): boolean {
  const csvData = serializeBaselineDiffToCsv(comparison);
  const filename = customFilename || generateExportFilename(comparison, "csv");
  return downloadFile(csvData, filename, {
    mimeType: "text/csv;charset=utf-8",
  });
}

/**
 * Downloads baseline comparison result as a JSON file.
 */
export function exportBaselineDiffJson(
  comparison: BaselineComparisonResult,
  customFilename?: string
): boolean {
  const jsonData = serializeBaselineDiffToJson(comparison);
  const filename = customFilename || generateExportFilename(comparison, "json");
  return downloadFile(jsonData, filename, {
    mimeType: "application/json;charset=utf-8",
  });
}

/**
 * Downloads baseline comparison result as a Plain Text summary report.
 */
export function exportBaselineDiffText(
  comparison: BaselineComparisonResult,
  customFilename?: string
): boolean {
  const textData = serializeBaselineDiffToText(comparison);
  const filename = customFilename || generateExportFilename(comparison, "txt");
  return downloadFile(textData, filename, {
    mimeType: "text/plain;charset=utf-8",
  });
}
