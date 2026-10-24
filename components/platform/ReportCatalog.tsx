"use client";

import { useId, useMemo, useState } from "react";
import {
  searchReportCatalog,
  type ReportCatalogEntry,
  type ReportTier,
} from "@/lib/clinical-platform";
import { REPORT_TIERS, ReportTierBadge } from "./ReportTierBadge";

const TIERS: readonly ReportTier[] = ["certified", "managed", "exploratory"];

const VISUAL_LABEL = {
  bar: "Bar chart",
  line: "Line chart",
  stat: "Headline numbers",
  table: "Table",
} as const;

/**
 * The searchable report catalog: every report with its tier, audience,
 * owner, last refresh and usage, filtered by words, tier and audience.
 *
 * @param entries - Catalog entries, from `reportCatalog`.
 * @param hrefBase - When the page shows the reports, the start of each
 *   report's link, followed by its id: `#` for anchors on the same page, or
 *   a path such as `/platform/operations/`. A string, not a function, so a
 *   server page can pass it.
 */
export function ReportCatalog({
  entries,
  hrefBase,
}: {
  entries: readonly ReportCatalogEntry[];
  hrefBase?: string;
}) {
  const searchId = useId();
  const audienceId = useId();
  const resultsId = useId();
  const [text, setText] = useState("");
  const [tiers, setTiers] = useState<readonly ReportTier[]>([]);
  const [audience, setAudience] = useState("");
  const audiences = useMemo(
    () => [...new Set(entries.map((entry) => entry.audience))].sort(),
    [entries]
  );
  const shown = useMemo(
    () =>
      searchReportCatalog(entries, {
        text,
        tiers,
        ...(audience === "" ? {} : { audience }),
      }),
    [entries, text, tiers, audience]
  );
  const toggleTier = (tier: ReportTier) =>
    setTiers((current) =>
      current.includes(tier)
        ? current.filter((item) => item !== tier)
        : TIERS.filter((item) => item === tier || current.includes(item))
    );

  return (
    <section aria-label="Report catalog" className="@container min-w-0">
      <form
        role="search"
        className="flex flex-wrap items-end gap-4 border-b border-white/[0.08] pb-4"
        onSubmit={(event) => event.preventDefault()}
      >
        <div className="min-w-0 grow basis-56">
          <label htmlFor={searchId} className="block text-xs text-slate-400">
            Search reports
          </label>
          <input
            id={searchId}
            type="search"
            value={text}
            onChange={(event) => setText(event.target.value)}
            aria-controls={resultsId}
            className="mt-1 w-full border border-white/[0.12] bg-[#13151a] px-3 py-2 text-sm text-[#f4f4f6] placeholder:text-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            placeholder="Title, metric, owner"
          />
        </div>
        <fieldset className="min-w-0">
          <legend className="text-xs text-slate-400">Tier</legend>
          <div className="mt-1 flex flex-wrap gap-3">
            {TIERS.map((tier) => (
              <label
                key={tier}
                className="flex min-h-11 items-center gap-2 text-sm text-slate-200"
              >
                <input
                  type="checkbox"
                  checked={tiers.includes(tier)}
                  onChange={() => toggleTier(tier)}
                  className="h-4 w-4 accent-amber-500"
                />
                {REPORT_TIERS[tier].label}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="min-w-0">
          <label htmlFor={audienceId} className="block text-xs text-slate-400">
            Audience
          </label>
          <select
            id={audienceId}
            value={audience}
            onChange={(event) => setAudience(event.target.value)}
            className="mt-1 min-h-11 border border-white/[0.12] bg-[#13151a] px-3 py-2 text-sm text-[#f4f4f6] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            <option value="">Every audience</option>
            {audiences.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
      </form>

      <p className="mt-4 text-xs text-slate-400" aria-live="polite">
        {shown.length === entries.length
          ? `${entries.length} reports`
          : `${shown.length} of ${entries.length} reports`}
      </p>

      <ul id={resultsId} className="mt-3 grid gap-3 @3xl:grid-cols-2">
        {shown.map((entry) => (
          <li
            key={entry.id}
            className="min-w-0 border border-white/[0.08] bg-[#13151a] p-4"
          >
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="min-w-0 break-words text-base font-semibold text-[#f4f4f6]">
                {hrefBase !== undefined ? (
                  <a
                    href={`${hrefBase}${entry.id}`}
                    className="underline decoration-white/30 underline-offset-4 hover:decoration-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                  >
                    {entry.title}
                  </a>
                ) : (
                  entry.title
                )}
              </h3>
              <ReportTierBadge tier={entry.tier} />
            </div>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              {entry.purpose}
            </p>
            <dl className="mt-3 grid gap-x-4 gap-y-1 font-mono text-xs text-slate-400 @sm:grid-cols-2">
              <div className="min-w-0">
                <dt className="inline text-slate-500">Audience: </dt>
                <dd className="inline text-slate-200">{entry.audience}</dd>
              </div>
              <div className="min-w-0">
                <dt className="inline text-slate-500">Owner: </dt>
                <dd className="inline text-slate-200">{entry.owner}</dd>
              </div>
              <div className="min-w-0">
                <dt className="inline text-slate-500">Last refresh: </dt>
                <dd className="inline text-slate-200">
                  {entry.lastRefresh ?? "Not refreshed yet"}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="inline text-slate-500">Views: </dt>
                <dd className="inline text-slate-200">
                  {entry.views === null ? "Not recorded" : entry.views}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="inline text-slate-500">Shown as: </dt>
                <dd className="inline text-slate-200">
                  {VISUAL_LABEL[entry.visual]}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="inline text-slate-500">Version: </dt>
                <dd className="inline text-slate-200">{entry.version}</dd>
              </div>
            </dl>
            <p className="mt-3 break-words text-xs text-slate-400">
              <span className="text-slate-500">Metrics: </span>
              {entry.metricNames.join(", ")}
            </p>
          </li>
        ))}
      </ul>
      {shown.length === 0 && (
        <p className="mt-3 text-sm text-slate-400">
          No report matches. Clear a filter or try other words.
        </p>
      )}
    </section>
  );
}
