import type { StageCounts } from "./protocol";

/**
 * Where CDISC CORE stands for the current run: its recorded findings show no
 * reported issue, show at least one, are loading or failed to load, or CORE
 * never saw this run's output.
 */
export type CoreSummaryStatus =
  "passed" | "flagged" | "loading" | "unavailable" | "not-run";

/**
 * Where CDISC CORE stands for a run: not run when CORE never saw its output,
 * loading or unavailable while its recorded findings are fetched or after the
 * fetch failed, then flagged when any rule reported an issue.
 *
 * @param hasView - whether CORE has a recorded view of this run's output
 * @param issues - rules with ISSUE REPORTED, or null before findings load
 * @param failed - whether loading the recorded findings failed
 */
export function coreSummaryStatus(
  hasView: boolean,
  issues: number | null,
  failed: boolean
): CoreSummaryStatus {
  if (!hasView) return "not-run";
  if (issues === null) return failed ? "unavailable" : "loading";
  return issues > 0 ? "flagged" : "passed";
}

interface StudySummaryCardProps {
  readonly studyId: string;
  /** Counts of the current run, the ones the stage rail shows; null before it. */
  readonly counts: StageCounts | null;
  /** The versions that describe the run: package format and local rules. */
  readonly versions: { readonly package: string; readonly rules: string };
  readonly core: CoreSummaryStatus;
}

const CORE_TEXT: Readonly<Record<CoreSummaryStatus, string>> = {
  passed: "Passed: no issues reported",
  flagged: "Flagged: issues reported",
  loading: "Recorded; loading",
  unavailable: "Recorded; could not load",
  "not-run": "Not run for this run",
};

const CORE_TONE: Readonly<Record<CoreSummaryStatus, string>> = {
  passed: "text-emerald-300",
  flagged: "text-amber-300",
  loading: "text-slate-300",
  unavailable: "text-slate-300",
  "not-run": "text-slate-300",
};

const plural = (n: number, word: string) =>
  `${n.toLocaleString("en-US")} ${word}${n === 1 ? "" : "s"}`;

/**
 * The run at a glance (#3159): the study, a synthetic-data label, how many
 * datasets and tables, figures and listings it produced, the versions behind
 * it and CDISC CORE's status. Values come from the same counts the stage rail
 * shows, as props; the card fetches nothing.
 */
export function StudySummaryCard({
  studyId,
  counts,
  versions,
  core,
}: StudySummaryCardProps) {
  const datasets = counts
    ? {
        value: plural(counts.sdtm.datasets + counts.adam.datasets, "dataset"),
        detail: `${counts.sdtm.datasets} SDTM · ${counts.adam.datasets} ADaM`,
      }
    : { value: "—", detail: "waiting for the run" };
  const tlfs = counts
    ? {
        value: plural(counts.tlf.tables + counts.tlf.figures, "TLF"),
        detail: `${plural(counts.tlf.tables, "table")} · ${plural(counts.tlf.figures, "figure")}`,
      }
    : { value: "—", detail: "waiting for the run" };

  return (
    <section
      aria-label="Study summary"
      data-testid="study-summary-card"
      className="section-isolate @container min-w-0 border border-white/[0.08] bg-[#13151a] p-4 sm:p-5"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
        <p className="font-mono text-lg font-semibold tabular-nums text-white">
          {studyId}
        </p>
        <span className="border border-amber-500/40 px-2 py-0.5 font-mono text-[11px] uppercase tracking-[0.14em] text-amber-300">
          Synthetic data
        </span>
      </div>
      <dl className="mt-4 grid min-w-0 gap-x-6 gap-y-4 @sm:grid-cols-2 @3xl:grid-cols-4">
        <div className="min-w-0">
          <dt className="font-mono text-[11px] uppercase tracking-[0.14em] text-slate-400">
            Datasets
          </dt>
          <dd className="mt-1 font-mono tabular-nums text-white">
            {datasets.value}
          </dd>
          <dd className="break-words font-mono text-[11px] text-slate-400">
            {datasets.detail}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="font-mono text-[11px] uppercase tracking-[0.14em] text-slate-400">
            Tables and figures
          </dt>
          <dd className="mt-1 font-mono tabular-nums text-white">
            {tlfs.value}
          </dd>
          <dd className="break-words font-mono text-[11px] text-slate-400">
            {tlfs.detail}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="font-mono text-[11px] uppercase tracking-[0.14em] text-slate-400">
            Versions
          </dt>
          <dd className="mt-1 break-words font-mono tabular-nums text-white">
            Package format {versions.package}
          </dd>
          <dd className="break-words font-mono text-[11px] text-slate-400">
            Local rules {versions.rules}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="font-mono text-[11px] uppercase tracking-[0.14em] text-slate-400">
            CDISC CORE
          </dt>
          <dd
            data-core-status={core}
            className={`mt-1 break-words font-mono ${CORE_TONE[core]}`}
          >
            {CORE_TEXT[core]}
          </dd>
        </div>
      </dl>
    </section>
  );
}
