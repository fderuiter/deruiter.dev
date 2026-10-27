"use client";

import type { CoreViewReport } from "@/lib/study-data";
import { CELL, TABLE_SCROLL } from "./ui";

interface CoreFindingsPanelProps {
  /** CORE's findings for this run, null when CORE never saw its output. */
  readonly report: CoreViewReport | null;
  /** True while the recorded findings are still loading. */
  readonly loading: boolean;
  /** True when the recorded findings could not be loaded. */
  readonly failed: boolean;
  /** The default study run CORE results exist for. */
  readonly defaults: { readonly seed: number; readonly nSubjects: number };
}

const OUTCOME_TEXT: Readonly<Record<string, string>> = {
  SUCCESS: "passed",
  SKIPPED: "did not apply",
  "ISSUE REPORTED": "reported issues",
  "EXECUTION ERROR": "could not run",
};

const CATEGORY_TEXT: Readonly<Record<string, string>> = {
  "by-design": "By design",
  "core-limitation": "CORE limitation",
  defect: "Known defect",
};

const ISSUES_URL = "https://github.com/fderuiter/deruiter.dev/issues";

/**
 * CDISC CORE's own findings for the run, as recorded in CI. Only the default
 * study at the default seed and subject count, with or without one injected
 * issue, has them; any other run says so and keeps the local gate alone.
 */
export function CoreFindingsPanel({
  report,
  loading,
  failed,
  defaults,
}: CoreFindingsPanelProps) {
  const subjects = defaults.nSubjects.toLocaleString("en-US");
  return (
    <section
      aria-labelledby="core-findings-heading"
      className="min-w-0 space-y-3 border-t border-white/[0.08] pt-6"
    >
      <h3
        id="core-findings-heading"
        className="text-lg font-semibold tracking-[-0.035em] text-white"
      >
        CDISC CORE on this run
      </h3>
      {failed ? (
        <p className="text-sm text-slate-300" role="status">
          The recorded CDISC CORE results could not be loaded. Reload the page
          to try again.
        </p>
      ) : loading ? (
        <p className="text-sm text-slate-300" role="status">
          Loading the recorded CDISC CORE results…
        </p>
      ) : report === null ? (
        <p className="max-w-3xl text-sm leading-relaxed text-slate-300">
          CDISC CORE results are recorded for the default study at seed{" "}
          {defaults.seed} with {subjects} subjects, with or without one injected
          issue. This run differs, so only the local rules above checked it.
        </p>
      ) : (
        <CoreReport report={report} />
      )}
    </section>
  );
}

function CoreReport({ report }: { readonly report: CoreViewReport }) {
  const { lock } = report;
  const outcomes = Object.entries(report.outcomes)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([status, n]) => `${n} ${OUTCOME_TEXT[status] ?? status}`)
    .join(", ");
  const added = report.findings.reduce(
    (sum, finding) => sum + finding.addedByScenario,
    0
  );
  return (
    <>
      <p className="font-mono text-xs text-slate-300">
        {lock.engine} {lock.tag} · {lock.standards.sdtm} · {lock.standards.usdm}{" "}
        · CT {report.terminology.checked}
      </p>
      <p className="max-w-3xl border-l-2 border-amber-500 pl-4 text-sm leading-relaxed text-slate-200">
        CI ran the open-source CDISC Rules Engine over this exact output and
        recorded what it found; nothing here runs CORE in your browser. Of{" "}
        {report.ruleCount} SDTMIG rules, {outcomes}.
        {report.terminology.checked === report.terminology.cited
          ? ""
          : ` CORE checked terminology against the ${report.terminology.checked} release, the newest in its cache; the datasets cite ${report.terminology.cited}.`}
        {report.view === "default"
          ? ""
          : added > 0
            ? ` The injected issue adds ${added.toLocaleString("en-US")} ${added === 1 ? "finding" : "findings"}, listed first.`
            : " CORE raises nothing new for the injected issue; the local rules above are what catch it."}
      </p>
      {report.findings.length === 0 ? (
        <p className="text-sm text-slate-300">CORE reported no issues.</p>
      ) : (
        <div className={`${TABLE_SCROLL} max-h-[32rem]`}>
          <table className="w-full border-collapse">
            <caption className="sr-only">CDISC CORE findings</caption>
            <thead>
              <tr className="border-y border-white/[0.12] text-slate-300">
                {["Rule", "Dataset", "Findings", "Message", "Status"].map(
                  (heading) => (
                    <th
                      key={heading}
                      scope="col"
                      className={`${CELL} sticky top-0 bg-[#181b21] font-sans`}
                    >
                      {heading}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="text-slate-100">
              {report.findings.map((finding) => {
                const cited = [finding.rule.cdisc, finding.rule.fda]
                  .filter(Boolean)
                  .join(", ");
                return (
                  <tr
                    key={`${finding.target}-${finding.coreId}-${finding.dataset}`}
                    className="border-b border-white/[0.04] align-top"
                  >
                    <th scope="row" className={`${CELL} font-semibold`}>
                      {finding.coreId}
                      {cited ? (
                        <span className="block max-w-[12rem] whitespace-normal break-words font-normal text-xs text-slate-400">
                          {cited}
                        </span>
                      ) : null}
                    </th>
                    <td className={CELL}>{finding.dataset}</td>
                    <td className={CELL}>
                      {finding.count.toLocaleString("en-US")}
                      {finding.addedByScenario > 0 ? (
                        <span className="block text-xs text-amber-300">
                          +{finding.addedByScenario.toLocaleString("en-US")}{" "}
                          injected
                        </span>
                      ) : null}
                    </td>
                    <td className="min-w-[18rem] px-3 py-2 text-xs text-slate-200">
                      <span className="break-words">
                        {finding.rule.message}
                      </span>
                      {finding.examples.length > 0 ? (
                        <details className="mt-1 text-slate-400">
                          <summary className="cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400">
                            Examples
                          </summary>
                          <ul className="mt-1 space-y-1 font-mono">
                            {finding.examples.map((item, index) => (
                              <li
                                key={`${item.record}-${index}`}
                                className="break-all"
                              >
                                {item.record} {item.values}
                              </li>
                            ))}
                          </ul>
                        </details>
                      ) : null}
                    </td>
                    <td className="min-w-[14rem] px-3 py-2 text-xs text-slate-300">
                      {finding.addedByScenario > 0 ? (
                        <span className="text-amber-300">
                          Raised by the injected issue
                        </span>
                      ) : finding.explanation ? (
                        <>
                          <span className="font-semibold text-slate-100">
                            {CATEGORY_TEXT[finding.explanation.category] ??
                              finding.explanation.category}
                          </span>
                          {finding.explanation.issue ? (
                            <>
                              {" "}
                              <a
                                href={`${ISSUES_URL}/${finding.explanation.issue}`}
                                className="underline decoration-zinc-600 underline-offset-4 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                              >
                                #{finding.explanation.issue}
                              </a>
                            </>
                          ) : null}
                          <span className="block break-words">
                            {finding.explanation.reason}
                          </span>
                        </>
                      ) : (
                        "Not yet explained"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
