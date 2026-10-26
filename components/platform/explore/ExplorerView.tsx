"use client";

import { useEffect, useId, useState } from "react";
import { copyToClipboard, getActiveHostUrl } from "@/lib/clipboard";
import {
  EXPLORER_MAX_DIMENSIONS,
  METRIC_DIMENSIONS,
  checkExploration,
  explorationChoices,
  explorationCsv,
  explorerMetrics,
  promotionSteps,
  startExploration,
  type Exploration,
  type ExplorationResult,
  type MetricDimensionId,
  type MetricFilter,
  type PromotionStep,
  type ReportVisual,
} from "@/lib/clinical-platform";
import { ReportView } from "../ReportView";

/**
 * How a change enters the browser history: `push` adds a step Back can
 * undo, `replace` edits the current one.
 */
export type HistoryMode = "push" | "replace";

const VISUAL_LABEL: Readonly<Record<ReportVisual, string>> = {
  stat: "Number",
  bar: "Bar chart",
  line: "Line chart",
  table: "Table",
};

const STEP_STATUS = {
  met: { glyph: "✓", label: "Met", className: "text-emerald-300" },
  "to-do": { glyph: "○", label: "To do", className: "text-amber-300" },
} as const;

const control =
  "min-h-11 w-full min-w-0 border border-white/[0.12] bg-[#13151a] px-3 text-sm text-slate-100 focus-visible:outline-2 focus-visible:outline-amber-400";

const button =
  "inline-flex min-h-11 items-center justify-center border border-white/[0.12] bg-[#13151a] px-3 text-sm text-slate-100 hover:border-amber-400/60 focus-visible:outline-2 focus-visible:outline-amber-400 active:scale-[0.98]";

const METRICS = explorerMetrics();

/** The metrics in their display folders, in registry order. */
const FOLDERS = [...new Set(METRICS.map((m) => m.displayFolder))].map(
  (folder) => ({
    folder,
    metrics: METRICS.filter((m) => m.displayFolder === folder),
  })
);

function dimensionLabel(id: MetricDimensionId): string {
  return METRIC_DIMENSIONS.find((d) => d.id === id)?.label ?? id;
}

