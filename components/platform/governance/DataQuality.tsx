import type { ReactNode } from "react";
import type {
  DqAssessment,
  DqIssue,
  DqRule,
  DqRuleResult,
  DqScenario,
  DqScore,
  DqStatus,
  DqTrendPoint,
} from "@/lib/clinical-platform";
import {
  DQ_ISSUE_STATUS_LABEL,
  DQ_SEVERITY_LABEL,
  DQ_STATUS_LABEL,
  catalogAnchor,
  dqIssueAnchor,
  dqProductAnchor,
  dqRuleAnchor,
  percent,
} from "./labels";
import { RuleGroupReveal } from "./RuleGroupReveal";

/** How one defect moves the rules it trips: failing rows before and after. */
export interface DqScenarioEffect {
  readonly scenario: DqScenario;
  readonly rules: readonly {
    readonly ruleId: string;
    readonly failedBefore: number;
    readonly failedAfter: number;
    readonly status: DqStatus;
  }[];
}

const LINK =
  "text-amber-300 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-amber-400";
const REGION =
  "mt-4 overflow-x-auto border border-white/[0.08] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400";
const TH = "whitespace-nowrap px-3 py-2 font-medium text-slate-300";
const TD = "px-3 py-2 text-slate-200";
/** Failing rows named beside a rule; the assessment keeps a few more. */
const SAMPLE_SHOWN = 3;

function StatusText({ status }: { status: DqStatus }) {
  const { label, glyph, text } = DQ_STATUS_LABEL[status];
  return (
    <span className={`whitespace-nowrap ${text}`}>
      <span aria-hidden="true">{glyph} </span>
      {label}
    </span>
  );
}

/**
 * A score as a percentage beside a bar from 0 to 100%, the bar for the eye
 * only. A phone shows the percentage alone, so the table fits its width.
 */
function ScoreCell({ score }: { score: DqScore }) {
  if (score.score === null) {
    return <span className="text-slate-400">Nothing checked</span>;
  }
  return (
    <span className="flex items-center gap-3 @2xl:min-w-40">
      <span className="w-14 shrink-0 text-right font-mono tabular-nums text-[#f4f4f6]">
        {percent(score.score)}
      </span>
      <span
        aria-hidden="true"
        className="relative hidden h-2 min-w-20 flex-1 bg-white/[0.06] @2xl:block"
      >
        <span
          className="absolute inset-y-0 left-0 rounded-r-[4px] bg-slate-400"
          style={{ width: `${score.score * 100}%` }}
        />
      </span>
    </span>
  );
}

