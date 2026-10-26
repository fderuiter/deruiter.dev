"use client";

import type {
  PortfolioRiskCell,
  PortfolioRiskDimension,
  PortfolioRiskHeatmap,
  PortfolioRiskRating,
  PortfolioRiskRow,
} from "@/lib/clinical-platform";
import { forecastAnchor } from "./EnrollmentForecast";

/**
 * Rating marks. The colours are the site's semantic status tokens, kept for
 * status alone; each rating also has its own glyph and word, so the
 * heatmap reads without colour.
 */
const RATING: Readonly<
  Record<
    PortfolioRiskRating,
    {
      readonly label: string;
      readonly glyph: string;
      readonly cell: string;
    }
  >
> = {
  green: {
    label: "On track",
    glyph: "●",
    cell: "border-emerald-500/40 bg-emerald-500/10 text-emerald-100",
  },
  amber: {
    label: "Watch",
    glyph: "◆",
    cell: "border-amber-500/50 bg-amber-500/10 text-amber-100",
  },
  red: {
    label: "At risk",
    glyph: "▲",
    cell: "border-red-400/50 bg-red-500/10 text-red-100",
  },
};

const COLUMNS: readonly PortfolioRiskDimension[] = [
  "schedule",
  "budget",
  "quality",
];

/** Where the evidence behind a cell is, and what it is called. */
function evidence(
  row: PortfolioRiskRow,
  dimension: PortfolioRiskDimension
): { readonly href: string; readonly text: string } {
  if (dimension === "schedule") {
    return row.enrolling
      ? {
          href: `#${forecastAnchor(row.studyId)}`,
          text: "the enrollment forecast",
        }
      : { href: "#portfolio-milestones", text: "the milestones" };
  }
  if (dimension === "budget") {
    return { href: "#portfolio-finance", text: "budget at completion" };
  }
  // The same address the operations dashboard gives its Risk tab.
  const hash = new URLSearchParams({ study: row.studyId, view: "risk" });
  return {
    href: `/platform/operations#${hash.toString()}`,
    text: "the risk assessment",
  };
}

function Mark({ rating }: { rating: PortfolioRiskRating }) {
  return (
    <span aria-hidden="true" className="font-mono">
      {RATING[rating].glyph}
    </span>
  );
}

function Cell({
  row,
  cell,
  name,
}: {
  row: PortfolioRiskRow;
  cell: PortfolioRiskCell;
  name: string;
}) {
  const { href, text } = evidence(row, cell.dimension);
  return (
    <td className="p-0.5 @min-[26rem]:p-1">
      <a
        href={href}
        title={cell.reason}
        className={`flex min-h-11 flex-col items-center justify-center gap-0.5 border px-1 py-1.5 text-center text-xs underline-offset-4 @min-[26rem]:flex-row @min-[26rem]:justify-start @min-[26rem]:gap-1.5 @min-[26rem]:px-2 @min-[26rem]:text-left hover:underline focus-visible:outline-2 focus-visible:outline-amber-400 active:scale-[0.98] ${RATING[cell.rating].cell}`}
      >
        <Mark rating={cell.rating} />
        <span>{RATING[cell.rating].label}</span>
        <span className="sr-only">{`, ${row.studyId} ${name.toLowerCase()}: ${cell.reason} See ${text}.`}</span>
      </a>
    </td>
  );
}

/**
 * Every study rated on schedule, budget and quality. Each cell names its
 * rating in words and with a glyph, and links to the evidence: the
 * forecast or milestones, budget at completion, or the study's Risk tab on
 * /platform/operations. The cells that need attention follow with their
 * reasons, then each column's rule.
 *
 * @param heatmap - The dashboard's risk heatmap.
 */
