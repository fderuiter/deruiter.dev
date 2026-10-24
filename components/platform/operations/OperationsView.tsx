"use client";

import { useId, useRef, type KeyboardEvent } from "react";
import {
  NO_METRIC_ROWS,
  type OperationsDashboard,
  type OperationsLevel,
  type OperationsMilestone,
  type OperationsScope,
  type OperationsSection,
  type OperationsSectionId,
  type ReportData,
} from "@/lib/clinical-platform";
import { ReportView } from "../ReportView";

const ISSUES_URL = "https://github.com/fderuiter/deruiter.dev/issues";

const MEMBER_HEADING: Readonly<Record<OperationsLevel, string>> = {
  portfolio: "Portfolio",
  study: "Studies",
  country: "Countries",
  site: "Sites",
};

const LEVEL_NAME: Readonly<Record<OperationsLevel, string>> = {
  portfolio: "portfolio",
  study: "study",
  country: "country",
  site: "site",
};

/**
 * The URL hash that opens a scope and a section, with the keys always in
 * the same order so one view has one address.
 *
 * @param scope - The scope.
 * @param view - The section, or `null` for the default one.
 * @returns The hash, starting with `#`, or `#` alone for the portfolio.
 */
export function operationsHash(
  scope: OperationsScope,
  view: OperationsSectionId | null
): string {
  const params = new URLSearchParams();
  if (scope.study) params.set("study", scope.study);
  if (scope.country) params.set("country", scope.country);
  if (scope.site) params.set("site", scope.site);
  if (scope.runBy) params.set("runby", scope.runBy);
  if (view) params.set("view", view);
  return `#${params.toString()}`;
}