function ScoreTable({
  label,
  heading,
  scores,
  rowId,
  name,
}: {
  label: string;
  heading: string;
  scores: readonly DqScore[];
  rowId?: (key: string) => string;
  name: (score: DqScore) => ReactNode;
}) {
  return (
    <div className={REGION} tabIndex={0} role="region" aria-label={label}>
      <table className="w-full border-collapse text-left text-xs">
        <caption className="sr-only">{label}</caption>
        <thead className="bg-[#13151a]">
          <tr>
            <th scope="col" className={TH}>
              {heading}
            </th>
            <th scope="col" className={`${TH} text-right`}>
              Rules
            </th>
            <th scope="col" className={`${TH} text-right`}>
              Passing
            </th>
            <th scope="col" className={TH}>
              Score
            </th>
          </tr>
        </thead>
        <tbody>
          {scores.map((score) => (
            <tr
              key={score.key}
              id={rowId?.(score.key)}
              tabIndex={rowId === undefined ? undefined : -1}
              className="scroll-mt-24 border-t border-white/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400"
            >
              <th scope="row" className={`${TD} font-normal @2xl:min-w-44`}>
                {name(score)}
              </th>
              <td className={`${TD} text-right font-mono tabular-nums`}>
                {score.rules}
              </td>
              <td className={`${TD} text-right font-mono tabular-nums`}>
                {score.passing}
              </td>
              <td className={TD}>
                <ScoreCell score={score} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RuleLinks({ ruleIds }: { ruleIds: readonly string[] }) {
  return (
    <>
      {ruleIds.map((id, i) => (
        <span key={id}>
          {i > 0 && ", "}
          <a href={`#${dqRuleAnchor(id)}`} className={`${LINK} font-mono`}>
            {id}
          </a>
        </span>
      ))}
    </>
  );
}

/**
 * The data quality section of the governance page: the scorecard overall,
 * by DAMA dimension and by data product, its last twelve weeks, the issue
 * log, the defects the rules catch, and every rule with its result. Every
 * figure is a table, so no number rests on a bar or a colour.
 */
export function DataQuality({
  assessment,
  trend,
  issues,
  effects,
  rules,
  productNames,
  catalogIds,
}: {
  assessment: DqAssessment;
  trend: readonly DqTrendPoint[];
  issues: readonly DqIssue[];
  effects: readonly DqScenarioEffect[];
  rules: readonly DqRule[];
  /** Product names by id, for the rule tables. */
  productNames: Readonly<Record<string, string>>;
  /** Ids the catalog holds, so a product links to its entry only when it has one. */
  catalogIds: ReadonlySet<string>;
}) {
  const results = new Map<string, DqRuleResult>(
    assessment.results.map((r) => [r.ruleId, r])
  );
  const scenarioName = new Map(
    effects.map((e) => [e.scenario.id, e.scenario.name])
  );
  const open = issues.filter((issue) => issue.fixedOn === null);
  const failing = trend.map((point) => point.failingRuleIds.length);
  const mostFailing = Math.max(1, ...failing);
  const productName = (id: string) => productNames[id] ?? id;
  const overall = assessment.overall;

  return (
    <div className="@container min-w-0 space-y-10">
      <dl className="grid gap-3 @sm:grid-cols-2 @3xl:grid-cols-4">
        {[
          {
            term: "Overall score",
            value:
              overall.score === null ? "No rules ran" : percent(overall.score),
            note: "Mean pass rate of the rules that checked something",
          },
          {
            term: "Rules passing",
            value: `${overall.passing} of ${overall.rules}`,
            note: "A rule to review counts as passing",
          },
          {
            term: "Open issues",
            value: String(open.length),
            note: `Defects still in the data, of ${issues.length} logged`,
          },
          {
            term: "Data cut",
            value: assessment.dataCut,
            note: "Every figure here is as of this date",
          },
        ].map((tile) => (
          <div
            key={tile.term}
            className="min-w-0 border border-white/[0.08] bg-[#13151a] p-4"
          >
            <dt className="text-xs text-slate-400">{tile.term}</dt>
            <dd className="mt-2 font-mono text-2xl tabular-nums text-[#f4f4f6]">
              {tile.value}
            </dd>
            <dd className="mt-1 text-xs text-slate-400">{tile.note}</dd>
          </div>
        ))}
      </dl>

      <div>
        <h3 className="text-lg font-semibold tracking-[-0.02em]">
          By dimension
        </h3>
        <p className="mt-2 max-w-3xl text-sm text-slate-300">
          The six dimensions of DAMA-DMBOK. A dimension&apos;s score is the mean
          pass rate of its rules, so one rule far below its threshold shows even
          when the rest pass.
        </p>
        <ScoreTable
          label="Data quality score by dimension"
          heading="Dimension"
          scores={assessment.byDimension}
          name={(score) => score.label}
        />
      </div>

      <div>
        <h3 className="text-lg font-semibold tracking-[-0.02em]">
          By data product
        </h3>
        <ScoreTable
          label="Data quality score by data product"
          heading="Data product"
          scores={assessment.byProduct}
          rowId={dqProductAnchor}
          name={(score) =>
            catalogIds.has(score.key) ? (
              <a href={`#${catalogAnchor(score.key)}`} className={LINK}>
                {score.label}
              </a>
            ) : (
              score.label
            )
          }
        />
      </div>

      <div>
        <h3 className="text-lg font-semibold tracking-[-0.02em]">
          The last {trend.length} weeks
        </h3>
        <p className="mt-2 max-w-3xl text-sm text-slate-300">
          The scorecard as it read at the end of each week, run again with the
          defects that were in the data that week, so a regression and its fix
          both show.
        </p>
        <div
          className={REGION}
          tabIndex={0}
          role="region"
          aria-label="Weekly data quality scorecard"
        >
          <table className="w-full border-collapse text-left text-xs">
            <caption className="sr-only">
              Overall data quality score, failing rules and open issues at the
              end of each of the last {trend.length} weeks
            </caption>
            <thead className="bg-[#13151a]">
              <tr>
                <th scope="col" className={TH}>
                  Week ending
                </th>
                <th scope="col" className={`${TH} text-right`}>
                  Score
                </th>
                <th scope="col" className={TH}>
                  Failing rules
                </th>
                <th scope="col" className={TH}>
                  Open issues
                </th>
              </tr>
            </thead>
            <tbody>
              {trend.map((point, i) => (
                <tr
                  key={point.weekEnding}
                  className="border-t border-white/[0.06] align-top"
                >
                  <th
                    scope="row"
                    className={`${TD} whitespace-nowrap font-mono font-normal tabular-nums`}
                  >
                    {point.weekEnding}
                  </th>
                  <td
                    className={`${TD} text-right font-mono tabular-nums text-[#f4f4f6]`}
                  >
                    {point.overall.score === null
                      ? "None"
                      : percent(point.overall.score)}
                  </td>
                  <td className={`${TD} @2xl:min-w-56`}>
                    <span className="flex items-center gap-3">
                      <span className="w-5 shrink-0 text-right font-mono tabular-nums text-[#f4f4f6]">
                        {failing[i]}
                      </span>
                      <span
                        aria-hidden="true"
                        className="relative hidden h-2 w-24 shrink-0 bg-white/[0.06] @2xl:block"
                      >
                        <span
                          className="absolute inset-y-0 left-0 rounded-r-[4px] bg-slate-400"
                          style={{
                            width: `${(failing[i] / mostFailing) * 100}%`,
                          }}
                        />
                      </span>
                    </span>
                    <span className="mt-1 block text-slate-400">
                      <RuleLinks ruleIds={point.failingRuleIds} />
                    </span>
                  </td>
                  <td className={`${TD} whitespace-nowrap`}>
                    {point.openIssueIds.length === 0
                      ? "None"
                      : point.openIssueIds.map((id, j) => (
                          <span key={id}>
                            {j > 0 && ", "}
                            <a
                              href={`#${dqIssueAnchor(id)}`}
                              className={`${LINK} font-mono`}
                            >
                              {id}
                            </a>
                          </span>
                        ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold tracking-[-0.02em]">Issue log</h3>
        <p className="mt-2 max-w-3xl text-sm text-slate-300">
          Each issue is opened by the rules that caught it and closed only once
          a later run verifies the fix. The log is append-only: an entry is
          never edited or removed.
        </p>
        <ul className="mt-4 grid gap-3 @4xl:grid-cols-2">
          {issues.map((issue) => (
            <li
              key={issue.issueId}
              id={dqIssueAnchor(issue.issueId)}
              tabIndex={-1}
              className="min-w-0 scroll-mt-24 border border-white/[0.08] bg-[#13151a] p-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <h4 className="text-base font-semibold text-[#f4f4f6]">
                <span className="font-mono">{issue.issueId}</span>{" "}
                {scenarioName.get(issue.scenarioId) ?? issue.scenarioId}
              </h4>
              <p className="mt-1 text-xs text-slate-400">
                {DQ_ISSUE_STATUS_LABEL[issue.status]} · detected{" "}
                {issue.detectedOn}
                {issue.fixedOn === null
                  ? ", still in the data"
                  : `, fixed ${issue.fixedOn}`}
              </p>
              <p className="mt-2 text-xs text-slate-300">
                Caught by <RuleLinks ruleIds={issue.ruleIds} />
              </p>
              <ol className="mt-3 space-y-2 text-sm">
                {issue.history.map((event) => (
                  <li
                    key={`${event.status}-${event.on}`}
                    className="border-l-2 border-white/[0.12] pl-3"
                  >
                    <p className="text-xs text-slate-400">
                      <span className="font-mono tabular-nums">{event.on}</span>{" "}
                      · {DQ_ISSUE_STATUS_LABEL[event.status]} · {event.actor}
                    </p>
                    <p className="mt-0.5 text-slate-200">{event.note}</p>
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="text-lg font-semibold tracking-[-0.02em]">
          Defects the rules catch
        </h3>
        <p className="mt-2 max-w-3xl text-sm text-slate-300">
          Each defect below is one real source feeds deliver, applied to a copy
          of the warehouse. The table shows the failing rows of each rule it
          trips, before and with the defect. A rule can count more failing rows
          and still meet its threshold, as a late entry or two does.
        </p>
        <ul className="mt-4 grid gap-3 @4xl:grid-cols-2">
          {effects.map(({ scenario, rules: tripped }) => (
            <li
              key={scenario.id}
              className="min-w-0 border border-white/[0.08] bg-[#13151a] p-4"
            >
              <h4 className="text-base font-semibold text-[#f4f4f6]">
                {scenario.name}
              </h4>
              <p className="mt-1 text-xs text-slate-400">
                From {scenario.sourceSystem}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">
                {scenario.story}
              </p>
              <div
                className={REGION}
                tabIndex={0}
                role="region"
                aria-label={`Rules ${scenario.name} trips`}
              >
                <table className="w-full border-collapse text-left text-xs">
                  <caption className="sr-only">
                    Failing rows of each rule {scenario.name} trips, before and
                    with the defect
                  </caption>
                  <thead className="bg-[#0d0e11]">
                    <tr>
                      <th scope="col" className={TH}>
                        Rule
                      </th>
                      <th scope="col" className={`${TH} text-right`}>
                        Failing before
                      </th>
                      <th scope="col" className={`${TH} text-right`}>
                        With the defect
                      </th>
                      <th scope="col" className={TH}>
                        Result
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {tripped.map((rule) => (
                      <tr
                        key={rule.ruleId}
                        className="border-t border-white/[0.06]"
                      >
                        <th scope="row" className={`${TD} font-normal`}>
                          <RuleLinks ruleIds={[rule.ruleId]} />
                        </th>
                        <td
                          className={`${TD} text-right font-mono tabular-nums`}
                        >
                          {rule.failedBefore}
                        </td>
                        <td
                          className={`${TD} text-right font-mono tabular-nums`}
                        >
                          {rule.failedAfter}
                        </td>
                        <td className={TD}>
                          <StatusText status={rule.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="text-lg font-semibold tracking-[-0.02em]">Every rule</h3>
        <p className="mt-2 max-w-3xl text-sm text-slate-300">
          {rules.length} rules:{" "}
          {rules.filter((r) => r.source === "platform").length} written for the
          platform&apos;s products, and{" "}
          {rules.filter((r) => r.source === "conformance").length} conformance
          rules of the Study Data Pipeline, taken in as they are rather than
          written twice. A rule passes when the share of rows it checks that
          pass is at or above its threshold.
        </p>
        <RuleGroupReveal />
        <div className="mt-4 space-y-3">
          {assessment.byDimension.map((dimension) => (
            <RuleGroup
              key={dimension.key}
              dimension={dimension}
              rules={rules.filter((r) => r.dimension === dimension.key)}
              results={results}
              productName={productName}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function RuleGroup({
  dimension,
  rules,
  results,
  productName,
}: {
  dimension: DqScore;
  rules: readonly DqRule[];
  results: ReadonlyMap<string, DqRuleResult>;
  productName: (id: string) => string;
}) {
  // A group holding a rule that is not passing opens, so it is seen first.
  const attention = rules.some((r) => {
    const status = results.get(r.id)?.status;
    return status === "fail" || status === "warn";
  });
  return (
    <details
      open={attention}
      className="border border-white/[0.08] bg-[#13151a]"
    >
      <summary className="flex min-h-12 cursor-pointer items-center px-4 text-sm text-slate-100 marker:text-slate-500">
        {dimension.label}: {rules.length} rules, {dimension.passing} passing
      </summary>
      <div
        className="overflow-x-auto border-t border-white/[0.08] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
        tabIndex={0}
        role="region"
        aria-label={`${dimension.label} rules`}
      >
        <table className="w-full border-collapse text-left text-xs">
          <caption className="sr-only">
            {dimension.label} rules with their results, thresholds, severities
            and products
          </caption>
          <thead className="bg-[#0d0e11]">
            <tr>
              <th scope="col" className={TH}>
                Rule
              </th>
              <th scope="col" className={TH}>
                Result
              </th>
              <th scope="col" className={`${TH} text-right`}>
                Pass rate
              </th>
              <th scope="col" className={`${TH} text-right`}>
                Threshold
              </th>
              <th scope="col" className={TH}>
                Severity
              </th>
              <th scope="col" className={TH}>
                Data product
              </th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => {
              const result = results.get(rule.id);
              return (
                <tr
                  key={rule.id}
                  id={dqRuleAnchor(rule.id)}
                  tabIndex={-1}
                  className="scroll-mt-24 border-t border-white/[0.06] align-top focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400"
                >
                  <th
                    scope="row"
                    className={`${TD} min-w-52 font-normal @2xl:min-w-64`}
                  >
                    <span className="font-mono text-slate-400">{rule.id}</span>{" "}
                    <span className="text-slate-100">{rule.name}</span>
                    <code className="mt-1 block font-mono text-xs text-slate-400 wrap-anywhere">
                      {rule.expression}
                    </code>
                    {rule.citation !== null && (
                      <span className="mt-1 block text-slate-400 wrap-anywhere">
                        After {rule.citation}
                      </span>
                    )}
                  </th>
                  <td className={`${TD} min-w-36 @2xl:min-w-56`}>
                    {result === undefined ? (
                      <StatusText status="not-applicable" />
                    ) : (
                      <>
                        <StatusText status={result.status} />
                        {result.failed > 0 && (
                          <span className="mt-1 block text-slate-400">
                            {result.failed} of {result.checked} rows fail, for
                            example{" "}
                            <span className="font-mono wrap-anywhere">
                              {result.sample.slice(0, SAMPLE_SHOWN).join(", ")}
                            </span>
                          </span>
                        )}
                      </>
                    )}
                  </td>
                  <td className={`${TD} text-right font-mono tabular-nums`}>
                    {result?.passRate == null
                      ? "None"
                      : percent(result.passRate)}
                  </td>
                  <td className={`${TD} text-right font-mono tabular-nums`}>
                    {percent(rule.threshold)}
                  </td>
                  <td className={TD}>{DQ_SEVERITY_LABEL[rule.severity]}</td>
                  <td className={`${TD} min-w-36`}>
                    {productName(rule.productId)}
                    {rule.dataset !== null && (
                      <span className="block font-mono text-slate-400">
                        {rule.dataset}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </details>
  );
}
