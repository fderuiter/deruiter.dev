"use client";

import { useEffect, useEffectEvent, useId } from "react";
import {
  SYNTHETIC_DATA_NOTICE,
  reportTelemetrySlug,
  type ReportData,
} from "@/lib/clinical-platform";
import { ReportChart } from "./ReportChart";
import { REPORT_TIERS, ReportTierBadge } from "./ReportTierBadge";

const STATUS_LABEL = {
  certified: "Certified",
  draft: "Draft",
  deprecated: "Deprecated",
} as const;

function refreshText(hours: number): string {
  if (hours % 24 !== 0) return `every ${hours} hours`;
  const days = hours / 24;
  return days === 1 ? "daily" : `every ${days} days`;
}

/**
 * One report, drawn from its render model by the shared renderer: the
 * header with tier and ownership, the chart, the data table every chart
 * has, and a "how this number is calculated" panel per metric with its
 * definition, version and SQL. No report computes a number itself; every
 * value comes from the metric registry through `buildReport`.
 *
 * @param report - The built report.
 * @param onView - Called with the report's telemetry slug once each time a
 *   report is shown, so a page can count the view through the telemetry
 *   outbox.
 */
export function ReportView({
  report,
  onView,
}: {
  report: ReportData;
  onView?: (telemetrySlug: string) => void;
}) {
  const headingId = useId();
  const tableId = useId();
  const { spec } = report;
  const tier = REPORT_TIERS[spec.tier];
  // Counted once per report shown, however often the page re-renders.
  const recordView = useEffectEvent((reportId: string) => {
    onView?.(reportTelemetrySlug(reportId));
  });
  useEffect(() => {
    recordView(spec.id);
  }, [spec.id]);

  return (
    <article
      aria-labelledby={headingId}
      className="@container min-w-0 border border-white/[0.08] bg-[#0d0e11] p-4 text-[#f4f4f6] sm:p-6"
    >
      <header className="border-b border-white/[0.08] pb-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2
            id={headingId}
            className="min-w-0 break-words text-xl font-semibold tracking-[-0.02em]"
          >
            {spec.title}
          </h2>
          <ReportTierBadge tier={spec.tier} />
        </div>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-300">
          {spec.purpose}
        </p>
        <dl className="mt-4 grid gap-x-6 gap-y-2 font-mono text-xs text-slate-400 @md:grid-cols-2 @3xl:grid-cols-3">
          <div className="min-w-0">
            <dt className="inline text-slate-500">Audience: </dt>
            <dd className="inline text-slate-200">{spec.audience}</dd>
          </div>
          <div className="min-w-0">
            <dt className="inline text-slate-500">Owner: </dt>
            <dd className="inline text-slate-200">{spec.owner}</dd>
          </div>
          <div className="min-w-0">
            <dt className="inline text-slate-500">Version: </dt>
            <dd className="inline text-slate-200">{spec.version}</dd>
          </div>
          <div className="min-w-0">
            <dt className="inline text-slate-500">Data as of: </dt>
            <dd className="inline text-slate-200">{report.dataCut}</dd>
          </div>
          <div className="min-w-0">
            <dt className="inline text-slate-500">Refresh: </dt>
            <dd className="inline text-slate-200">
              {refreshText(spec.refreshSlaHours)}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="inline text-slate-500">Tier: </dt>
            <dd className="inline text-slate-200">
              {tier.label}.{" "}
              {spec.signOff
                ? `Signed off by the ${spec.signOff.role} on ${spec.signOff.date} for version ${spec.signOff.version}.`
                : tier.meaning}
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-amber-300">{SYNTHETIC_DATA_NOTICE}</p>
      </header>

      {spec.visual !== "table" && (
        <section aria-label="Chart" className="mt-5">
          <ReportChart report={report} />
        </section>
      )}

      <section aria-labelledby={tableId} className="mt-6">
        <h3 id={tableId} className="text-sm font-semibold text-slate-200">
          {spec.visual === "table" ? "Data" : "Data table"}
        </h3>
        <div
          className="mt-2 max-h-[28rem] overflow-auto border border-white/[0.08]"
          tabIndex={0}
          role="region"
          aria-label={`${spec.title} data`}
        >
          <table className="w-full border-collapse text-left text-xs">
            <caption className="sr-only">
              {`${spec.title}, data as of ${report.dataCut}`}
            </caption>
            <thead className="sticky top-0 bg-[#13151a]">
              <tr>
                {report.dimensionLabels.map((label) => (
                  <th
                    key={label}
                    scope="col"
                    className="whitespace-nowrap px-3 py-2 font-medium text-slate-300"
                  >
                    {label}
                  </th>
                ))}
                {report.columns.map((column) => (
                  <th
                    key={column.metricId}
                    scope="col"
                    className="px-3 py-2 text-right font-medium text-slate-300"
                  >
                    {column.name}
                    <span className="block font-normal text-slate-500">
                      {column.unit}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row) => (
                <tr key={row.key} className="border-t border-white/[0.06]">
                  {row.labels.map((label, index) =>
                    index === 0 ? (
                      <th
                        key={index}
                        scope="row"
                        className="whitespace-nowrap px-3 py-1.5 font-mono font-normal text-slate-200"
                      >
                        {label}
                      </th>
                    ) : (
                      <td
                        key={index}
                        className="whitespace-nowrap px-3 py-1.5 font-mono text-slate-200"
                      >
                        {label}
                      </td>
                    )
                  )}
                  {row.cells.map((cell, index) => (
                    <td
                      key={report.columns[index].metricId}
                      className={`px-3 py-1.5 text-right font-mono tabular-nums ${
                        cell.value === null
                          ? "text-slate-500"
                          : "text-slate-100"
                      }`}
                    >
                      {cell.text}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section
        aria-label="How these numbers are calculated"
        className="mt-6 space-y-2"
      >
        {report.calculations.map((calc) => (
          <details
            key={calc.metricId}
            className="group border border-white/[0.08] bg-[#13151a]"
          >
            <summary className="cursor-pointer px-3 py-2 text-sm text-slate-200 marker:text-slate-500">
              How {calc.name.toLowerCase()} is calculated
            </summary>
            <div className="space-y-3 border-t border-white/[0.08] px-3 py-3 text-xs leading-relaxed text-slate-300">
              <p>{calc.description}</p>
              <p>
                <span className="text-slate-500">Formula: </span>
                {calc.formula}
              </p>
              <p className="font-mono text-slate-400">
                {calc.metricId} · version {calc.version} ·{" "}
                {STATUS_LABEL[calc.status]}
              </p>
              <pre
                className="max-h-72 overflow-auto bg-[#0d0e11] p-3 font-mono text-[11px] leading-snug text-slate-200"
                tabIndex={0}
                aria-label={`DuckDB SQL for ${calc.name}`}
              >
                <code>{calc.sql}</code>
              </pre>
            </div>
          </details>
        ))}
      </section>
    </article>
  );
}
