/**
 * The data quality issue log and the weekly trend (#2636). The log is
 * append-only: an issue moves from detected to verified one step at a time
 * and nothing is edited or removed. The trend replays it, because the
 * portfolio is generated at one data cut: each week's scorecard is the
 * cut's data with the defects that were open that week put back.
 */
import type { PipelineRun } from "@/lib/study-data";
import type {
  DqIssue,
  DqIssueEvent,
  DqIssueStatus,
  DqTrendPoint,
  Warehouse,
} from "../../types";
import { addDays } from "../warehouse/dates";
import { assessDataQuality, DATA_QUALITY_RULES } from "./assess";
import { applyDqScenario, DQ_SCENARIOS } from "./faults";

const LIFECYCLE: readonly DqIssueStatus[] = [
  "detected",
  "assigned",
  "root-cause",
  "fixed",
  "verified",
];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The log with one more entry.
 *
 * @throws Error when the entry would skip or repeat a step, predate the
 *   issue's previous entry, or open an issue without a known defect and
 *   the rules that caught it.
 */
export function appendDqIssueEvent(
  log: readonly DqIssueEvent[],
  event: DqIssueEvent
): readonly DqIssueEvent[] {
  if (!ISO_DATE.test(event.on)) {
    throw new Error(`${event.issueId}: ${event.on} is not an ISO 8601 date`);
  }
  const previous = log.filter((e) => e.issueId === event.issueId).at(-1);
  const expected =
    previous === undefined
      ? "detected"
      : LIFECYCLE[LIFECYCLE.indexOf(previous.status) + 1];
  if (event.status !== expected) {
    throw new Error(
      `${event.issueId}: expected ${expected ?? "no further entry"}, got ${event.status}`
    );
  }
  if (previous !== undefined && event.on < previous.on) {
    throw new Error(
      `${event.issueId}: ${event.status} predates ${previous.status}`
    );
  }
  if (event.status === "detected") {
    if (!DQ_SCENARIOS.some((s) => s.id === event.scenarioId)) {
      throw new Error(`${event.issueId}: unknown defect ${event.scenarioId}`);
    }
    const known = new Set(DATA_QUALITY_RULES.map((r) => r.id));
    if (
      event.ruleIds.length === 0 ||
      event.ruleIds.some((id) => !known.has(id))
    ) {
      throw new Error(`${event.issueId}: detection must name known rules`);
    }
  } else if (event.scenarioId !== null || event.ruleIds.length > 0) {
    throw new Error(
      `${event.issueId}: only detection names the defect and rules`
    );
  }
  return Object.freeze([...log, event]);
}

/** Issues as their log entries leave them, in id order. */
export function dqIssues(log: readonly DqIssueEvent[]): DqIssue[] {
  const ids = [...new Set(log.map((e) => e.issueId))].sort();
  return ids.map((issueId) => {
    const history = log.filter((e) => e.issueId === issueId);
    const opened = history[0];
    if (opened.scenarioId === null) {
      throw new Error(`${issueId}: the log does not open with its detection`);
    }
    return {
      issueId,
      scenarioId: opened.scenarioId,
      ruleIds: opened.ruleIds,
      status: history[history.length - 1].status,
      detectedOn: opened.on,
      fixedOn: history.find((e) => e.status === "fixed")?.on ?? null,
      history,
    };
  });
}

/** Whether an issue's defect was in the data at the end of a day. */
const openOn = (issue: DqIssue, on: string) =>
  issue.detectedOn <= on && (issue.fixedOn === null || issue.fixedOn > on);

/**
 * A warehouse with the defects of the issues open on a date put back, in
 * issue order.
 */
export function withOpenDqIssues(
  warehouse: Warehouse,
  log: readonly DqIssueEvent[],
  on: string
): Warehouse {
  return dqIssues(log)
    .filter((issue) => openOn(issue, on))
    .reduce((w, issue) => applyDqScenario(w, issue.scenarioId), warehouse);
}

/**
 * The scorecard at the end of each of the weeks up to the data cut.
 *
 * @param weeks - Weeks to cover, from 1 to 52; the last ends on the cut.
 * @throws Error when `weeks` is out of range or the log runs past the cut.
 */
export function dataQualityTrend(
  warehouse: Warehouse,
  run: PipelineRun,
  log: readonly DqIssueEvent[],
  weeks = 12
): DqTrendPoint[] {
  if (!Number.isInteger(weeks) || weeks < 1 || weeks > 52) {
    throw new Error("a data quality trend covers 1 to 52 weeks");
  }
  if (log.some((e) => e.on > warehouse.asOf)) {
    throw new Error("the issue log runs past the data cut");
  }
  const issues = dqIssues(log);
  return Array.from({ length: weeks }, (_, i) => {
    const weekEnding = addDays(warehouse.asOf, -7 * (weeks - 1 - i));
    const open = issues.filter((issue) => openOn(issue, weekEnding));
    const assessment = assessDataQuality(
      open.reduce(
        (w, issue) => applyDqScenario(w, issue.scenarioId),
        warehouse
      ),
      run
    );
    return {
      weekEnding,
      overall: assessment.overall,
      byDimension: assessment.byDimension,
      failingRuleIds: assessment.results
        .filter((r) => r.status === "fail")
        .map((r) => r.ruleId),
      openIssueIds: open.map((issue) => issue.issueId),
    };
  });
}

