import type { ReactNode } from "react";
import { isEmptyRunDiff, type RunDiff } from "@/lib/study-data";
import { PANEL } from "./ui";

/** Changes listed per group; the rest are counted. */
const SHOWN = 20;

const number = (value: number | null) =>
  value === null ? "absent" : value.toLocaleString("en-US");

function Group({
  title,
  count,
  children,
}: {
  readonly title: string;
  readonly count: number;
  readonly children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <h4 className="font-mono text-xs uppercase tracking-[0.14em] text-slate-400">
        {title} ({count.toLocaleString("en-US")})
      </h4>
      {count === 0 ? (
        <p className="mt-2 text-sm text-slate-300">No change.</p>
      ) : (
        <ul className="mt-2 space-y-1">{children}</ul>
      )}
      {count > SHOWN ? (
        <p className="mt-2 text-xs text-slate-400">
          And {(count - SHOWN).toLocaleString("en-US")} more.
        </p>
      ) : null}
    </div>
  );
}

const ITEM =
  "min-w-0 break-words border border-white/[0.08] bg-[#0d0e11] px-3 py-2 font-mono text-xs text-slate-200";

/**
 * What a rerun changed against the run it replaced (#3160): conformance
 * findings added or removed, dataset row counts and table values. It renders
 * a diff the worker computed; it computes nothing itself.
 */
export function RunDiffPanel({ diff }: { readonly diff: RunDiff }) {
  return (
    <section
      aria-labelledby="run-diff-title"
      data-testid="run-diff-panel"
      className={`${PANEL} mt-6 p-4 sm:p-5`}
    >
      <h3 id="run-diff-title" className="text-sm font-semibold text-white">
        Compared with the last run
      </h3>
      {isEmptyRunDiff(diff) ? (
        <p className="mt-2 text-sm text-slate-300">
          No change from the last run.
        </p>
      ) : (
        <div className="mt-4 grid min-w-0 gap-5 lg:grid-cols-3">
          <Group title="Conformance findings" count={diff.findings.length}>
            {diff.findings.slice(0, SHOWN).map((item, index) => (
              <li key={index} className={ITEM}>
                <span
                  className={
                    item.change === "added"
                      ? "text-amber-300"
                      : "text-emerald-300"
                  }
                >
                  {item.change === "added" ? "Added" : "Removed"}
                </span>{" "}
                {item.finding.ruleId}
                {item.finding.dataset ? ` · ${item.finding.dataset}` : ""}
                {item.finding.row === undefined
                  ? ""
                  : ` · row ${item.finding.row + 1}`}
                <span className="mt-1 block font-sans text-slate-300">
                  {item.finding.message}
                </span>
              </li>
            ))}
          </Group>
          <Group title="Dataset row counts" count={diff.rowCounts.length}>
            {diff.rowCounts.slice(0, SHOWN).map((item) => (
              <li key={`${item.layer}:${item.dataset}`} className={ITEM}>
                {item.dataset} ({item.layer.toUpperCase()}):{" "}
                {number(item.before)} → {number(item.after)}
              </li>
            ))}
          </Group>
          <Group title="Table values" count={diff.tlfValues.length}>
            {diff.tlfValues.slice(0, SHOWN).map((item, index) => (
              <li key={index} className={ITEM}>
                Table {item.table} · {item.location}: {item.before ?? "absent"}{" "}
                → {item.after ?? "absent"}
              </li>
            ))}
          </Group>
        </div>
      )}
    </section>
  );
}
