import React from "react";
import type { CsrLockView } from "@/lib/trial-and-error";

interface CsrLockSummaryProps {
  lock: NonNullable<CsrLockView["lock"]>;
  amendRefusal: string | null;
  seed: string;
  handsPlayed: number;
  cpuSpent: number;
  /** The cabinet allows loud effects: the stamp slams and the score burns. */
  loud: boolean;
  onAmend: () => void;
}

/**
 * The lock moment and the run summary (#922). The LOCKED stamp slams on, the
 * final campaign score catches fire, and the audit summary lists every
 * output the package locked with the snapshot and SAP it was validated on.
 * The summary is read-only: changing the package takes a protocol
 * amendment.
 */
export function CsrLockSummary({
  lock,
  amendRefusal,
  seed,
  handsPlayed,
  cpuSpent,
  loud,
  onAmend,
}: CsrLockSummaryProps) {
  return (
    <section
      aria-labelledby="csr-lock-heading"
      className="mx-auto mt-3 max-w-xl border-2 border-emerald-400 bg-[color:var(--te-surface-1)] p-3 text-left text-xs break-words"
      data-testid="csr-lock-summary"
    >
      <p className="text-[10px] uppercase tracking-wider text-zinc-400">
        Clinical Study Report (fictional study)
      </p>
      <h3
        id="csr-lock-heading"
        className="mt-1 flex flex-wrap items-center gap-2 text-sm font-bold uppercase tracking-wider text-emerald-300"
      >
        {lock.packageName}
        <span
          className={`inline-block -rotate-6 border-2 border-emerald-300 px-2 text-base tracking-[0.3em] ${loud ? "te-loud-lock" : ""}`}
          data-testid="csr-locked-stamp"
        >
          LOCKED
        </span>
      </h3>
      {lock.amendment > 0 && (
        <p className="mt-1 text-amber-200">
          Locked after Protocol Amendment {lock.amendment}.
        </p>
      )}
      {/* Scrolls sideways at 320px, so it takes focus for keyboard users. */}
      <div
        className="mt-2 overflow-x-auto"
        role="region"
        aria-label="Audit summary"
        tabIndex={0}
      >
        <table className="w-full min-w-[18rem] border-collapse text-left tabular-nums">
          <caption className="sr-only">
            Audit summary: the outputs locked, in pipeline order
          </caption>
          <thead className="text-[10px] uppercase tracking-wider text-zinc-400">
            <tr>
              <th scope="col" className="py-1 pr-2 font-normal">
                Slot
              </th>
              <th scope="col" className="py-1 pr-2 font-normal">
                Output
              </th>
              <th scope="col" className="py-1 pr-2 font-normal">
                Snapshot
              </th>
              <th scope="col" className="py-1 font-normal">
                SAP
              </th>
            </tr>
          </thead>
          <tbody className="text-zinc-200">
            {lock.outputs.map((output, i) => (
              <tr key={output.cardId} className="border-t border-zinc-800">
                <td className="py-1 pr-2">{i + 1}</td>
                <td className="py-1 pr-2">
                  {output.name}
                  <span className="block text-zinc-400">{output.title}</span>
                </td>
                <td className="py-1 pr-2">{output.snapshotId}</td>
                <td className="py-1">{output.rulebookId}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <dl
        className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 tabular-nums"
        data-testid="csr-campaign"
      >
        {lock.campaign.map((record) => (
          <React.Fragment key={record.scenarioId}>
            <dt className="min-w-0 text-zinc-400">
              {record.blindName}
              {record.milestone === "DMC_DEFENSE" && " · DMC defended"}
              {record.milestone === "FDA_IR" &&
                ` · FDA answered, ${record.hoursToSpare} h to spare`}
            </dt>
            <dd className="text-zinc-200">{record.score}</dd>
          </React.Fragment>
        ))}
        <dt className="text-zinc-400">Milestone weighting</dt>
        <dd className="text-zinc-200">+{lock.final.bonusPercent}%</dd>
        <dt className="font-bold uppercase tracking-wider text-emerald-300">
          Final campaign score
        </dt>
        <dd
          className={`font-bold text-emerald-300 ${loud ? "te-loud-fire" : ""}`}
          data-testid="csr-final-score"
        >
          {lock.final.score}
        </dd>
      </dl>
      <p className="mt-2 text-zinc-400 tabular-nums">
        Seed {seed} · {handsPlayed} hand{handsPlayed === 1 ? "" : "s"} ·{" "}
        {cpuSpent} CPU spent
      </p>
      <div className="mt-3 border-t border-zinc-800 pt-2">
        <button
          type="button"
          onClick={onAmend}
          disabled={amendRefusal !== null}
          aria-describedby="csr-amend-note"
          className="min-h-[44px] border border-amber-500 px-3 text-[10px] font-bold uppercase tracking-wider text-amber-300 touch-manipulation hover:bg-amber-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:border-zinc-700 disabled:text-zinc-400"
          data-testid="csr-amend"
        >
          File protocol amendment
        </button>
        <p id="csr-amend-note" className="mt-1 text-[11px] text-zinc-400">
          {amendRefusal ??
            "Unlocks the package and withdraws the lock hand; its outputs must be validated again."}
        </p>
      </div>
    </section>
  );
}