export function RiskHeatmap({ heatmap }: { heatmap: PortfolioRiskHeatmap }) {
  const names = Object.fromEntries(
    heatmap.rules.map((rule) => [rule.dimension, rule.name])
  ) as Record<PortfolioRiskDimension, string>;
  const attention = heatmap.rows.flatMap((row) =>
    COLUMNS.map((dimension) => ({ row, cell: row[dimension] })).filter(
      ({ cell }) => cell.rating !== "green"
    )
  );
  // Most severe first, then in study and column order.
  attention.sort(
    (a, b) => Number(b.cell.rating === "red") - Number(a.cell.rating === "red")
  );
  return (
    <section
      aria-labelledby="portfolio-risk"
      className="@container min-w-0 border border-white/[0.08] bg-[#0d0e11] p-4 sm:p-6"
    >
      <h2
        id="portfolio-risk"
        className="text-xl font-semibold tracking-[-0.02em]"
      >
        Risk across the portfolio
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-300">
        Every study rated on schedule, budget and quality by the rules below.
        Each rating links to the evidence behind it.
      </p>
      <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-300">
        {(["green", "amber", "red"] as const).map((rating) => (
          <li key={rating} className="flex items-center gap-1.5">
            <span
              className={`inline-flex min-w-6 items-center justify-center border px-1 ${RATING[rating].cell}`}
            >
              <Mark rating={rating} />
            </span>
            {`${RATING[rating].label} (${rating})`}
          </li>
        ))}
      </ul>
      <div
        className="mt-4 overflow-x-auto"
        tabIndex={0}
        role="region"
        aria-label="Risk heatmap"
      >
        <table className="w-full border-collapse text-left text-xs">
          <caption className="sr-only">
            Schedule, budget and quality rating of every study
          </caption>
          <thead>
            <tr>
              <th
                scope="col"
                className="py-2 pr-1 font-medium text-slate-300 @min-[26rem]:px-2"
              >
                Study
              </th>
              {COLUMNS.map((dimension) => (
                <th
                  key={dimension}
                  scope="col"
                  className="px-1 py-2 font-medium text-slate-300 @min-[26rem]:px-2"
                >
                  {names[dimension]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {heatmap.rows.map((row) => (
              <tr key={row.studyId}>
                <th
                  scope="row"
                  className="whitespace-nowrap py-1 pr-1 text-left font-mono font-normal text-slate-100 @min-[26rem]:px-2"
                >
                  {row.studyId}
                </th>
                {COLUMNS.map((dimension) => (
                  <Cell
                    key={dimension}
                    row={row}
                    cell={row[dimension]}
                    name={names[dimension]}
                  />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="mt-6 text-sm font-medium text-slate-200">
        What needs attention
      </h3>
      {attention.length === 0 ? (
        <p className="mt-2 text-sm text-slate-300">
          Every study is on track on every dimension.
        </p>
      ) : (
        <ul className="mt-2 space-y-3">
          {attention.map(({ row, cell }) => {
            const { href, text } = evidence(row, cell.dimension);
            return (
              <li
                key={`${row.studyId}-${cell.dimension}`}
                className="flex min-w-0 gap-2 text-sm leading-relaxed text-slate-300"
              >
                <span
                  className={`mt-0.5 inline-flex h-6 min-w-6 shrink-0 items-center justify-center border ${RATING[cell.rating].cell}`}
                >
                  <Mark rating={cell.rating} />
                </span>
                <span className="min-w-0 break-words">
                  <span className="font-mono text-slate-100">
                    {row.studyId}
                  </span>{" "}
                  {`${names[cell.dimension].toLowerCase()}, ${RATING[cell.rating].label.toLowerCase()}: ${cell.reason}`}{" "}
                  <a
                    href={href}
                    className="text-amber-300 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-amber-400"
                  >
                    {`See ${text}`}
                  </a>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <details className="mt-6 border border-white/[0.08] bg-[#13151a]">
        <summary className="cursor-pointer px-4 py-3 text-sm text-slate-200">
          How each column is rated
        </summary>
        <div className="space-y-4 border-t border-white/[0.08] px-4 py-3">
          {heatmap.rules.map((rule) => (
            <div key={rule.dimension} className="min-w-0">
              <h4 className="text-sm font-medium text-slate-200">
                {rule.name}
              </h4>
              <dl className="mt-1 space-y-1 text-sm leading-relaxed text-slate-300">
                {(["green", "amber", "red"] as const).map((rating) => (
                  <div
                    key={rating}
                    className="flex min-w-0 flex-col @min-[26rem]:flex-row @min-[26rem]:gap-2"
                  >
                    <dt className="shrink-0">
                      <Mark rating={rating} />{" "}
                      <span>{`${RATING[rating].label}:`}</span>
                    </dt>
                    <dd className="min-w-0">{rule[rating]}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                {`Why: ${rule.reason}`}
              </p>
            </div>
          ))}
        </div>
      </details>
    </section>
  );
}