interface Step {
  readonly status: DqIssueStatus;
  readonly on: string;
  readonly actor: string;
  readonly note: string;
}

function issue(
  issueId: string,
  scenarioId: string,
  steps: readonly Step[]
): DqIssueEvent[] {
  const scenario = DQ_SCENARIOS.find((s) => s.id === scenarioId);
  if (scenario === undefined) throw new Error(`no scenario ${scenarioId}`);
  return steps.map((step, i) => ({
    issueId,
    ...step,
    scenarioId: i === 0 ? scenarioId : null,
    ruleIds: i === 0 ? scenario.ruleIds : [],
  }));
}

const RULES_RUN = "Data quality rules";
const STEWARD = "Clinical data steward";

/**
 * The seeded issue log for the default portfolio: six defects over the
 * twelve weeks to the 2026-09-30 cut, four closed and two still open.
 */
export const DQ_ISSUE_LOG: readonly DqIssueEvent[] = [
  ...issue("DQI-001", "finance-double-load", [
    {
      status: "detected",
      on: "2026-07-15",
      actor: RULES_RUN,
      note: "Spend reconciliation off for one study and quarter.",
    },
    {
      status: "assigned",
      on: "2026-07-16",
      actor: STEWARD,
      note: "Assigned to the finance data owner.",
    },
    {
      status: "root-cause",
      on: "2026-07-20",
      actor: "Finance data owner",
      note: "Extract rerun appended instead of replacing.",
    },
    {
      status: "fixed",
      on: "2026-07-28",
      actor: "Finance data owner",
      note: "Load made idempotent; quarter reloaded.",
    },
    {
      status: "verified",
      on: "2026-08-05",
      actor: STEWARD,
      note: "Reconciliation passes on the next weekly run.",
    },
  ]),
  ...issue("DQI-002", "duplicate-ctms-site", [
    {
      status: "detected",
      on: "2026-07-29",
      actor: RULES_RUN,
      note: "Site number and name repeat within a study.",
    },
    {
      status: "assigned",
      on: "2026-07-30",
      actor: STEWARD,
      note: "Assigned to the CTMS owner.",
    },
    {
      status: "root-cause",
      on: "2026-08-04",
      actor: "CTMS owner",
      note: "CRO instance feeding alongside the sponsor's.",
    },
    {
      status: "fixed",
      on: "2026-08-19",
      actor: "CTMS owner",
      note: "CRO feed mapped onto sponsor site ids.",
    },
    {
      status: "verified",
      on: "2026-08-26",
      actor: STEWARD,
      note: "One site per study and number again.",
    },
  ]),
  ...issue("DQI-003", "enrollment-date-dropped", [
    {
      status: "detected",
      on: "2026-08-12",
      actor: RULES_RUN,
      note: "Enrolled subject with no enrollment date; enrollment no longer reconciles.",
    },
    {
      status: "assigned",
      on: "2026-08-13",
      actor: STEWARD,
      note: "Assigned to the EDC owner.",
    },
    {
      status: "root-cause",
      on: "2026-08-18",
      actor: "EDC owner",
      note: "Interface mapped a renamed field.",
    },
    {
      status: "fixed",
      on: "2026-09-02",
      actor: "EDC owner",
      note: "Mapping corrected and the subject reloaded.",
    },
    {
      status: "verified",
      on: "2026-09-09",
      actor: STEWARD,
      note: "Enrollment reconciles with EDC again.",
    },
  ]),
  ...issue("DQI-004", "query-closed-before-open", [
    {
      status: "detected",
      on: "2026-08-26",
      actor: RULES_RUN,
      note: "Query closed before it opened.",
    },
    {
      status: "assigned",
      on: "2026-08-27",
      actor: STEWARD,
      note: "Assigned to the EDC owner.",
    },
    {
      status: "root-cause",
      on: "2026-09-01",
      actor: "EDC owner",
      note: "Upgrade wrote close times in local time.",
    },
    {
      status: "fixed",
      on: "2026-09-09",
      actor: "EDC owner",
      note: "Timestamps normalised to UTC at extract.",
    },
    {
      status: "verified",
      on: "2026-09-16",
      actor: STEWARD,
      note: "Query timestamps in order again.",
    },
  ]),
  ...issue("DQI-005", "visit-before-consent", [
    {
      status: "detected",
      on: "2026-09-09",
      actor: RULES_RUN,
      note: "Visit dated before screening consent.",
    },
    {
      status: "assigned",
      on: "2026-09-10",
      actor: STEWARD,
      note: "Assigned to the study's clinical data manager.",
    },
    {
      status: "root-cause",
      on: "2026-09-16",
      actor: "Clinical data manager",
      note: "Wrong year keyed; query raised to the site.",
    },
  ]),
  ...issue("DQI-006", "expired-kit-dispensed", [
    {
      status: "detected",
      on: "2026-09-23",
      actor: RULES_RUN,
      note: "Kit dispensed after expiry.",
    },
    {
      status: "assigned",
      on: "2026-09-24",
      actor: STEWARD,
      note: "Assigned to the IRT owner and the study's supply lead.",
    },
  ]),
]
  // Entries are appended in the order they happened, across issues.
  .sort((a, b) => a.on.localeCompare(b.on))
  .reduce<readonly DqIssueEvent[]>((log, e) => appendDqIssueEvent(log, e), []);
