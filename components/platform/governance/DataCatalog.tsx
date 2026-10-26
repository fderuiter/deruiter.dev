"use client";

import { useEffect, useId, useMemo, useState } from "react";
import {
  GOVERNANCE_DOMAINS,
  dataCatalogFacets,
  searchDataCatalog,
  type CatalogFacetCount,
  type DataCatalogEntry,
  type DataCatalogFacets,
  type DataCatalogMetric,
  type DataCatalogProduct,
  type DataCatalogQuery,
  type GovernanceDomainId,
} from "@/lib/clinical-platform";
import {
  CLASSIFICATION_LABEL,
  KIND_LABEL,
  LAYER_LABEL,
  METRIC_STATUS_LABEL,
  SLA_LABEL,
  catalogAnchor,
  dqProductAnchor,
  glossaryAnchor,
  percent,
} from "./labels";

type FacetKey = Exclude<keyof DataCatalogQuery, "text">;

const DOMAIN_LABEL = Object.fromEntries(
  GOVERNANCE_DOMAINS.map((d) => [d.id, d.name])
) as Readonly<Record<GovernanceDomainId, string>>;

/** Looks up a facet value's words. */
const words =
  (labels: Readonly<Record<string, string>>) =>
  (value: string): string =>
    labels[value] ?? value;

/** Each facet, its legend and the words for its values, in the order the filters show. */
const FACETS: readonly {
  key: FacetKey;
  legend: string;
  label: (value: string) => string;
}[] = [
  { key: "kinds", legend: "Kind", label: words(KIND_LABEL) },
  {
    key: "stewardshipDomains",
    legend: "Stewardship domain",
    label: words(DOMAIN_LABEL),
  },
  { key: "layers", legend: "Layer", label: words(LAYER_LABEL) },
  {
    key: "classifications",
    legend: "Classification",
    label: words(CLASSIFICATION_LABEL),
  },
  {
    key: "slaStatuses",
    legend: "Contract at the last check",
    label: words(SLA_LABEL),
  },
  {
    key: "metricStatuses",
    legend: "Metric status",
    label: words(METRIC_STATUS_LABEL),
  },
];

type Selection = Readonly<Partial<Record<FacetKey, readonly string[]>>>;

const linkClass =
  "text-amber-300 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-amber-400";

/**
 * The values of a facet worth offering as filters: those some entry takes.
 * A facet with fewer than two such values filters nothing, so it is left
 * out rather than shown as a single box.
 */
function offeredValues(counts: readonly CatalogFacetCount<string>[]): string[] {
  const held = counts.filter((c) => c.count > 0).map((c) => c.value);
  return held.length < 2 ? [] : held;
}

function Fact({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-slate-400">{term}</dt>
      <dd className="break-words text-slate-200">{children}</dd>
    </div>
  );
}

function EntryLink({
  id,
  names,
}: {
  id: string;
  names: ReadonlyMap<string, string>;
}) {
  const name = names.get(id);
  if (name === undefined) {
    return <span className="break-all font-mono">{id}</span>;
  }
  return (
    <a href={`#${catalogAnchor(id)}`} className={linkClass}>
      {name}
    </a>
  );
}

function LinkList({
  ids,
  names,
  none,
}: {
  ids: readonly string[];
  names: ReadonlyMap<string, string>;
  none: string;
}) {
  if (ids.length === 0) return <>{none}</>;
  return (
    <ul className="space-y-1">
      {ids.map((id) => (
        <li key={id} className="min-w-0">
          <EntryLink id={id} names={names} />
        </li>
      ))}
    </ul>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="border border-white/[0.12] px-2 py-0.5 font-mono text-[11px] uppercase tracking-[0.08em] text-slate-300">
      {children}
    </span>
  );
}

