"use client";

import type { ConformanceReport, DataLayer } from "@/lib/study-data";
import type { FindingSample } from "./protocol";
import { useRovingGrid } from "./useRovingGrid";
import { CELL, CELL_FOCUS, TABLE_SCROLL } from "./ui";

interface ConformancePanelProps {
  readonly report: ConformanceReport;
  readonly findings: FindingSample;
  readonly onTrace: (layer: DataLayer, dataset: string, row: number) => void;
}

const STATUS_STYLE: Readonly<Record<string, string>> = {
  pass: "border-emerald-500/40 text-emerald-300",
  warning: "border-amber-500/50 text-amber-300",
  error: "border-rose-400/50 text-rose-300",
  failed: "border-rose-400/50 text-rose-300",
};

const STATUS_TEXT: Readonly<Record<string, string>> = {
  pass: "Pass",
  warning: "Warnings",
  failed: "Errors",
};

/** Splits a citation into its text and the address it ends with, if any. */
function citationParts(citation: string): { text: string; href?: string } {
  const match = /^(.*?):?\s*(https:\/\/\S+?)(?:\s+(.*))?$/.exec(citation);
  if (!match) return { text: citation };
  const rest = [match[1], match[3]].filter(Boolean).join(" ");
  return { text: rest || match[2], href: match[2] };
}

/**
 * The conformance stage's report: the gate status, its scope, outcomes by
 * dataset and by rule, and the findings, each of which traces to its record.
 */
export function ConformancePanel({
  report,
  findings,
  onTrace,
}: ConformancePanelProps) {
  const findingGrid = useRovingGrid();
  const columns = ["Rule", "Severity", "Dataset", "Variable", "Row", "Message"];
  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={`border px-3 py-2 font-mono text-xs uppercase ${STATUS_STYLE[report.status]}`}
        >
          {STATUS_TEXT[report.status] ?? report.status}
        </span>
        <span className="font-mono text-xs text-slate-300">
          Rules {report.rulesVersion} · Terminology {report.terminologyVersion}
        </span>
      </div>
      <p className="max-w-3xl border-l-2 border-amber-500 pl-4 text-sm leading-relaxed text-slate-200">
        {report.scopeNotice} This stage is a demonstration, not a validator of
        record.{" "}
        <a
          href={report.coreUrl}
          className="text-amber-300 underline underline-offset-4 hover:text-amber-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
        >
          About CDISC CORE
        </a>
      </p>

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <div className={TABLE_SCROLL}>
          <table className="w-full border-collapse">
            <caption className="px-3 pb-2 pt-3 text-left text-sm font-semibold text-white">
              Rule outcomes by dataset
            </caption>
            <thead>
              <tr className="border-y border-white/[0.12] text-slate-300">
                {["Dataset", "Pass", "Warning", "Error"].map((heading) => (
                  <th key={heading} scope="col" className={`${CELL} font-sans`}>
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="text-slate-100">
              {report.domains
                .filter(
                  (domain) => domain.pass + domain.warning + domain.error > 0
                )
                .map((domain) => (
                  <tr
                    key={domain.dataset}
                    className="border-b border-white/[0.04]"
                  >
                    <th scope="row" className={`${CELL} font-semibold`}>
                      {domain.dataset}
                    </th>
                    <td className={CELL}>{domain.pass}</td>
                    <td
                      className={`${CELL} ${domain.warning ? "text-amber-300" : ""}`}
                    >
                      {domain.warning}
                    </td>
                    <td
                      className={`${CELL} ${domain.error ? "text-rose-300" : ""}`}
                    >
                      {domain.error}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <div className={TABLE_SCROLL}>
          <table className="w-full border-collapse">
            <caption className="px-3 pb-2 pt-3 text-left text-sm font-semibold text-white">
              Rules checked
            </caption>
            <thead>
              <tr className="border-y border-white/[0.12] text-slate-300">
                {["Rule", "Dataset", "Status", "Findings", "Source"].map(
                  (heading) => (
                    <th
                      key={heading}
                      scope="col"
                      className={`${CELL} font-sans`}
                    >
                      {heading}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="text-slate-100">
              {report.ruleResults.map((result) => {
                const citation = citationParts(result.citation);
                return (
                  <tr
                    key={`${result.ruleId}-${result.dataset}`}
                    className="border-b border-white/[0.04]"
                  >
                    <th scope="row" className={`${CELL} font-semibold`}>
                      {result.ruleId}
                    </th>
                    <td className={CELL}>{result.dataset}</td>
                    <td
                      className={`${CELL} ${STATUS_STYLE[result.status]?.split(" ")[1] ?? ""}`}
                    >
                      {result.status}
                    </td>
                    <td className={CELL}>{result.findingCount}</td>
                    <td className="min-w-[16rem] px-3 py-2 text-xs text-slate-300">
                      {citation.href ? (
                        <a
                          href={citation.href}
                          className="break-words underline decoration-zinc-600 underline-offset-4 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                        >
                          {citation.text}
                        </a>
                      ) : (
                        citation.text
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="min-w-0 space-y-2">
        <h3 className="text-lg font-semibold tracking-[-0.035em] text-white">
          Findings
        </h3>
        <p className="text-sm text-slate-300">
          {findings.total === 0
            ? "The run raised no findings."
            : findings.total > findings.items.length
              ? `Showing the first ${findings.items.length.toLocaleString("en-US")} of ${findings.total.toLocaleString("en-US")} findings. Select one to trace its record.`
              : `${findings.total.toLocaleString("en-US")} findings. Select one to trace its record.`}
        </p>
        {findings.items.length > 0 ? (
          <div className={`${TABLE_SCROLL} max-h-[28rem]`}>
            <table
              role="grid"
              aria-label="Conformance findings"
              className="w-full border-collapse"
              onKeyDown={findingGrid.onKeyDown}
            >
              <thead>
                <tr className="border-y border-white/[0.12] text-slate-300">
                  {columns.map((heading, index) => (
                    <th
                      key={heading}
                      scope="col"
                      {...findingGrid.cellProps(0, index)}
                      className={`${CELL} sticky top-0 bg-[#181b21] font-sans ${CELL_FOCUS}`}
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="text-slate-100">
                {findings.items.map((finding, index) => {
                  const { dataset, row } = finding;
                  const traceable = dataset !== undefined && row !== undefined;
                  const trace = traceable
                    ? () => onTrace(finding.layer, dataset, row)
                    : undefined;
                  const values = [
                    finding.ruleId,
                    finding.severity,
                    finding.dataset ?? "",
                    finding.variable ?? "",
                    finding.row === undefined ? "" : String(finding.row + 1),
                    finding.message,
                  ];
                  return (
                    <tr
                      key={`${finding.ruleId}-${finding.dataset}-${finding.row}-${index}`}
                      className="border-b border-white/[0.04]"
                    >
                      {values.map((value, col) => (
                        <td
                          key={columns[col]}
                          role="gridcell"
                          {...findingGrid.cellProps(index + 1, col)}
                          onClick={trace}
                          className={`${col === 5 ? "min-w-[18rem] whitespace-normal px-3 py-2 text-xs" : CELL} ${traceable ? "cursor-pointer hover:bg-white/[0.04]" : ""} ${col === 1 && finding.severity !== "notice" ? "text-amber-300" : ""} ${CELL_FOCUS}`}
                        >
                          {value}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}