function Breadcrumbs({
  dashboard,
  view,
}: {
  dashboard: OperationsDashboard;
  view: OperationsSectionId | null;
}) {
  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs text-slate-400">
        {dashboard.crumbs.map((crumb, index) => {
          const last = index === dashboard.crumbs.length - 1;
          return (
            <li key={crumb.level} className="flex min-w-0 items-center gap-2">
              {index > 0 && (
                <span aria-hidden="true" className="text-slate-600">
                  /
                </span>
              )}
              {last ? (
                <span aria-current="page" className="break-all text-slate-100">
                  {crumb.label}
                </span>
              ) : (
                <a
                  href={operationsHash(crumb.scope, view)}
                  className="break-all text-amber-300 underline underline-offset-4 hover:text-amber-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                >
                  {crumb.label}
                </a>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function StudyProfile({ dashboard }: { dashboard: OperationsDashboard }) {
  const { study } = dashboard;
  if (study === null) return null;
  const facts: [string, string][] = [
    ["Product", `${study.productType}, ${study.phase}`],
    ["Regulatory path", study.regulatoryPath],
    [
      "Run by",
      study.croName === null ? "The sponsor" : `${study.croName} (CRO)`,
    ],
    ["Status", study.status],
    ["CEC adjudication", study.hasCecAdjudication ? "Yes" : "No"],
  ];
  return (
    <section
      aria-label={`About ${study.id}`}
      className="@container border border-white/[0.08] bg-[#13151a] p-4"
    >
      <p className="font-mono text-xs text-amber-300">{study.id}</p>
      <p className="mt-1 break-words text-sm text-slate-100">{study.title}</p>
      <dl className="mt-3 grid gap-x-6 gap-y-2 font-mono text-xs @md:grid-cols-2 @3xl:grid-cols-5">
        {facts.map(([term, value]) => (
          <div key={term} className="min-w-0">
            <dt className="text-slate-500">{term}</dt>
            <dd className="break-words text-slate-200">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Glance({ report }: { report: ReportData }) {
  const row = report.rows[0];
  return (
    <section aria-labelledby="operations-glance" className="@container">
      <h2
        id="operations-glance"
        className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-300"
      >
        At a glance
      </h2>
      <dl className="mt-3 grid grid-cols-2 gap-px border border-white/[0.08] bg-white/[0.08] @3xl:grid-cols-4 @5xl:grid-cols-7">
        {report.columns.map((column, index) => {
          const cell = row?.cells[index];
          return (
            <div key={column.metricId} className="min-w-0 bg-[#0d0e11] p-3">
              <dt className="text-xs text-slate-400">{column.name}</dt>
              <dd className="mt-1">
                <span className="font-mono text-2xl font-semibold tabular-nums tracking-[-0.02em] text-[#f4f4f6]">
                  {cell?.text ?? NO_METRIC_ROWS}
                </span>
                <span className="block text-[11px] text-slate-500">
                  {column.unit}
                </span>
              </dd>
            </div>
          );
        })}
      </dl>
      <details className="mt-2 border border-white/[0.08] bg-[#13151a]">
        <summary className="cursor-pointer px-3 py-2 text-xs text-slate-300 marker:text-slate-500">
          How these numbers are calculated
        </summary>
        <ul className="space-y-2 border-t border-white/[0.08] px-3 py-3 text-xs leading-relaxed text-slate-300">
          {report.calculations.map((calc) => (
            <li key={calc.metricId}>
              <span className="text-slate-100">{calc.name}: </span>
              {calc.formula}{" "}
              <span className="font-mono text-slate-500">
                ({calc.metricId} {calc.version})
              </span>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}

function Members({
  dashboard,
  view,
}: {
  dashboard: OperationsDashboard;
  view: OperationsSectionId | null;
}) {
  if (dashboard.memberLevel === null || dashboard.members.length === 0) {
    return null;
  }
  const where = dashboard.crumbs
    .slice(1)
    .map((crumb) => crumb.label)
    .join(", ");
  const heading = `${MEMBER_HEADING[dashboard.memberLevel]}${where ? ` in ${where}` : ""}`;
  return (
    <nav aria-labelledby="operations-members" className="@container">
      <h2
        id="operations-members"
        className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-300"
      >
        {heading}
      </h2>
      <p className="mt-1 text-xs text-slate-400">
        Choose a {LEVEL_NAME[dashboard.memberLevel]} to narrow every number
        below to it.
      </p>
      <ul className="mt-3 grid gap-2 @md:grid-cols-2 @4xl:grid-cols-4">
        {dashboard.members.map((member) => (
          <li key={member.id} className="min-w-0">
            <a
              href={operationsHash(member.scope, view)}
              className="block h-full min-w-0 border border-white/[0.08] bg-[#13151a] px-3 py-2 transition-colors hover:border-amber-500/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 active:scale-[0.98]"
            >
              <span className="block break-all font-mono text-xs text-amber-300">
                {member.label}
              </span>
              <span className="mt-0.5 block break-words text-xs text-slate-300">
                {member.detail}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function varianceText(days: number | null): string {
  if (days === null) return "Not reached";
  if (days === 0) return "On plan";
  const n = Math.abs(days);
  return `${n} ${n === 1 ? "day" : "days"} ${days < 0 ? "early" : "late"}`;
}

function Milestones({
  studyId,
  milestones,
}: {
  studyId: string;
  milestones: readonly OperationsMilestone[];
}) {
  return (
    <section
      aria-labelledby="operations-milestones"
      className="min-w-0 border border-white/[0.08] bg-[#0d0e11] p-4 sm:p-6"
    >
      <h2
        id="operations-milestones"
        className="text-xl font-semibold tracking-[-0.02em]"
      >
        {studyId} milestones
      </h2>
      <p className="mt-2 max-w-3xl text-sm text-slate-300">
        Planned against actual dates from the CTMS, as recorded in
        gold.fct_milestone, in the study&apos;s own vocabulary.
      </p>
      <div
        className="mt-4 overflow-auto border border-white/[0.08]"
        tabIndex={0}
        role="region"
        aria-label={`${studyId} milestones`}
      >
        <table className="w-full border-collapse text-left text-xs">
          <caption className="sr-only">
            {`${studyId} milestones, planned and actual`}
          </caption>
          <thead className="bg-[#13151a]">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium text-slate-300">
                Milestone
              </th>
              <th scope="col" className="px-3 py-2 font-medium text-slate-300">
                Planned
              </th>
              <th scope="col" className="px-3 py-2 font-medium text-slate-300">
                Actual
              </th>
              <th scope="col" className="px-3 py-2 font-medium text-slate-300">
                Against plan
              </th>
            </tr>
          </thead>
          <tbody>
            {milestones.map((milestone) => (
              <tr key={milestone.kind} className="border-t border-white/[0.06]">
                <th
                  scope="row"
                  className="px-3 py-1.5 font-normal text-slate-100"
                >
                  {milestone.label}
                </th>
                <td className="whitespace-nowrap px-3 py-1.5 font-mono text-slate-200">
                  {milestone.planned}
                </td>
                <td className="whitespace-nowrap px-3 py-1.5 font-mono text-slate-200">
                  {milestone.actual ?? "Not yet"}
                </td>
                <td className="whitespace-nowrap px-3 py-1.5 font-mono text-slate-200">
                  {varianceText(milestone.varianceDays)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Gaps({ section }: { section: OperationsSection }) {
  if (section.gaps.length === 0) return null;
  return (
    <aside
      aria-label={`${section.title}: not in the governed model yet`}
      className="border border-dashed border-white/[0.12] bg-[#13151a] p-4"
    >
      <h3 className="text-sm font-semibold text-slate-200">
        Not in the governed model yet
      </h3>
      <p className="mt-1 text-xs text-slate-400">
        Asked of this dashboard, but the metric registry cannot compute it yet,
        so it is not shown rather than computed outside the registry.
      </p>
      <ul className="mt-3 space-y-2 text-xs leading-relaxed">
        {section.gaps.map((gap) => (
          <li key={gap.name} className="min-w-0 break-words">
            <span className="font-medium text-slate-100">{gap.name}.</span>{" "}
            <span className="text-slate-300">{gap.reason}</span>{" "}
            {gap.issue !== null && (
              <a
                href={`${ISSUES_URL}/${gap.issue}`}
                className="text-amber-300 underline underline-offset-4 hover:text-amber-200 focus-visible:outline-2 focus-visible:outline-amber-400"
              >
                Planned in #{gap.issue}
              </a>
            )}
          </li>
        ))}
      </ul>
    </aside>
  );
}

/** Moves between tabs with the arrow, Home and End keys. */
function tabStep(key: string, index: number, count: number): number | null {
  switch (key) {
    case "ArrowRight":
      return (index + 1) % count;
    case "ArrowLeft":
      return (index - 1 + count) % count;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}

/**
 * The operations dashboard at one scope: breadcrumbs, the study drilled
 * into, headline numbers, what to drill into next, and one tab per section
 * with its reports, drawn by the shared report renderer, and the numbers it
 * cannot show yet.
 *
 * @param dashboard - The dashboard, from `operationsDashboard`.
 * @param view - The section shown; the first section when it is `null` or
 *   not on this level.
 * @param onView - Called with the section a visitor picks.
 * @param onRunBy - Called with the run-by choice a visitor picks, `""` for
 *   every study.
 * @param busy - Whether a newer scope is being computed; the page stays on
 *   the current one meanwhile.
 */
export function OperationsView({
  dashboard,
  view,
  onView,
  onRunBy,
  busy = false,
}: {
  dashboard: OperationsDashboard;
  view: OperationsSectionId | null;
  onView: (view: OperationsSectionId) => void;
  onRunBy: (runBy: string) => void;
  busy?: boolean;
}) {
  const baseId = useId();
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const { sections } = dashboard;
  const activeIndex = Math.max(
    0,
    sections.findIndex((section) => section.id === view)
  );
  const active = sections[activeIndex];
  const runByLabel = `${baseId}-runby`;

  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    const next = tabStep(event.key, activeIndex, sections.length);
    if (next === null) return;
    event.preventDefault();
    onView(sections[next].id);
    tabs.current[next]?.focus();
  };

  return (
    <div className="space-y-8" aria-busy={busy}>
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/[0.08] pb-4">
        <Breadcrumbs dashboard={dashboard} view={view} />
        <p className="font-mono text-xs text-slate-400">
          Data as of{" "}
          <time dateTime={dashboard.dataCut} className="text-slate-200">
            {dashboard.dataCut}
          </time>
        </p>
      </div>

      {dashboard.notice !== null && (
        <p
          role="status"
          className="border-l-2 border-amber-500 pl-3 text-sm text-amber-200"
        >
          {dashboard.notice}
        </p>
      )}

      {dashboard.runByOptions.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor={runByLabel} className="text-sm text-slate-300">
            Studies shown
          </label>
          <select
            id={runByLabel}
            value={dashboard.scope.runBy ?? ""}
            onChange={(event) => onRunBy(event.target.value)}
            className="min-h-11 min-w-0 max-w-full border border-white/[0.12] bg-[#13151a] px-3 text-sm text-slate-100 focus-visible:outline-2 focus-visible:outline-amber-400"
          >
            {dashboard.runByOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {`${option.label} (${option.studies})`}
              </option>
            ))}
          </select>
        </div>
      )}

      <StudyProfile dashboard={dashboard} />
      <Glance report={dashboard.glance} />
      <Members dashboard={dashboard} view={view} />

      <section aria-label="Dashboards" className="min-w-0">
        <div
          role="tablist"
          aria-label="Dashboard sections"
          className="flex gap-1 overflow-x-auto border-b border-white/[0.08]"
        >
          {sections.map((section, index) => {
            const selected = index === activeIndex;
            return (
              <button
                key={section.id}
                ref={(element) => {
                  tabs.current[index] = element;
                }}
                type="button"
                role="tab"
                id={`${baseId}-tab-${section.id}`}
                aria-selected={selected}
                aria-controls={`${baseId}-panel`}
                tabIndex={selected ? 0 : -1}
                onClick={() => onView(section.id)}
                onKeyDown={onTabKey}
                className={`min-h-11 shrink-0 whitespace-nowrap border-b-2 px-3 text-sm focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-amber-400 ${
                  selected
                    ? "border-amber-400 text-[#f4f4f6]"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                {section.title}
              </button>
            );
          })}
        </div>
        {active && (
          <div
            role="tabpanel"
            id={`${baseId}-panel`}
            aria-labelledby={`${baseId}-tab-${active.id}`}
            tabIndex={0}
            className="mt-6 space-y-6 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-400"
          >
            <p className="max-w-3xl text-sm text-slate-300">{active.summary}</p>
            {active.id === "milestones" &&
              dashboard.milestones !== null &&
              dashboard.study !== null && (
                <Milestones
                  studyId={dashboard.study.id}
                  milestones={dashboard.milestones}
                />
              )}
            {active.reports.map((report) => (
              <ReportView key={report.spec.id} report={report} />
            ))}
            <Gaps section={active} />
          </div>
        )}
      </section>
    </div>
  );
}
