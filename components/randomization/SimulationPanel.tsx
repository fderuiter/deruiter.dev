"use client";

import {
  useEffect,
  useId,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import {
  DEFAULT_SIMULATION_REPETITIONS,
  MAX_SIMULATION_ATTRITION_PERCENT,
  MONTE_CARLO_SIMULATION_VERSION,
  RANDOMIZATION_RESOURCE_LIMITS,
  RETAINED_DEVIATION_WARNING,
  isSimulationReportCurrent,
  reproduceRepetitionRequest,
  type ArmCountStatistics,
  type DeviationBand,
  type RandomizationRequest,
  type SimulationReport,
  type SimulationRequest,
} from "@/lib/randomization";
import { downloadFile } from "@/lib/download";
import { clamp } from "@/lib/utils";
import {
  createRandomizationClient,
  type RandomizationClient,
} from "./randomization-client";

const BAND_COPY: Record<DeviationBand, string> = {
  "below-0.1%": "Under 0.1%",
  "below-1%": "Under 1%",
  "1%-or-more": "1% or more",
  "n/a": "Not available",
};

const INTERPRETATION_COPY: Record<SimulationReport["interpretation"], string> =
  {
    descriptive:
      "Every repetition succeeded. These figures describe this sample of runs only.",
    incomplete:
      "Some repetitions failed or were canceled. The figures cover only the successful runs and are not evidence of balance.",
    "no-successful-repetitions":
      "No repetition succeeded, so there is nothing to describe. This is not a passing result.",
  };

/** Props for {@link SimulationPanel}. */
interface SimulationPanelProps {
  /** The current plan. Editing it marks an existing report stale. */
  readonly plan: RandomizationRequest;
  readonly workspaceRevision: number;
  /** Builds the panel's own client; defaults to a dedicated worker client. */
  readonly createClient?: () => RandomizationClient;
}

function formatCount(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function formatPercent(value: number | null): string {
  return value === null ? "n/a" : `${(value * 100).toFixed(2)}%`;
}

function clampWhole(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return clamp(Math.round(value), min, max);
}

function StatisticsCells({ stats }: { readonly stats: ArmCountStatistics }) {
  return (
    <>
      <td className="px-2 py-1 font-mono">
        {formatCount(stats.mean)} ({formatCount(stats.expectedMean)})
      </td>
      <td className="px-2 py-1 font-mono">
        {stats.min}–{stats.max}
      </td>
      <td className="px-2 py-1 font-mono">
        {stats.standardDeviation.toFixed(2)}
      </td>
      <td className="px-2 py-1">
        {formatPercent(stats.absoluteRelativeDeviation)} ·{" "}
        {BAND_COPY[stats.band]}
      </td>
    </>
  );
}

/**
 * Reproducible Monte Carlo allocation QA for one plan (#4007). It runs on
 * its own randomization client, so cancelling it never stops a schedule
 * generation or a study-data pipeline run. The report describes allocation
 * behavior in a finite sample; it makes no significance, power or approval
 * claim.
 */
export function SimulationPanel({
  plan,
  workspaceRevision,
  createClient,
}: SimulationPanelProps) {
  const baseId = useId();
  const [client] = useState<RandomizationClient>(
    () => createClient?.() ?? createRandomizationClient()
  );
  const state = useSyncExternalStore(
    client.subscribe,
    client.getState,
    client.getState
  );
  const [masterSeed, setMasterSeed] = useState(plan.seed.value);
  const [repetitions, setRepetitions] = useState(
    DEFAULT_SIMULATION_REPETITIONS
  );
  const [attritionPercent, setAttritionPercent] = useState(0);
  const [repetitionIndex, setRepetitionIndex] = useState(0);
  // The exact request the latest run used, for reproducing its repetitions.
  const [ranRequest, setRanRequest] = useState<SimulationRequest | null>(null);

  useEffect(() => () => client.dispose(), [client]);

  const request: SimulationRequest = useMemo(
    () => ({
      simulationVersion: MONTE_CARLO_SIMULATION_VERSION,
      masterSeed,
      repetitions,
      attritionPercent,
      plan,
    }),
    [masterSeed, repetitions, attritionPercent, plan]
  );

  const report = state.status === "complete" ? state.report : null;
  const stale = report !== null && !isSimulationReportCurrent(report, request);
  const running = state.status === "running";
  const reportRepetitions = report?.identity.repetitions ?? repetitions;

  const run = () => {
    const frozen = JSON.parse(JSON.stringify(request)) as SimulationRequest;
    setRanRequest(frozen);
    void client.simulate({ request: frozen, workspaceRevision });
  };

  const reviewed =
    report && ranRequest && isSimulationReportCurrent(report, ranRequest)
      ? ranRequest
      : null;

  const downloadRepetition = () => {
    if (!reviewed) return;
    const index = clampWhole(repetitionIndex, 0, reportRepetitions - 1);
    downloadFile(
      JSON.stringify(reproduceRepetitionRequest(reviewed, index), null, 2),
      `${plan.id || "randomization"}-repetition-${index}.json`,
      { mimeType: "application/json" }
    );
  };

  const downloadRunner = () => {
    downloadFile(
      JSON.stringify(request, null, 2),
      `${plan.id || "randomization"}-monte-carlo-request.json`,
      { mimeType: "application/json" }
    );
  };

  const armLabel = new Map(plan.arms.map((a) => [a.id, a.label]));
  const seedId = `${baseId}-seed`;
  const repetitionsId = `${baseId}-repetitions`;
  const attritionId = `${baseId}-attrition`;
  const statusId = `${baseId}-status`;
  const indexId = `${baseId}-index`;

  return (
    <section
      className="@container min-w-0 rounded-lg border border-zinc-800 bg-[#13151a] p-4 text-[#f4f4f6]"
      aria-labelledby={`${baseId}-title`}
      data-testid="randomization-simulation-panel"
    >
      <h3
        id={`${baseId}-title`}
        className="text-base font-semibold tracking-[-0.035em]"
      >
        Monte Carlo allocation QA
      </h3>
      <p className="mt-1 text-sm text-[#94a3b8]">
        Repeats this plan with seeds derived from one master seed, then removes
        a share of subjects at random from a separate stream. It shows how
        allocations behave across runs. It is not a significance test and does
        not validate the design.
      </p>

      <form
        className="mt-4 grid min-w-0 gap-3 @md:grid-cols-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (!running) run();
        }}
      >
        <label className="flex min-w-0 flex-col gap-1 text-sm" htmlFor={seedId}>
          Master seed
          <input
            id={seedId}
            className="min-w-0 rounded border border-zinc-800 bg-[#0d0e11] px-2 py-1 font-mono"
            value={masterSeed}
            maxLength={128}
            onChange={(event) =>
              setMasterSeed(event.target.value.replace(/[^A-Za-z0-9]/g, ""))
            }
          />
        </label>
        <label
          className="flex min-w-0 flex-col gap-1 text-sm"
          htmlFor={repetitionsId}
        >
          Repetitions (1 to{" "}
          {RANDOMIZATION_RESOURCE_LIMITS.maxSimulationRepetitions})
          <input
            id={repetitionsId}
            type="number"
            min={1}
            max={RANDOMIZATION_RESOURCE_LIMITS.maxSimulationRepetitions}
            className="min-w-0 rounded border border-zinc-800 bg-[#0d0e11] px-2 py-1 font-mono"
            value={repetitions}
            onChange={(event) =>
              setRepetitions(
                clampWhole(
                  Number(event.target.value),
                  1,
                  RANDOMIZATION_RESOURCE_LIMITS.maxSimulationRepetitions
                )
              )
            }
          />
        </label>
        <label
          className="flex min-w-0 flex-col gap-1 text-sm"
          htmlFor={attritionId}
        >
          Attrition % (0 to {MAX_SIMULATION_ATTRITION_PERCENT})
          <input
            id={attritionId}
            type="number"
            min={0}
            max={MAX_SIMULATION_ATTRITION_PERCENT}
            step={1}
            className="min-w-0 rounded border border-zinc-800 bg-[#0d0e11] px-2 py-1 font-mono"
            value={attritionPercent}
            onChange={(event) =>
              setAttritionPercent(
                clampWhole(
                  Number(event.target.value),
                  0,
                  MAX_SIMULATION_ATTRITION_PERCENT
                )
              )
            }
          />
        </label>
        <div className="flex flex-wrap gap-2 @md:col-span-3">
          <button
            type="submit"
            disabled={running || masterSeed.length === 0}
            className="rounded border border-zinc-800 px-3 py-1 text-sm active:scale-[0.98] disabled:opacity-50"
          >
            Run QA
          </button>
          <button
            type="button"
            disabled={!running}
            onClick={() => client.cancel()}
            className="rounded border border-zinc-800 px-3 py-1 text-sm active:scale-[0.98] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={downloadRunner}
            className="rounded border border-zinc-800 px-3 py-1 text-sm active:scale-[0.98]"
          >
            Download Monte Carlo QA request JSON (no schedule rows)
          </button>
        </div>
      </form>

      <div
        id={statusId}
        className="mt-3 text-sm"
        role="status"
        aria-live="polite"
      >
        {state.status === "ready" && "No QA run yet."}
        {running &&
          (state.progress
            ? `Running repetition ${state.progress.completed} of ${state.progress.total}.`
            : "Preparing the simulation.")}
        {state.status === "canceled" && "QA run canceled. No result was kept."}
        {state.status === "complete" && report && "QA run complete."}
      </div>
      {running && state.progress && (
        <progress
          className="mt-2 w-full"
          aria-describedby={statusId}
          value={state.progress.completed}
          max={state.progress.total}
        />
      )}
      {state.status === "failed" && (
        <div role="alert" className="mt-3 text-sm text-[#f59e0b]">
          <p>
            The QA run failed:{" "}
            <code className="font-mono">{state.errorCode}</code>
          </p>
          {state.findings.length > 0 && (
            <ul className="mt-1 list-disc pl-5">
              {state.findings.slice(0, 5).map((finding, i) => (
                <li key={`${finding.fieldPath}-${i}`}>{finding.message}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {report && (
        <div
          className="mt-4 min-w-0"
          data-testid="randomization-simulation-report"
        >
          {stale && (
            <p role="alert" className="mb-2 text-sm text-[#f59e0b]">
              This report is stale: the plan or the QA settings changed after it
              ran. Run QA again before relying on it.
            </p>
          )}
          <p className="font-mono text-xs text-[#94a3b8]">
            Master seed {report.identity.masterSeed} ·{" "}
            {report.identity.repetitions} repetitions · attrition{" "}
            {report.identity.attritionPercent}% · plan{" "}
            {report.identity.planDigest.slice(0, 12)} ·{" "}
            {report.identity.algorithmId}
          </p>
          <p className="mt-2 text-sm">
            Attempted {report.attempted} · succeeded {report.succeeded} · failed{" "}
            {report.failed} · canceled {report.canceled}. Mean allocated{" "}
            {formatCount(report.meanAllocated)}, mean retained{" "}
            {formatCount(report.meanRetained)}.
          </p>
          <p className="mt-1 text-sm">
            {INTERPRETATION_COPY[report.interpretation]}
          </p>
          {report.failures.length > 0 && (
            <p className="mt-1 text-sm text-[#f59e0b]">
              Failed repetitions:{" "}
              {report.failures
                .slice(0, 10)
                .map((f) => `${f.index} (${f.code})`)
                .join(", ")}
              {report.failures.length > 10 ? ", …" : ""}
            </p>
          )}
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-0 text-left text-sm">
              <caption className="sr-only">
                Arm counts across successful repetitions, before and after
                attrition. Expected values are in parentheses.
              </caption>
              <thead className="text-xs text-[#94a3b8]">
                <tr>
                  <th scope="col" className="px-2 py-1">
                    Arm
                  </th>
                  <th scope="col" className="px-2 py-1">
                    Share
                  </th>
                  <th scope="col" className="px-2 py-1">
                    Allocated mean
                  </th>
                  <th scope="col" className="px-2 py-1">
                    Range
                  </th>
                  <th scope="col" className="px-2 py-1">
                    SD
                  </th>
                  <th scope="col" className="px-2 py-1">
                    Deviation
                  </th>
                  <th scope="col" className="px-2 py-1">
                    Retained mean
                  </th>
                  <th scope="col" className="px-2 py-1">
                    Range
                  </th>
                  <th scope="col" className="px-2 py-1">
                    SD
                  </th>
                  <th scope="col" className="px-2 py-1">
                    Deviation
                  </th>
                </tr>
              </thead>
              <tbody>
                {report.arms.map((arm) => (
                  <tr key={arm.armId} className="border-t border-zinc-800">
                    <th scope="row" className="px-2 py-1 font-normal">
                      {armLabel.get(arm.armId) ?? arm.armId}
                      {arm.retainedWarning && (
                        <span className="ml-1 text-[#f59e0b]">
                          (retained deviation over{" "}
                          {RETAINED_DEVIATION_WARNING * 100}%)
                        </span>
                      )}
                    </th>
                    <td className="px-2 py-1 font-mono">
                      {(arm.expectedShare * 100).toFixed(1)}%
                    </td>
                    <StatisticsCells stats={arm.allocated} />
                    <StatisticsCells stats={arm.retained} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="mt-3 list-disc pl-5 text-xs text-[#94a3b8]">
            {report.limitations.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-sm" htmlFor={indexId}>
              Repetition to reproduce
              <input
                id={indexId}
                type="number"
                min={0}
                max={reportRepetitions - 1}
                className="w-24 rounded border border-zinc-800 bg-[#0d0e11] px-2 py-1 font-mono"
                value={repetitionIndex}
                onChange={(event) =>
                  setRepetitionIndex(
                    clampWhole(
                      Number(event.target.value),
                      0,
                      reportRepetitions - 1
                    )
                  )
                }
              />
            </label>
            <button
              type="button"
              disabled={!reviewed}
              onClick={downloadRepetition}
              className="rounded border border-zinc-800 px-3 py-1 text-sm active:scale-[0.98] disabled:opacity-50"
            >
              Download that repetition&apos;s QA request JSON (single cohort, no
              schedule rows)
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
