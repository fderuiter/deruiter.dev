"use client";

import { useId, useMemo, useState } from "react";
import {
  searchBusinessGlossary,
  type BusinessGlossaryEntry,
} from "@/lib/clinical-platform";
import { catalogAnchor, glossaryAnchor } from "./labels";

/**
 * The searchable business glossary: each term with its definition, other
 * names, source and the governed metrics defined in it, each linked to its
 * catalog entry.
 *
 * @param entries - Entries from `businessGlossary`.
 * @param metricNames - Each metric's name by id.
 */
export function BusinessGlossary({
  entries,
  metricNames,
}: {
  entries: readonly BusinessGlossaryEntry[];
  metricNames: Readonly<Record<string, string>>;
}) {
  const searchId = useId();
  const resultsId = useId();
  const [text, setText] = useState("");
  const shown = useMemo(
    () => searchBusinessGlossary(entries, text),
    [entries, text]
  );

  return (
    <div className="@container min-w-0">
      <form
        role="search"
        aria-label="Business glossary"
        className="border-b border-white/[0.08] pb-4"
        onSubmit={(event) => event.preventDefault()}
      >
        <label htmlFor={searchId} className="block text-xs text-slate-400">
          Search the glossary
        </label>
        <input
          id={searchId}
          type="search"
          value={text}
          onChange={(event) => setText(event.target.value)}
          aria-controls={resultsId}
          className="mt-1 min-h-12 w-full border border-white/[0.12] bg-[#13151a] px-3 py-2 text-sm text-[#f4f4f6] placeholder:text-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          placeholder="Term, other name, definition or metric"
        />
      </form>
      <p className="mt-4 text-xs text-slate-400" aria-live="polite">
        {shown.length === entries.length
          ? `${entries.length} terms`
          : `${shown.length} of ${entries.length} terms`}
      </p>
      <dl id={resultsId} className="mt-3 grid gap-3 @3xl:grid-cols-2">
        {shown.map((entry) => (
          <div
            key={entry.key}
            id={glossaryAnchor(entry.key)}
            tabIndex={-1}
            className="min-w-0 scroll-mt-24 border border-white/[0.08] bg-[#13151a] p-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            <dt className="text-base font-semibold text-[#f4f4f6]">
              {entry.term}
            </dt>
            <dd className="mt-2 text-sm leading-relaxed text-slate-300">
              {entry.definition}
            </dd>
            {entry.synonyms.length > 0 && (
              <dd className="mt-2 text-xs text-slate-400">
                Also called {entry.synonyms.join(", ")}.
              </dd>
            )}
            {entry.source !== null && (
              <dd className="mt-1 text-xs text-slate-400">
                Source: {entry.source}
              </dd>
            )}
            <dd className="mt-3 text-xs text-slate-400">
              {entry.metrics.length === 0 ? (
                "No governed metric is defined in this term yet."
              ) : (
                <>
                  <span>Metrics defined in it: </span>
                  {entry.metrics.map((id, index) => (
                    <span key={id}>
                      {index > 0 && ", "}
                      <a
                        href={`#${catalogAnchor(id)}`}
                        className="text-amber-300 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-amber-400"
                      >
                        {metricNames[id] ?? id}
                      </a>
                    </span>
                  ))}
                </>
              )}
            </dd>
          </div>
        ))}
      </dl>
      {shown.length === 0 && (
        <p className="mt-3 text-sm text-slate-400">
          No term matches. Try other words.
        </p>
      )}
    </div>
  );
}
