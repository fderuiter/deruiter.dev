"use client";

import { useSyncExternalStore } from "react";
import {
  DEMO_STUDY_ID,
  readSelectedStudy,
  subscribeSelectedStudy,
  type ClinicalStudyId,
} from "@/lib/clinical-study-context";
import { loadRecordedSdtmSuggestions } from "@/lib/study-data";
import { EYEBROW, FOCUS, HEADING, PANEL, TABLE_SCROLL } from "./ui";

const getServerSnapshot = (): ClinicalStudyId => DEMO_STUDY_ID;

function formatSuggesterMeta(method: string, version: string): string {
  return `${method} · v${version}`;
}

function SyntheticBadge({ compact = false }: { readonly compact?: boolean }) {
  return (
    <span
      className={`inline-block border border-amber-500/40 bg-amber-500/10 font-mono uppercase text-amber-300 ${
        compact
          ? "px-2 py-0.5 text-[10px] tracking-[0.12em]"
          : "px-2.5 py-1 text-[11px] tracking-[0.14em]"
      }`}
    >
      Synthetic
    </span>
  );
}

/**
 * Renders one recorded, synthetic SDTM mapping suggestion per raw collected
 * column for the study selected in `StudyPicker` (#3531). Reads only committed
 * static fixtures via `lib/study-data` with no model or network calls.
 */
export function RecordedSuggestionsSection() {
  const selectedStudy = useSyncExternalStore(
    subscribeSelectedStudy,
    readSelectedStudy,
    getServerSnapshot
  );
  const suggestionSet = loadRecordedSdtmSuggestions(selectedStudy);

  return (
    <section
      aria-labelledby="recorded-suggestions-title"
      data-testid="recorded-suggestions-section"
      className="min-w-0 border-t border-white/[0.08] py-12 sm:py-16"
    >
      <p className={EYEBROW}>Recorded suggester / 04</p>
      <div className="mt-2 flex min-w-0 flex-wrap items-center gap-3">
        <h2 id="recorded-suggestions-title" className={`min-w-0 ${HEADING}`}>
          Recorded SDTM mapping suggestions
        </h2>
        <SyntheticBadge />
      </div>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-300">
        One committed suggestion per raw collected column in{" "}
        <span className="font-mono text-slate-100">{selectedStudy}</span>, keyed
        deterministically by study, raw column, suggested variable and suggester
        version. No runtime model or network request runs here.
      </p>

      {suggestionSet ? (
        <div className={`${PANEL} mt-6 p-4 sm:p-5`}>
          <div className="mb-4 flex min-w-0 flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
            <span className="min-w-0 break-words font-mono text-slate-200">
              {suggestionSet.suggestions.length} raw columns ·{" "}
              {suggestionSet.studyId}
            </span>
          </div>

          <div
            role="region"
            aria-label={`${suggestionSet.studyId} raw column suggestions table`}
            tabIndex={0}
            className={`${TABLE_SCROLL} max-h-[32rem] ${FOCUS}`}
          >
            <table className="w-full border-collapse text-left text-sm">
              <caption className="px-4 pb-2 pt-3 text-left text-sm font-semibold text-white">
                Recorded SDTM mapping suggestions for {suggestionSet.studyId}
              </caption>
              <thead>
                <tr className="border-y border-white/[0.12] bg-[#13151a] text-xs text-slate-300">
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Raw column &amp; suggester
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Domain
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Suggested variable
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Origin
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Deterministic key
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Source label
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04] text-slate-100">
                {suggestionSet.suggestions.map((item) => (
                  <tr
                    key={item.key}
                    className="align-top hover:bg-white/[0.02]"
                  >
                    <th
                      scope="row"
                      className="min-w-0 px-3 py-2.5 text-left font-normal"
                    >
                      <span className="block font-mono text-xs font-semibold text-white">
                        {item.rawColumn}
                      </span>
                      <span className="mt-1 block break-words font-mono text-[11px] text-slate-400">
                        {formatSuggesterMeta(
                          item.method,
                          item.suggesterVersion
                        )}
                      </span>
                    </th>
                    <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-emerald-300">
                      {item.domain}
                    </td>
                    <td className="min-w-0 px-3 py-2.5">
                      <span className="block font-mono text-xs text-amber-200">
                        {item.suggestedVariable}
                      </span>
                      <span className="mt-1 block max-w-xs break-words text-xs text-slate-400">
                        {item.rationale}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-slate-300">
                      {item.suggestedOrigin}
                    </td>
                    <td className="min-w-0 max-w-[16rem] break-all px-3 py-2.5 font-mono text-[11px] text-slate-300">
                      {item.key}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <SyntheticBadge compact />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <footer
            data-testid="recorded-suggestions-footer"
            className="mt-4 flex min-w-0 flex-wrap items-center justify-between gap-2 border-t border-white/[0.08] pt-3 text-xs text-slate-300"
          >
            <span className="min-w-0 break-words font-mono text-slate-200">
              {formatSuggesterMeta(
                suggestionSet.method,
                suggestionSet.suggesterVersion
              )}
            </span>
            <span className="min-w-0 break-words text-amber-200">
              {suggestionSet.syntheticNotice}
            </span>
          </footer>
        </div>
      ) : (
        <p className="mt-6 border border-white/[0.08] bg-[#13151a] p-4 text-sm text-slate-300">
          No recorded mapping suggestions are committed for {selectedStudy}.
        </p>
      )}
    </section>
  );
}
