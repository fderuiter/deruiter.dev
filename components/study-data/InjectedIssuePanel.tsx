"use client";

import type { DataLayer } from "@/lib/study-data";
import type { InjectedIssue } from "./protocol";
import { BUTTON_SECONDARY, PANEL } from "./ui";

interface InjectedIssuePanelProps {
  readonly injected: InjectedIssue;
  readonly onShowRow: (layer: DataLayer, dataset: string, row: number) => void;
}

const SEVERITY_STYLE: Readonly<Record<string, string>> = {
  error: "border-rose-400/50 text-rose-300",
  warning: "border-amber-500/50 text-amber-300",
  notice: "border-slate-400/50 text-slate-300",
};

/**
 * The result of injecting a messy-data scenario: the subject it changed and
 * each finding the gate raised there, with a way to open the record. A
 * scenario that declares no finding tests a derivation, which is shown
 * instead.
 */
export function InjectedIssuePanel({
  injected,
  onShowRow,
}: InjectedIssuePanelProps) {
  const { scenario, subject, caught, missed } = injected;
  const declared = scenario.expected.findings;
  return (
    <div
      role="region"
      aria-labelledby="injected-title"
      className={`${PANEL} mt-6 border-amber-500/40 p-4 sm:p-5`}
    >
      <h3 id="injected-title" className="text-sm font-semibold text-white">
        Injected: {scenario.title}
      </h3>
      <p className="mt-1 max-w-3xl break-words text-xs leading-relaxed text-slate-300">
        {scenario.description}
      </p>
      {subject === null ? (
        <p className="mt-3 max-w-3xl break-words text-xs leading-relaxed text-amber-100">
          No subject in this run was eligible, so nothing was changed. Try a
          larger subject count or another seed.
        </p>
      ) : (
        <>
          <p className="mt-3 break-words font-mono text-xs text-slate-200">
            Changed subject {subject}
          </p>
          {declared.length === 0 ? (
            <p className="mt-3 max-w-3xl break-words border-l-2 border-emerald-500 pl-4 text-xs leading-relaxed text-slate-200">
              The gate raises no finding for this one: the data is legitimate,
              and the derivation has to handle it.{" "}
              {scenario.expected.derivation}
            </p>
          ) : (
            <>
              <p className="mt-3 max-w-3xl break-words text-xs leading-relaxed text-slate-300">
                {caught.length > 0
                  ? `The gate caught it: ${caught.length} ${caught.length === 1 ? "finding" : "findings"} from ${declared.join(", ")} on this subject.`
                  : `The gate did not catch it: ${declared.join(", ")} raised nothing on this subject.`}
              </p>
              {caught.length > 0 ? (
                <ul className="mt-3 min-w-0 space-y-2">
                  {caught.map((finding, index) => (
                    <li
                      key={`${finding.ruleId}-${finding.dataset}-${finding.row}-${index}`}
                      className="flex min-w-0 flex-col gap-3 border border-white/[0.08] bg-[#0d0e11] p-3 sm:flex-row sm:items-start sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="flex min-w-0 flex-wrap items-center gap-2 font-mono text-xs text-slate-200">
                          <span className="text-amber-300">
                            {finding.ruleId}
                          </span>
                          <span
                            className={`border px-1.5 py-0.5 uppercase ${SEVERITY_STYLE[finding.severity]}`}
                          >
                            {finding.severity}
                          </span>
                          <span className="break-all">
                            {finding.dataset}
                            {finding.variable ? `.${finding.variable}` : ""}
                            {finding.row === undefined
                              ? ""
                              : `, row ${(finding.row + 1).toLocaleString("en-US")}`}
                          </span>
                        </p>
                        <p className="mt-1 break-words text-xs leading-relaxed text-slate-300">
                          {finding.message}
                        </p>
                      </div>
                      {finding.dataset && finding.row !== undefined ? (
                        <button
                          type="button"
                          onClick={() =>
                            onShowRow(
                              finding.layer,
                              finding.dataset!,
                              finding.row!
                            )
                          }
                          className={`${BUTTON_SECONDARY} shrink-0`}
                        >
                          Show row
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
              {caught.length > 0 && missed.length > 0 ? (
                <p className="mt-3 max-w-3xl break-words text-xs leading-relaxed text-amber-100">
                  {missed.join(", ")} raised nothing on this subject.
                </p>
              ) : null}
              <p className="mt-3 max-w-3xl break-words text-xs leading-relaxed text-slate-400">
                Derivation: {scenario.expected.derivation}
              </p>
            </>
          )}
        </>
      )}
    </div>
  );
}
