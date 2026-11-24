"use client";

import {
  sanitizeDisplayLabel,
  type AllocationBalanceReport,
  type BalanceGroup,
  type RandomizationRequest,
} from "@/lib/randomization";
import { MONO } from "./RandomizationStageEditors";

function signed(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  if (rounded === 0) return "0";
  return rounded > 0 ? `+${rounded}` : String(rounded);
}

function target(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function BalanceTable({
  caption,
  groupLabel,
  groups,
  request,
  showPartial,
}: {
  readonly caption: string;
  readonly groupLabel: string;
  readonly groups: readonly BalanceGroup[];
  readonly request: RandomizationRequest;
  readonly showPartial: boolean;
}) {
  return (
    <div
      className="max-h-[28rem] overflow-auto rounded border border-white/[0.08] focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"
      role="region"
      aria-label={caption}
      tabIndex={0}
    >
      <table className="w-full min-w-0 text-left text-sm">
        <caption className="px-3 py-2 text-left text-sm font-medium text-[#f4f4f6]">
          {caption}
        </caption>
        <thead className="bg-[#13151a]">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">
              {groupLabel}
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Rows
            </th>
            {request.arms.map((arm) => (
              <th key={arm.id} scope="col" className="px-3 py-2 font-medium">
                {sanitizeDisplayLabel(arm.code)}: actual / target (difference)
              </th>
            ))}
            {showPartial && (
              <th scope="col" className="px-3 py-2 font-medium">
                Partial blocks
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <tr key={group.key} className="border-t border-white/[0.08]">
              <th scope="row" className="px-3 py-1 font-normal">
                {group.label}
              </th>
              <td className={`${MONO} px-3 py-1`}>{group.total}</td>
              {(group.arms ?? []).map((arm) => (
                <td key={arm.armId} className={`${MONO} px-3 py-1`}>
                  {arm.actual} / {target(arm.target)} ({signed(arm.difference)})
                </td>
              ))}
              {showPartial && (
                <td className={`${MONO} px-3 py-1`}>{group.partialBlocks}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The descriptive balance report (RND-RESUL-007 to RND-RESUL-009). Targets
 * are each group's size times the arm's ratio over the total ratio, so an
 * unequal plan is read against its own ratio, never against 50/50. The
 * report names differences and partial blocks and passes no verdict.
 */
export function BalancePanel({
  report,
  request,
}: {
  readonly report: AllocationBalanceReport;
  readonly request: RandomizationRequest;
}) {
  const blocks = report.method === "BLOCK";
  if (report.masked) {
    return (
      <div className="space-y-2 text-sm">
        <p className="text-slate-300">
          Per-arm balance is hidden while treatment is masked, because arm
          counts by site or stratum would show which subjects share an arm.
          Switch to an unmasked view to read it.
        </p>
        <p className={`${MONO} text-xs text-slate-400`}>
          {report.global.total} rows across {report.sites.length} sites
          {blocks ? `, ${report.global.partialBlocks} partial blocks` : ""}.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div className="space-y-1 text-sm text-slate-300">
        <p>
          Targets use the planned ratio {report.ratios.join(":")}: each
          group&apos;s rows times the arm&apos;s share. Balance covers the whole
          schedule; row filters don&apos;t change it.
        </p>
        <p>
          {blocks
            ? report.global.partialBlocks > 0
              ? `Complete blocks hold each arm in exact ratio. ${report.global.partialBlocks} partial ${report.global.partialBlocks === 1 ? "block is" : "blocks are"} cut short by a cap or the end of the schedule, and ${report.global.partialBlocks === 1 ? "it explains" : "they explain"} any difference from target.`
              : "Every block is complete, so each site and stratum holds its arms in exact ratio."
            : "Minimization balances factor margins with a biased coin, so small differences from target are expected and are not a defect. Read the factor margins below."}
        </p>
      </div>
      <BalanceTable
        caption="Whole study"
        groupLabel="Group"
        groups={[report.global]}
        request={request}
        showPartial={blocks}
      />
      <BalanceTable
        caption="By site"
        groupLabel="Site"
        groups={report.sites}
        request={request}
        showPartial={blocks}
      />
      {request.factors.length > 0 && (
        <BalanceTable
          caption="By site and stratum"
          groupLabel="Site · stratum"
          groups={report.intersections}
          request={request}
          showPartial={blocks}
        />
      )}
      {report.intersectionsOmitted > 0 && (
        <p className="text-sm text-slate-400">
          {report.intersectionsOmitted} more site and stratum groups are not
          listed. The whole-study and site totals include them.
        </p>
      )}
      {!blocks && report.marginals.length > 0 && (
        <BalanceTable
          caption="Factor margins"
          groupLabel="Factor level"
          groups={report.marginals}
          request={request}
          showPartial={false}
        />
      )}
    </div>
  );
}