function ProductCard({
  entry,
  names,
}: {
  entry: DataCatalogProduct;
  names: ReadonlyMap<string, string>;
}) {
  const quality =
    entry.dqScore === null
      ? "No quality rule checks it yet"
      : `${percent(entry.dqScore)} mean pass rate over ${entry.dqRules} ${entry.dqRules === 1 ? "rule" : "rules"}`;
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{LAYER_LABEL[entry.layer]}</Badge>
        <Badge>{CLASSIFICATION_LABEL[entry.classification]}</Badge>
        {entry.personalHealthData && <Badge>Personal health data</Badge>}
      </div>
      <p className="mt-3 text-sm leading-relaxed text-slate-300">
        {entry.description}
      </p>
      <dl className="mt-3 grid gap-x-4 gap-y-2 text-xs @sm:grid-cols-2">
        <Fact term="Owner">{entry.owner}</Fact>
        <Fact term="Steward">{entry.steward}</Fact>
        <Fact term="Stewardship domain">
          {DOMAIN_LABEL[entry.stewardshipDomain]}
        </Fact>
        <Fact term="Contract">
          <span className={entry.slaStatus === "met" ? "text-emerald-300" : ""}>
            {entry.slaStatus === "met"
              ? "✓ "
              : entry.slaStatus === "missed"
                ? "✕ "
                : ""}
            {SLA_LABEL[entry.slaStatus]}
          </span>
        </Fact>
        <Fact term="Data quality">
          {entry.dqScore === null ? (
            quality
          ) : (
            <a href={`#${dqProductAnchor(entry.id)}`} className={linkClass}>
              {quality}
            </a>
          )}
        </Fact>
        <Fact term="Source">{entry.sourceDomain}</Fact>
      </dl>
      {entry.slaFindings.length > 0 && (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-amber-200">
          {entry.slaFindings.map((finding) => (
            <li key={finding}>{finding}</li>
          ))}
        </ul>
      )}
      <details className="mt-3 border-t border-white/[0.08] pt-2 text-xs">
        <summary className="flex min-h-12 cursor-pointer items-center text-slate-200 focus-visible:outline-2 focus-visible:outline-amber-400">
          Contract, retention and lineage
        </summary>
        <dl className="mt-2 grid gap-x-4 gap-y-2 @sm:grid-cols-2">
          <Fact term="Contract version">
            <span className="break-all font-mono">{entry.contractId}</span>{" "}
            {entry.contractVersion}
          </Fact>
          <Fact term="Service levels">
            Latest load at most {entry.sla.freshnessHours} hours old,{" "}
            {percent(entry.sla.completeness)} of required values present,{" "}
            {percent(entry.sla.availability)} available
          </Fact>
          <Fact term="Retention">
            {entry.retention.years} years. {entry.retention.basis}
          </Fact>
          <Fact term="Lineage datasets">
            {entry.lineageDatasets.length === 0
              ? "None yet"
              : entry.lineageDatasets.join(", ")}
          </Fact>
          <Fact term="Reads from">
            <LinkList ids={entry.upstream} names={names} none="Nothing" />
          </Fact>
          <Fact term="Read by">
            <LinkList
              ids={entry.consumers.map((c) => c.id)}
              names={names}
              none="Nothing yet"
            />
          </Fact>
        </dl>
      </details>
    </>
  );
}

function MetricCard({
  entry,
  names,
  reportTitles,
}: {
  entry: DataCatalogMetric;
  names: ReadonlyMap<string, string>;
  reportTitles: Readonly<Record<string, string>>;
}) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Badge>Metric</Badge>
        <Badge>{METRIC_STATUS_LABEL[entry.status]}</Badge>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-slate-300">
        {entry.description}
      </p>
      <dl className="mt-3 grid gap-x-4 gap-y-2 text-xs @sm:grid-cols-2">
        <Fact term="Owner">{entry.owner}</Fact>
        <Fact term="Steward">{entry.steward}</Fact>
        <Fact term="Stewardship domain">
          {DOMAIN_LABEL[entry.stewardshipDomain]}
        </Fact>
        <Fact term="Glossary term">
          {entry.glossaryTerm === null ? (
            "None"
          ) : (
            <a
              href={`#${glossaryAnchor(entry.glossaryTerm.key)}`}
              className={linkClass}
            >
              {entry.glossaryTerm.term}
            </a>
          )}
        </Fact>
        <Fact term="Unit">{entry.unit}</Fact>
        <Fact term="Version">{entry.version}</Fact>
      </dl>
      <details className="mt-3 border-t border-white/[0.08] pt-2 text-xs">
        <summary className="flex min-h-12 cursor-pointer items-center text-slate-200 focus-visible:outline-2 focus-visible:outline-amber-400">
          Sources, reports and lineage
        </summary>
        <dl className="mt-2 grid gap-x-4 gap-y-2 @sm:grid-cols-2">
          <Fact term="Reads from">
            <LinkList ids={entry.sources} names={names} none="Nothing" />
          </Fact>
          <Fact term="Shown in">
            {entry.reports.length === 0 ? (
              "No report yet"
            ) : (
              <ul className="space-y-1">
                {entry.reports.map((id) => (
                  <li key={id}>{reportTitles[id] ?? id}</li>
                ))}
              </ul>
            )}
          </Fact>
          <Fact term="Lineage node">
            {entry.lineageNode === null ? (
              "None yet"
            ) : (
              <span className="break-all font-mono">{entry.lineageNode}</span>
            )}
          </Fact>
        </dl>
      </details>
    </>
  );
}

/**
 * The searchable data catalog: every data product and governed metric,
 * filtered by words and by the facets the catalog holds more than one
 * value of. A link to an entry the filters hide clears them first, so it
 * always lands.
 *
 * @param entries - Entries from `dataCatalog`.
 * @param reportTitles - Each report's title by id, for the reports a metric is shown in.
 */
