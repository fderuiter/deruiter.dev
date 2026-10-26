"use client";

import type {
  PortfolioBenchmark,
  PortfolioDashboard,
  PortfolioLane,
  ReportScale,
} from "@/lib/clinical-platform";
import { ReportView } from "../ReportView";
import {
  MilestoneMark,
  MilestoneSwimlane,
  milestoneStatusText,
  plural,
} from "./MilestoneSwimlane";

/** One table row per study, one column per milestone kind. */
function MilestoneTable({ dashboard }: { dashboard: PortfolioDashboard }) {
  const { kinds, lanes } = dashboard.swimlane;
  return (
    <div
      className="mt-6 max-h-[32rem] overflow-auto border border-white/[0.08]"
      tabIndex={0}
      role="region"
      aria-label="Milestones by study"
    >
      <table className="w-full border-collapse text-left text-xs">
        <caption className="sr-only">
          {`Milestones by study, planned against actual, data as of ${dashboard.dataCut}`}
        </caption>
        <thead className="sticky top-0 bg-[#13151a]">
          <tr>
            <th
              scope="col"
              className="whitespace-nowrap px-3 py-2 font-medium text-slate-300"
            >
              Study
            </th>
            {kinds.map((kind) => (
              <th
                key={kind.kind}
                scope="col"
                className="min-w-28 px-3 py-2 font-medium text-slate-300"
              >
                {kind.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lanes.map((lane) => (
            <tr key={lane.studyId} className="border-t border-white/[0.06]">
              <th
                scope="row"
                className="whitespace-nowrap px-3 py-2 text-left align-top font-normal"
              >
                <span className="block font-mono text-slate-100">
                  {lane.studyId}
                </span>
                <span className="block text-slate-400">{lane.status}</span>
              </th>
              {kinds.map((kind) => {
                const milestone = lane.milestones.find(
                  (m) => m.kind === kind.kind
                );
                if (milestone === undefined) {
                  return (
                    <td key={kind.kind} className="px-3 py-2 text-slate-400">
                      None
                    </td>
                  );
                }
                return (
                  <td key={kind.kind} className="px-3 py-2 align-top">
                    <span className="flex items-center gap-1.5 whitespace-nowrap font-mono tabular-nums text-slate-100">
                      <svg
                        width="14"
                        height="14"
                        aria-hidden="true"
                        focusable="false"
                      >
                        <MilestoneMark status={milestone.status} x={7} y={7} />
                      </svg>
                      {milestone.actual ?? milestone.planned}
                    </span>
                    <span className="mt-0.5 block whitespace-nowrap text-slate-300">
                      {milestoneStatusText(milestone)}
                    </span>
                    {milestone.label !== kind.name && (
                      <span className="mt-0.5 block text-slate-400">
                        {milestone.label}
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function slippedText(lanes: readonly PortfolioLane[]): string {
  const late = lanes.reduce(
    (sum, lane) =>
      sum + lane.milestones.filter((m) => m.status === "late").length,
    0
  );
  const overdue = lanes.reduce(
    (sum, lane) =>
      sum + lane.milestones.filter((m) => m.status === "overdue").length,
    0
  );
  return `${plural(late, "milestone")} reached late and ${overdue} overdue across ${plural(lanes.length, "study", "studies")}.`;
}

function fraction(scale: ReportScale, value: number): number {
  return scale.max === scale.min
    ? 0
    : (value - scale.min) / (scale.max - scale.min);
}

/**
 * The distribution of one cycle time: each study as a dot on the bar
 * chart's own axis, the interquartile range as a band and the median as a
 * line, with the study furthest from the median labelled.
 */
function Distribution({ benchmark }: { benchmark: PortfolioBenchmark }) {
  const { report, median, lowerQuartile, upperQuartile, outlier } = benchmark;
  const scale = report.scale;
  if (
    scale === null ||
    median === null ||
    lowerQuartile === null ||
    upperQuartile === null
  ) {
    return null;
  }
  const at = (value: number) => `${fraction(scale, value) * 100}%`;
  return (
    <div aria-hidden="true" className="mt-4 min-w-0">
      <div className="relative h-12">
        <span
          className="absolute top-3 h-6 bg-white/[0.08]"
          style={{
            left: at(lowerQuartile),
            width: `${(fraction(scale, upperQuartile) - fraction(scale, lowerQuartile)) * 100}%`,
          }}
        />
        <span
          className="absolute top-1 h-10 w-0.5 -translate-x-1/2 bg-[#f4f4f6]"
          style={{ left: at(median) }}
        />
        {report.rows.map((row) => {
          const value = row.cells[0].value;
          if (value === null) return null;
          const highlighted = outlier?.studyId === row.labels[0];
          return (
            <span
              key={row.key}
              className={`absolute top-6 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#0d0e11] ${
                highlighted ? "bg-[#f4f4f6]" : "bg-[#94a3b8]"
              }`}
              style={{ left: at(value) }}
            />
          );
        })}
      </div>
      <div className="relative h-4 border-t border-white/[0.12]">
        {scale.ticks.map((tick) => (
          <span
            key={tick.value}
            className="absolute top-0.5 -translate-x-1/2 font-mono text-[10px] tabular-nums text-slate-400 first:translate-x-0 last:-translate-x-full"
            style={{ left: at(tick.value) }}
          >
            {tick.text}
          </span>
        ))}
      </div>
    </div>
  );
}

function outlierText(benchmark: PortfolioBenchmark, unit: string): string {
  const { outlier } = benchmark;
  if (outlier === null) {
    return `Only ${plural(benchmark.studies, "study", "studies")} ${benchmark.studies === 1 ? "has" : "have"} reached both milestones, too few to name one furthest from the median.`;
  }
  const direction = outlier.fromMedian >= 0 ? "slower" : "faster";
  const others = benchmark.beyondFences.filter((id) => id !== outlier.studyId);
  const rule = "Tukey's fences, 1.5 interquartile ranges past the quartiles";
  const also =
    others.length === 0
      ? ""
      : `, as ${others.join(" and ")} ${others.length === 1 ? "is" : "are"}`;
  const fence = outlier.beyondFence
    ? `That is beyond ${rule}, so it is an outlier by that rule${also}.`
    : others.length === 0
      ? `That is within ${rule}, so no study is an outlier by that rule.`
      : `That is within ${rule}, but ${others.join(" and ")} ${others.length === 1 ? "lies" : "lie"} beyond them.`;
  return `Furthest from the median: ${outlier.studyId}, at ${outlier.text} ${unit}, ${outlier.fromMedianText} ${unit} ${direction} than the median. ${fence}`;
}

function BenchmarkSummary({ benchmark }: { benchmark: PortfolioBenchmark }) {
  const column = benchmark.report.columns[0];
  const highlighted = benchmark.outlier?.studyId;
  return (
    <li className="@container min-w-0 border border-white/[0.08] bg-[#13151a] p-4">
      <h3 className="text-sm font-semibold text-[#f4f4f6]">{column.name}</h3>
      {benchmark.studies === 0 ? (
        <p className="mt-2 text-sm text-slate-300">
          No study has reached both milestones yet.
        </p>
      ) : (
        <>
          <dl className="mt-3 grid grid-cols-2 gap-3 @sm:grid-cols-3">
            <div className="min-w-0">
              <dt className="text-xs text-slate-400">Median</dt>
              <dd className="mt-1 font-mono text-2xl tabular-nums text-[#f4f4f6]">
                {benchmark.medianText}
              </dd>
              <dd className="text-xs text-slate-400">{column.unit}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-slate-400">Middle half</dt>
              <dd className="mt-1 font-mono text-sm tabular-nums text-slate-100">
                {benchmark.lowerQuartileText} to {benchmark.upperQuartileText}
              </dd>
              <dd className="text-xs text-slate-400">
                {column.unit}, quartile to quartile
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-slate-400">Studies</dt>
              <dd className="mt-1 font-mono text-sm tabular-nums text-slate-100">
                {benchmark.studies}
              </dd>
              <dd className="text-xs text-slate-400">
                that reached both milestones
              </dd>
            </div>
          </dl>
          <Distribution benchmark={benchmark} />
          {highlighted !== undefined && (
            <p className="mt-1 text-xs text-slate-400" aria-hidden="true">
              Light dot: {highlighted}. Band: the middle half. Line: the median.
            </p>
          )}
          <p className="mt-3 text-sm leading-relaxed text-slate-300">
            {outlierText(benchmark, column.unit)}
          </p>
        </>
      )}
    </li>
  );
}

/**
 * The /platform/portfolio dashboard: every study's milestones on one time
 * axis, then each cycle time compared across the studies, with the
 * governed report behind each comparison.
 *
 * @param dashboard - The dashboard from `portfolioDashboard`.
 */
export function PortfolioView({
  dashboard,
}: {
  dashboard: PortfolioDashboard;
}) {
  const { swimlane, benchmarks } = dashboard;
  return (
    <div className="space-y-10">
      <section
        aria-labelledby="portfolio-milestones"
        className="@container min-w-0 border border-white/[0.08] bg-[#0d0e11] p-4 sm:p-6"
      >
        <h2
          id="portfolio-milestones"
          className="text-xl font-semibold tracking-[-0.02em]"
        >
          Milestones across the portfolio
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-300">
          Each study&apos;s CTMS milestones, planned against actual, from
          gold.fct_milestone. A milestone sits at its actual date once reached
          and at its planned date before then. A line from the planned date
          shows how far it slipped. {slippedText(swimlane.lanes)}
        </p>
        <p className="mt-2 font-mono text-xs text-slate-400">
          Data as of {dashboard.dataCut}
        </p>
        <div className="mt-5">
          <MilestoneSwimlane swimlane={swimlane} dataCut={dashboard.dataCut} />
        </div>
        <MilestoneTable dashboard={dashboard} />
      </section>

      <section aria-labelledby="portfolio-cycle-times" className="min-w-0">
        <h2
          id="portfolio-cycle-times"
          className="text-xl font-semibold tracking-[-0.02em]"
        >
          Cycle times against the portfolio
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-300">
          Start-up, enrollment and close-out, each compared across the studies
          that reached both of its milestones. Medians and quartiles are shown
          to one decimal, since the median of whole days can fall between two of
          them. The governed report for each follows, with its data table and
          how it is calculated.
        </p>
        <ul className="mt-5 grid gap-4 lg:grid-cols-3">
          {benchmarks.map((benchmark) => (
            <BenchmarkSummary
              key={benchmark.report.spec.id}
              benchmark={benchmark}
            />
          ))}
        </ul>
      </section>

      {benchmarks.map((benchmark) => (
        <ReportView key={benchmark.report.spec.id} report={benchmark.report} />
      ))}
    </div>
  );
}
