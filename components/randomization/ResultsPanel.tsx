"use client";

import { useEffect, useState } from "react";
import {
  RANDOMIZATION_CONTRACT_VERSION,
  RANDOMIZATION_DISCLOSURE_POLICY_VERSION,
  RANDOMIZATION_PLAN_SCHEMA_VERSION,
  type AllocationCategoryFilter,
  type AllocationColumnFilters,
  type AllocationSort,
  type RandomizationRequest,
  type ResolvedPresentation,
} from "@/lib/randomization";
import { copyToClipboard } from "@/lib/clipboard";
import { useAnnouncer } from "@/components/providers/A11yProvider";
import {
  AllocationTable,
  BlockGroupTable,
  ColumnFilters,
  RESULT_PAGE_SIZE,
} from "./AllocationTable";
import { BalancePanel } from "./BalancePanel";
import { CategoryCharts } from "./CategoryCharts";
import type { RandomizationClient } from "./randomization-client";
import type {
  RandomizationGenerationSummary,
  RandomizationViewResult,
} from "./protocol";
import { BUTTON, MONO } from "./RandomizationStageEditors";

type ResultView = "rows" | "blocks" | "balance";

interface ViewState {
  readonly view: ResultView;
  readonly filters: AllocationColumnFilters;
  readonly sort: AllocationSort | null;
  readonly category: AllocationCategoryFilter | null;
  readonly offset: number;
}

const INITIAL_VIEW: ViewState = {
  view: "rows",
  filters: {},
  sort: null,
  category: null,
  offset: 0,
};

const VIEWS: readonly { readonly id: ResultView; readonly label: string }[] = [
  { id: "rows", label: "Allocations" },
  { id: "blocks", label: "Grouped" },
  { id: "balance", label: "Balance" },
];

/** A view answer tagged with the request it answers. */
interface Answer<T> {
  readonly key: string;
  readonly value: T | null;
}

function shortDigest(hex: string): string {
  return hex.length > 16 ? `${hex.slice(0, 8)}…${hex.slice(-8)}` : hex;
}

/**
 * Inspects one completed, immutable schedule (#4008): the flat and
 * grouped allocation views, categorical counts that cross-filter the
 * grid, and the descriptive balance report. Every view is a bounded
 * projection answered by the worker that holds the rows, so the page
 * never renders a row per allocation. Filters change what is shown, never
 * the schedule or its export. Answers carry the request they belong to,
 * and an answer to a replaced request is dropped.
 */