export function DataCatalog({
  entries,
  reportTitles,
}: {
  entries: readonly DataCatalogEntry[];
  reportTitles: Readonly<Record<string, string>>;
}) {
  const searchId = useId();
  const resultsId = useId();
  const [text, setText] = useState("");
  const [selection, setSelection] = useState<Selection>({});
  const [reveal, setReveal] = useState<string | null>(null);

  const names = useMemo(
    () => new Map(entries.map((e) => [e.id, e.name])),
    [entries]
  );
  const offered = useMemo(() => {
    const all: DataCatalogFacets = dataCatalogFacets(entries);
    return Object.fromEntries(
      FACETS.map((f) => [f.key, offeredValues(all[f.key])])
    ) as Readonly<Record<FacetKey, string[]>>;
  }, [entries]);
  const counts = useMemo(
    () => dataCatalogFacets(searchDataCatalog(entries, { text })),
    [entries, text]
  );
  const shown = useMemo(
    () =>
      searchDataCatalog(entries, {
        text,
        ...(selection as DataCatalogQuery),
      }),
    [entries, text, selection]
  );
  const filtered =
    text.trim() !== "" || Object.values(selection).some((v) => v.length > 0);

  const toggle = (key: FacetKey, value: string) => {
    const current = selection[key] ?? [];
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : offered[key].filter((v) => v === value || current.includes(v));
    setSelection({ ...selection, [key]: next });
  };
  const clear = () => {
    setText("");
    setSelection({});
  };

  // A link to an entry the filters hide clears them, then scrolls to it.
  useEffect(() => {
    const onHash = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!id.startsWith("catalog-")) return;
      if (document.getElementById(id) !== null) return;
      setText("");
      setSelection({});
      setReveal(id);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  useEffect(() => {
    if (reveal === null) return;
    const target = document.getElementById(reveal);
    target?.scrollIntoView({ block: "start" });
    target?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReveal(null);
  }, [reveal, shown]);

  return (
    <div className="@container min-w-0">
      <form
        role="search"
        aria-label="Data catalog"
        className="border-b border-white/[0.08] pb-4"
        onSubmit={(event) => event.preventDefault()}
      >
        <label htmlFor={searchId} className="block text-xs text-slate-400">
          Search the catalog
        </label>
        <input
          id={searchId}
          type="search"
          value={text}
          onChange={(event) => setText(event.target.value)}
          aria-controls={resultsId}
          className="mt-1 min-h-12 w-full border border-white/[0.12] bg-[#13151a] px-3 py-2 text-sm text-[#f4f4f6] placeholder:text-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          placeholder="Name, owner, steward or term"
        />
        <div className="mt-4 grid gap-4 @2xl:grid-cols-2 @5xl:grid-cols-4">
          {FACETS.filter((f) => offered[f.key].length > 0).map((facet) => (
            <fieldset key={facet.key} className="min-w-0">
              <legend className="text-xs text-slate-400">{facet.legend}</legend>
              {/* The values wrap in rows, so on a phone the filters take
                  a few rows instead of a screen of one checkbox per line. */}
              <div className="mt-1 flex flex-wrap gap-x-5">
                {offered[facet.key].map((value) => {
                  const count =
                    counts[facet.key].find((c) => c.value === value)?.count ??
                    0;
                  return (
                    <label
                      key={value}
                      className="flex min-h-12 items-center gap-2 text-sm text-slate-200"
                    >
                      <input
                        type="checkbox"
                        checked={(selection[facet.key] ?? []).includes(value)}
                        onChange={() => toggle(facet.key, value)}
                        aria-controls={resultsId}
                        className="h-4 w-4 accent-amber-500"
                      />
                      <span className="min-w-0">
                        {facet.label(value)}{" "}
                        <span className="font-mono text-xs tabular-nums text-slate-400">
                          ({count})
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </div>
      </form>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="text-xs text-slate-400" aria-live="polite">
          {shown.length === entries.length
            ? `${entries.length} entries`
            : `${shown.length} of ${entries.length} entries`}
        </p>
        {filtered && (
          <button
            type="button"
            onClick={clear}
            className="min-h-12 border border-white/[0.12] bg-[#13151a] px-3 text-sm text-slate-100 hover:border-amber-400/60 focus-visible:outline-2 focus-visible:outline-amber-400 active:scale-[0.98]"
          >
            Clear the search and filters
          </button>
        )}
      </div>

      <ul id={resultsId} className="mt-3 grid gap-3 @3xl:grid-cols-2">
        {shown.map((entry) => (
          <li
            key={entry.id}
            id={catalogAnchor(entry.id)}
            tabIndex={-1}
            className="min-w-0 scroll-mt-24 border border-white/[0.08] bg-[#13151a] p-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            <h3 className="min-w-0 break-words text-base font-semibold text-[#f4f4f6]">
              {entry.name}
            </h3>
            <p className="mt-1 break-all font-mono text-xs text-slate-400">
              {entry.id}
            </p>
            <div className="mt-3">
              {entry.kind === "product" ? (
                <ProductCard entry={entry} names={names} />
              ) : (
                <MetricCard
                  entry={entry}
                  names={names}
                  reportTitles={reportTitles}
                />
              )}
            </div>
          </li>
        ))}
      </ul>
      {shown.length === 0 && (
        <p className="mt-3 text-sm text-slate-400">
          Nothing in the catalog matches. Clear a filter or try other words.
        </p>
      )}
    </div>
  );
}