/** A list in words: "a", "a and b", "a, b and c". */
function inWords(items: readonly string[]): string {
  return items.length < 2
    ? items.join("")
    : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function filterText(filter: MetricFilter): string {
  return `${dimensionLabel(filter.dimension)} ${
    filter.operator === "in" ? "is" : "is not"
  } ${inWords(filter.values)}`;
}

/**
 * The exploration a metric change leads to: the same grouping and filters
 * where the new metric allows them, or else the metric's own start.
 */
function switchMetric(current: Exploration, metricId: string): Exploration {
  const kept: Exploration = {
    metricId,
    dimensions: current.dimensions,
    filters: current.filters,
    visual: null,
  };
  const started = startExploration(metricId);
  if (checkExploration(kept).length === 0) return kept;
  const grouped: Exploration = { ...started, filters: current.filters };
  return checkExploration(grouped).length === 0 ? grouped : started;
}

function FilterEditor({
  filter,
  values,
  onValues,
  onOperator,
  onRemove,
}: {
  filter: MetricFilter;
  values: readonly string[] | null;
  onValues: (values: readonly string[]) => void;
  onOperator: (operator: MetricFilter["operator"]) => void;
  onRemove: () => void;
}) {
  const id = useId();
  const label = dimensionLabel(filter.dimension);
  const chosen = new Set(filter.values);
  return (
    <fieldset className="min-w-0 border border-white/[0.08] bg-[#13151a] p-3">
      <legend className="px-1 text-sm font-medium text-slate-200">
        {label}
      </legend>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-300">
        {(["in", "not-in"] as const).map((operator) => (
          <label
            key={operator}
            className="inline-flex min-h-11 items-center gap-2"
          >
            <input
              type="radio"
              name={`${id}-operator`}
              checked={filter.operator === operator}
              onChange={() => onOperator(operator)}
              className="accent-amber-400"
            />
            {operator === "in" ? "Keep only these" : "Leave these out"}
          </label>
        ))}
      </div>
      {values === null ? (
        <p className="mt-2 text-sm text-slate-400">Reading the values…</p>
      ) : (
        <>
          <p className="mt-2 text-xs text-slate-400" id={`${id}-count`}>
            {filter.values.length === 0
              ? `Pick at least one of ${values.length} values.`
              : `${filter.values.length} of ${values.length} chosen.`}
          </p>
          <div
            role="group"
            aria-label={`${label} values`}
            aria-describedby={`${id}-count`}
            className="mt-1 grid max-h-56 gap-x-4 overflow-y-auto border-t border-white/[0.06] pt-1 @md:grid-cols-2"
          >
            {values.map((value) => (
              <label
                key={value}
                className="flex min-h-11 min-w-0 items-center gap-2 text-sm text-slate-200"
              >
                <input
                  type="checkbox"
                  checked={chosen.has(value)}
                  onChange={() =>
                    onValues(
                      chosen.has(value)
                        ? filter.values.filter((v) => v !== value)
                        : [...filter.values, value]
                    )
                  }
                  className="accent-amber-400"
                />
                <span className="min-w-0 break-words font-mono text-xs">
                  {value}
                </span>
              </label>
            ))}
          </div>
        </>
      )}
      <button type="button" onClick={onRemove} className={`${button} mt-3`}>
        {`Remove the ${label.toLowerCase()} filter`}
      </button>
    </fieldset>
  );
}

function Promotion({ steps }: { steps: readonly PromotionStep[] }) {
  const tiers = [
    { tier: "managed", title: "To become a managed report" },
    { tier: "certified", title: "Then, to become a certified report" },
  ] as const;
  return (
    <section
      aria-labelledby="explore-promote"
      className="@container min-w-0 border border-white/[0.08] bg-[#0d0e11] p-4 sm:p-6"
    >
      <h2
        id="explore-promote"
        className="text-xl font-semibold tracking-[-0.02em]"
      >
        Promote it to a managed report
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-300">
        An exploration is a question to ask, not an answer to act on. Before it
        joins the report pack, a person has to do what is still to do here.
        Nothing is promoted from this page.
      </p>
      {tiers.map(({ tier, title }) => (
        <div key={tier} className="mt-5">
          <h3 className="text-sm font-medium text-slate-200">{title}</h3>
          <ol className="mt-2 space-y-3">
            {steps
              .filter((step) => step.tier === tier)
              .map((step) => {
                const status = STEP_STATUS[step.status];
                return (
                  <li key={step.id} className="flex min-w-0 gap-3 text-sm">
                    <span className={`shrink-0 font-mono ${status.className}`}>
                      <span aria-hidden="true">{status.glyph}</span>{" "}
                      {status.label}
                    </span>
                    <span className="min-w-0 break-words leading-relaxed text-slate-300">
                      <span className="text-slate-100">{step.label}</span>{" "}
                      {step.detail}
                    </span>
                  </li>
                );
              })}
          </ol>
        </div>
      ))}
    </section>
  );
}

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * The explorer's controls and result. A visitor picks one governed metric,
 * groups it by up to two dimensions, filters it and picks a visual; only
 * what the semantic layer allows is offered. The result is the shared
 * report renderer's, with the metric's definition, version and SQL, a link
 * to share it, its data as CSV and the steps to promote it.
 *
 * @param exploration - The exploration in the URL.
 * @param result - The latest result; it may be for an earlier exploration
 *   while `busy`.
 * @param busy - Whether the exploration in the URL is still running.
 * @param error - Why the exploration could not run, if it could not.
 * @param linkError - Why the link could not be read, if it could not.
 * @param hash - The exploration's URL hash.
 * @param onChange - Called with the next exploration and how to record it.
 */
export function ExplorerView({
  exploration,
  result,
  busy,
  error,
  linkError,
  hash,
  onChange,
}: {
  exploration: Exploration;
  result: ExplorationResult | null;
  busy: boolean;
  error: string | null;
  linkError: string | null;
  hash: string;
  onChange: (next: Exploration, mode: HistoryMode) => void;
}) {
  const metric = METRICS.find((m) => m.id === exploration.metricId);
  const choices = explorationChoices(exploration);
  const current = result !== null && !busy ? result : null;
  // Values depend only on the metric, so an earlier result for the same
  // metric can offer them while the new one runs.
  const values =
    result !== null && result.exploration.metricId === exploration.metricId
      ? result.filterValues
      : null;
  const [pending, setPending] = useState<{
    dimension: MetricDimensionId;
    operator: MetricFilter["operator"];
  } | null>(null);
  const [copied, setCopied] = useState<"done" | "failed" | null>(null);

  useEffect(() => {
    if (copied === null) return;
    const timer = window.setTimeout(() => setCopied(null), 2500);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const filtered = new Set(exploration.filters.map((f) => f.dimension));
  // A filter being set up shows until it has a value or its metric changes.
  const open =
    pending !== null &&
    choices.filterDimensions.includes(pending.dimension) &&
    !filtered.has(pending.dimension)
      ? pending
      : null;
  const addable = choices.filterDimensions.filter(
    (id) => !filtered.has(id) && id !== open?.dimension
  );

  const setFilter = (
    dimension: MetricDimensionId,
    operator: MetricFilter["operator"],
    chosen: readonly string[]
  ) => {
    const others = exploration.filters.filter((f) => f.dimension !== dimension);
    if (chosen.length === 0) setPending({ dimension, operator });
    onChange(
      {
        ...exploration,
        filters:
          chosen.length === 0
            ? others
            : [...others, { dimension, operator, values: [...chosen] }],
      },
      "replace"
    );
  };

  // While a change runs, the last suggestion stands, so the choice does not flicker.
  const suggested = (current ?? result)?.suggestedVisual ?? null;
  const visual = exploration.visual ?? suggested;

  return (
    <div className="space-y-8">
      <p role="status" className="sr-only">
        {busy
          ? "Running the exploration over the synthetic portfolio."
          : current
            ? `Showing ${current.spec.title}.`
            : ""}
      </p>
      {linkError && (
        <p
          role="alert"
          className="border-l-2 border-red-500 pl-3 text-sm text-red-200"
        >
          {`This link could not be read, so the explorer starts from subjects screened by study. ${linkError}`}
        </p>
      )}

      <section
        aria-labelledby="explore-build"
        className="@container min-w-0 border border-white/[0.08] bg-[#0d0e11] p-4 sm:p-6"
      >
        <h2
          id="explore-build"
          className="text-xl font-semibold tracking-[-0.02em]"
        >
          Build an exploration
        </h2>
        <div className="mt-5 grid gap-6 @3xl:grid-cols-2">
          <div className="min-w-0">
            <label
              htmlFor="explore-metric"
              className="text-sm font-medium text-slate-200"
            >
              Metric
            </label>
            <select
              id="explore-metric"
              value={exploration.metricId}
              onChange={(event) =>
                onChange(switchMetric(exploration, event.target.value), "push")
              }
              className={`${control} mt-2`}
            >
              {FOLDERS.map(({ folder, metrics }) => (
                <optgroup key={folder} label={folder}>
                  {metrics.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {metric && (
              <p className="mt-2 text-sm leading-relaxed text-slate-300">
                {metric.description}
              </p>
            )}
          </div>

          <fieldset className="min-w-0">
            <legend className="text-sm font-medium text-slate-200">
              Group by
            </legend>
            {exploration.dimensions.length === 0 ? (
              <p className="mt-2 text-sm text-slate-300">
                Not grouped: one number for the whole portfolio.
              </p>
            ) : (
              <ul className="mt-2 flex flex-wrap gap-2">
                {exploration.dimensions.map((id) => (
                  <li key={id} className="min-w-0">
                    {choices.removeDimensions.includes(id) ? (
                      <button
                        type="button"
                        aria-label={`${dimensionLabel(id)}: stop grouping by it`}
                        className={button}
                        onClick={() =>
                          onChange(
                            {
                              ...exploration,
                              dimensions: exploration.dimensions.filter(
                                (other) => other !== id
                              ),
                              visual: null,
                            },
                            "replace"
                          )
                        }
                      >
                        {dimensionLabel(id)}
                        <span
                          aria-hidden="true"
                          className="ml-2 text-slate-400"
                        >
                          ×
                        </span>
                      </button>
                    ) : (
                      <span className="inline-flex min-h-11 items-center border border-white/[0.08] px-3 text-sm text-slate-300">
                        {`${dimensionLabel(id)}, kept: the metric is defined per study`}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {choices.addDimensions.length > 0 ? (
              <div className="mt-3">
                <label
                  htmlFor="explore-add-dimension"
                  className="text-sm text-slate-300"
                >
                  Add a dimension
                </label>
                <select
                  id="explore-add-dimension"
                  value=""
                  onChange={(event) =>
                    onChange(
                      {
                        ...exploration,
                        dimensions: [
                          ...exploration.dimensions,
                          event.target.value as MetricDimensionId,
                        ],
                        visual: null,
                      },
                      "replace"
                    )
                  }
                  className={`${control} mt-1`}
                >
                  <option value="" disabled>
                    Choose a dimension
                  </option>
                  {choices.addDimensions.map((id) => (
                    <option key={id} value={id}>
                      {dimensionLabel(id)}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-400">
                {exploration.dimensions.length >= EXPLORER_MAX_DIMENSIONS
                  ? `An exploration groups by at most ${EXPLORER_MAX_DIMENSIONS} dimensions.`
                  : "The metric cannot be grouped by anything else."}
              </p>
            )}
          </fieldset>
        </div>

        <fieldset className="mt-6 min-w-0">
          <legend className="text-sm font-medium text-slate-200">
            Filters
          </legend>
          <div className="mt-2 grid gap-4 @3xl:grid-cols-2">
            {exploration.filters.map((filter) => (
              <FilterEditor
                key={filter.dimension}
                filter={filter}
                values={values?.[filter.dimension] ?? null}
                onValues={(chosen) =>
                  setFilter(filter.dimension, filter.operator, chosen)
                }
                onOperator={(operator) =>
                  setFilter(filter.dimension, operator, filter.values)
                }
                onRemove={() => {
                  setPending(null);
                  onChange(
                    {
                      ...exploration,
                      filters: exploration.filters.filter(
                        (f) => f.dimension !== filter.dimension
                      ),
                    },
                    "replace"
                  );
                }}
              />
            ))}
            {open && (
              <FilterEditor
                filter={{
                  dimension: open.dimension,
                  operator: open.operator,
                  values: [],
                }}
                values={values?.[open.dimension] ?? null}
                onValues={(chosen) => {
                  setPending(null);
                  setFilter(open.dimension, open.operator, chosen);
                }}
                onOperator={(operator) =>
                  setPending({ dimension: open.dimension, operator })
                }
                onRemove={() => setPending(null)}
              />
            )}
          </div>
          {addable.length > 0 && (
            <div className="mt-3 max-w-md">
              <label
                htmlFor="explore-add-filter"
                className="text-sm text-slate-300"
              >
                Add a filter
              </label>
              <select
                id="explore-add-filter"
                value=""
                onChange={(event) =>
                  setPending({
                    dimension: event.target.value as MetricDimensionId,
                    operator: "in",
                  })
                }
                className={`${control} mt-1`}
              >
                <option value="" disabled>
                  Choose a dimension
                </option>
                {addable.map((id) => (
                  <option key={id} value={id}>
                    {dimensionLabel(id)}
                  </option>
                ))}
              </select>
            </div>
          )}
          {current && current.defaultFilters.length > 0 && (
            <p className="mt-3 text-sm text-slate-300">
              {`Always applied, from the metric's definition: ${inWords(
                current.defaultFilters.map(filterText)
              )}.`}
            </p>
          )}
          {current && current.replacedDefaults.length > 0 && (
            <p className="mt-2 text-sm text-amber-200">
              {`Your filters replace the metric's default: ${inWords(
                current.replacedDefaults.map(filterText)
              )}.`}
            </p>
          )}
        </fieldset>

        <fieldset className="mt-6 min-w-0">
          <legend className="text-sm font-medium text-slate-200">Visual</legend>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
            {choices.visuals.map((option) => (
              <label
                key={option}
                className="inline-flex min-h-11 items-center gap-2 text-sm text-slate-200"
              >
                <input
                  type="radio"
                  name="explore-visual"
                  checked={visual === option}
                  onChange={() =>
                    onChange(
                      {
                        ...exploration,
                        visual: option === suggested ? null : option,
                      },
                      "replace"
                    )
                  }
                  className="accent-amber-400"
                />
                {VISUAL_LABEL[option]}
                {option === suggested && (
                  <span className="text-xs text-slate-400">(suggested)</span>
                )}
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      {error && (
        <p
          role="alert"
          className="border-l-2 border-red-500 pl-3 text-sm text-red-200"
        >
          {`The exploration could not run: ${error}`}
        </p>
      )}

      {result === null ? (
        !error && (
          <div
            aria-hidden="true"
            className="space-y-4"
            data-testid="explore-loading"
          >
            <div className="min-h-6 w-1/3 animate-pulse bg-white/[0.06]" />
            <div className="min-h-64 animate-pulse bg-white/[0.04]" />
          </div>
        )
      ) : (
        <div
          aria-busy={busy}
          className={`space-y-8 transition-opacity motion-reduce:transition-none ${busy ? "opacity-60" : ""}`}
        >
          <ReportView report={result.report} />
          <section
            aria-label="Share and download"
            className="flex min-w-0 flex-wrap items-center gap-3"
          >
            <button
              type="button"
              className={button}
              onClick={() => {
                copyToClipboard(
                  `${getActiveHostUrl()}/platform/explore#${hash}`
                ).then(
                  () => setCopied("done"),
                  () => setCopied("failed")
                );
              }}
            >
              Copy a link to this exploration
            </button>
            <button
              type="button"
              className={button}
              onClick={() =>
                download(`${result.spec.id}.csv`, explorationCsv(result.report))
              }
            >
              Download the data as CSV
            </button>
            <p role="status" className="text-sm text-slate-300">
              {copied === "done"
                ? "Link copied."
                : copied === "failed"
                  ? "The link could not be copied; copy it from the address bar."
                  : ""}
            </p>
          </section>
          <Promotion steps={promotionSteps(result.spec)} />
        </div>
      )}
    </div>
  );
}