export function ResultsPanel({
  client,
  summary,
  request,
  presentation,
  protocolId,
  stale,
}: {
  readonly client: RandomizationClient;
  readonly summary: RandomizationGenerationSummary;
  /** The frozen request the schedule was generated from. */
  readonly request: RandomizationRequest;
  readonly presentation: ResolvedPresentation;
  readonly protocolId: string;
  readonly stale: boolean;
}) {
  const { announce } = useAnnouncer();
  const [ui, setUi] = useState<ViewState>(INITIAL_VIEW);
  const [list, setList] = useState<Answer<RandomizationViewResult> | null>(
    null
  );
  const [counts, setCounts] = useState<Answer<RandomizationViewResult> | null>(
    null
  );
  const [copy, setCopy] = useState<"idle" | "copied" | "failed">("idle");
  const mask = presentation.maskTreatment;

  const listKey = JSON.stringify([ui, mask]);
  const countsKey = JSON.stringify([ui.filters, ui.category, mask]);

  useEffect(() => {
    if (ui.view === "balance") return;
    let live = true;
    const key = JSON.stringify([ui, mask]);
    const query = { sort: ui.sort, filters: ui.filters, category: ui.category };
    void client
      .view({
        kind: ui.view,
        query,
        offset: ui.offset,
        limit: RESULT_PAGE_SIZE,
        maskTreatment: mask,
      })
      .then(
        (value) => {
          if (live) setList({ key, value });
        },
        () => {
          if (live) setList({ key, value: null });
        }
      );
    return () => {
      live = false;
    };
  }, [client, ui, mask]);

  useEffect(() => {
    let live = true;
    const key = JSON.stringify([ui.filters, ui.category, mask]);
    void client
      .view({
        kind: "summary",
        query: { filters: ui.filters, category: ui.category },
        maskTreatment: mask,
      })
      .then(
        (value) => {
          if (live) setCounts({ key, value });
        },
        () => {
          if (live) setCounts({ key, value: null });
        }
      );
    return () => {
      live = false;
    };
  }, [client, ui.filters, ui.category, mask]);

  const listBusy = list?.key !== listKey;
  const countsBusy = counts?.key !== countsKey;
  const listValue = list?.value ?? null;
  const projection =
    counts?.value?.kind === "summary" ? counts.value.summary : null;

  const update = (patch: Partial<ViewState>) =>
    setUi((current) => ({ ...current, offset: 0, ...patch }));

  const copyDigest = () => {
    void copyToClipboard(summary.contentDigest).then(
      () => {
        setCopy("copied");
        announce("Copied the full 64-character content digest.");
      },
      () => {
        setCopy("failed");
        announce(
          "Couldn't copy the digest. Select it in the details instead.",
          "assertive"
        );
      }
    );
  };

  const exhausted = summary.shortfall > 0;
  const status = stale
    ? "Stale: the plan changed after this run"
    : exhausted
      ? `Stopped ${summary.shortfall} short of the target because capacity ran out`
      : "Complete";

  return (
    <div className="space-y-4">
      <dl className="grid min-w-0 gap-x-4 gap-y-1 text-sm @container @md:grid-cols-2">
        <div className="min-w-0">
          <dt className="inline text-slate-400">Status: </dt>
          <dd className="inline">{status}</dd>
        </div>
        <div className="min-w-0">
          <dt className="inline text-slate-400">Protocol: </dt>
          <dd className="inline">{protocolId || "not stated"}</dd>
        </div>
        <div className="min-w-0">
          <dt className="inline text-slate-400">Method: </dt>
          <dd className={`${MONO} inline break-all`}>
            {request.method} ({request.algorithmId})
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="inline text-slate-400">Versions: </dt>
          <dd className={`${MONO} inline`}>
            contract {RANDOMIZATION_CONTRACT_VERSION}, plan{" "}
            {RANDOMIZATION_PLAN_SCHEMA_VERSION}, disclosure{" "}
            {RANDOMIZATION_DISCLOSURE_POLICY_VERSION}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="inline text-slate-400">Reduced ratio: </dt>
          <dd className={`${MONO} inline`}>
            {summary.reducedRatios.join(":")}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="inline text-slate-400">Seed: </dt>
          <dd className={`${MONO} inline break-all`}>
            {mask
              ? "hidden while treatment is masked"
              : `${request.seed.value} (${request.seed.source})`}
          </dd>
        </div>
        <div className="min-w-0 @md:col-span-2">
          <dt className="inline text-slate-400">Content digest: </dt>
          <dd className="inline">
            <span
              className={MONO}
              title={summary.contentDigest}
              data-digest={summary.contentDigest}
            >
              <span aria-hidden="true">
                {shortDigest(summary.contentDigest)}
              </span>
              <span className="sr-only">{summary.contentDigest}</span>
            </span>{" "}
            <button
              type="button"
              className={`${BUTTON} min-w-12`}
              onClick={copyDigest}
            >
              Copy digest
            </button>{" "}
            <span role="status" className="text-xs text-slate-400">
              {copy === "copied"
                ? "Copied the full digest."
                : copy === "failed"
                  ? "Couldn't copy. Select the digest below."
                  : ""}
            </span>
          </dd>
        </div>
      </dl>
      {copy === "failed" && (
        <p className={`${MONO} break-all text-xs text-slate-300`}>
          {summary.contentDigest}
        </p>
      )}

      <div
        role="group"
        aria-label="Result view"
        className="flex flex-wrap gap-2"
      >
        {VIEWS.map((view) => (
          <button
            key={view.id}
            type="button"
            aria-pressed={ui.view === view.id}
            className={`${BUTTON} min-w-12 ${ui.view === view.id ? "!border-amber-500/70 !bg-amber-500/15" : ""}`}
            onClick={() => update({ view: view.id })}
          >
            {view.label}
          </button>
        ))}
      </div>

      {ui.view !== "balance" && (
        <>
          <ColumnFilters
            request={request}
            filters={ui.filters}
            masked={mask}
            onChange={(filters) => update({ filters })}
          />
          {projection && (
            <div aria-busy={countsBusy} className="space-y-2">
              <p className="text-sm text-slate-300" role="status">
                {projection.matchingRows} of {projection.totalRows} rows match.
                {ui.category
                  ? " Press the selected count again to clear it."
                  : ""}
              </p>
              <CategoryCharts
                categories={projection.categories}
                active={ui.category}
                onSelect={(category) => update({ category })}
              />
            </div>
          )}
        </>
      )}

      {ui.view === "rows" && listValue?.kind === "rows" && (
        <AllocationTable
          request={request}
          page={listValue.page}
          presentation={presentation}
          sort={ui.sort}
          busy={listBusy}
          onSort={(sort) => update({ sort })}
          onOffset={(offset) => setUi((current) => ({ ...current, offset }))}
        />
      )}
      {ui.view === "blocks" && listValue?.kind === "blocks" && (
        <BlockGroupTable
          request={request}
          page={listValue.page}
          masked={mask}
          busy={listBusy}
          onOffset={(offset) => setUi((current) => ({ ...current, offset }))}
        />
      )}
      {ui.view !== "balance" && !listBusy && list?.value === null && (
        <p role="alert" className="text-sm text-amber-100">
          These rows are no longer available. Run again to see them.
        </p>
      )}
      {ui.view === "balance" && projection && (
        <BalancePanel report={projection.balance} request={request} />
      )}
    </div>
  );
}
