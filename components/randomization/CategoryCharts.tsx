"use client";

import { useId } from "react";
import type {
  AllocationCategoryFilter,
  AllocationCategorySummary,
} from "@/lib/randomization";
import { MONO } from "./RandomizationStageEditors";

/**
 * Categorical counts for sites, treatment, strata and factor levels
 * (#4008, RND-RESUL-005 and RND-RESUL-006). Each entry is a button whose
 * text is the count and share, so the bar is decoration and the legend is
 * its text equivalent. Pressing an entry filters the allocations to it;
 * pressing it again clears the filter. A masked treatment summary is one
 * "Blinded" entry that cannot filter, so no label or count reveals an arm.
 */
export function CategoryCharts({
  categories,
  active,
  onSelect,
}: {
  readonly categories: readonly AllocationCategorySummary[];
  readonly active: AllocationCategoryFilter | null;
  readonly onSelect: (filter: AllocationCategoryFilter | null) => void;
}) {
  const base = useId();
  return (
    <div className="grid min-w-0 gap-3 @container @md:grid-cols-2">
      {categories.map((category, index) => {
        const headingId = `${base}-chart-${index}`;
        return (
          <section
            key={category.dimension}
            aria-labelledby={headingId}
            className="min-w-0 rounded border border-white/[0.08] bg-[#13151a] p-3"
          >
            <h4
              id={headingId}
              className={`${MONO} text-xs uppercase tracking-wide text-[#94a3b8]`}
            >
              {category.label}
            </h4>
            {category.entries.length === 0 ? (
              <p className="mt-2 text-sm text-slate-400">No matching rows.</p>
            ) : (
              <ul className="mt-2 space-y-1">
                {category.entries.map((entry) => {
                  const pressed =
                    active?.dimension === category.dimension &&
                    active.key === entry.key;
                  const text = `${entry.label}: ${entry.count} (${entry.percent}%)`;
                  return (
                    <li key={entry.key} className="min-w-0">
                      <button
                        type="button"
                        aria-pressed={category.masked ? undefined : pressed}
                        disabled={category.masked}
                        onClick={() =>
                          onSelect(
                            pressed
                              ? null
                              : {
                                  dimension: category.dimension,
                                  key: entry.key,
                                }
                          )
                        }
                        className={`relative flex min-h-11 w-full min-w-0 items-center overflow-hidden rounded border px-2 text-left text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400 active:scale-[0.98] disabled:cursor-default ${
                          pressed
                            ? "border-amber-500/70 text-[#f4f4f6]"
                            : "border-white/[0.08] text-slate-200 hover:border-slate-500"
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className={`absolute inset-y-0 left-0 ${pressed ? "bg-amber-500/25" : "bg-slate-400/15"}`}
                          style={{ width: `${Math.min(100, entry.percent)}%` }}
                        />
                        <span className="relative min-w-0 break-words">
                          {text}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {category.masked && (
              <p className="mt-2 text-xs text-slate-400">
                Arms are combined while treatment is masked.
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}
