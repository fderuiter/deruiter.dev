"use client";

import { useId } from "react";
import {
  presentAllocationRows,
  sanitizeDisplayLabel,
  type AllocationBlockGroupPage,
  type AllocationColumnFilters,
  type AllocationQueryPage,
  type AllocationSort,
  type AllocationSortColumn,
  type RandomizationRequest,
  type ResolvedPresentation,
} from "@/lib/randomization";
import { BUTTON, FIELD, MONO } from "./RandomizationStageEditors";

/** Rows or groups per page in the result views. */
export const RESULT_PAGE_SIZE = 25;

/** None, then ascending, then descending, then none again (RND-RESUL-003). */
function nextSort(
  current: AllocationSort | null,
  column: AllocationSortColumn
): AllocationSort | null {
  if (!current || current.column !== column) {
    return { column, direction: "ascending" };
  }
  return current.direction === "ascending"
    ? { column, direction: "descending" }
    : null;
}

function Pager({
  label,
  offset,
  count,
  total,
  onOffset,
}: {
  readonly label: string;
  readonly offset: number;
  readonly count: number;
  readonly total: number;
  readonly onOffset: (offset: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className={`${BUTTON} min-w-12`}
        disabled={offset === 0}
        onClick={() => onOffset(Math.max(0, offset - RESULT_PAGE_SIZE))}
      >
        Previous {label}
      </button>
      <button
        type="button"
        className={`${BUTTON} min-w-12`}
        disabled={offset + RESULT_PAGE_SIZE >= total}
        onClick={() => onOffset(offset + RESULT_PAGE_SIZE)}
      >
        Next {label}
      </button>
      <span className={`${MONO} text-xs text-slate-400`}>
        {total === 0
          ? `No ${label}`
          : `${offset + 1}–${offset + count} of ${total} ${label}`}
      </span>
    </div>
  );
}

/** Column filters shared by the flat and grouped views (RND-RESUL-004). */
export function ColumnFilters({
  request,
  filters,
  masked,
  onChange,
}: {
  readonly request: RandomizationRequest;
  readonly filters: AllocationColumnFilters;
  readonly masked: boolean;
  readonly onChange: (filters: AllocationColumnFilters) => void;
}) {
  const base = useId();
  const any =
    Boolean(filters.subjectId || filters.site || filters.treatment) ||
    Object.values(filters.factors ?? {}).some(Boolean);
  const field = (
    id: string,
    label: string,
    value: string | undefined,
    set: (value: string) => void,
    disabled = false
  ) => (
    <label key={id} className="flex min-w-0 flex-col gap-1 text-sm">
      <span>{label} contains</span>
      <input
        id={`${base}-${id}`}
        type="search"
        className={FIELD}
        value={disabled ? "" : (value ?? "")}
        disabled={disabled}
        maxLength={120}
        onChange={(event) => set(event.target.value)}
      />
    </label>
  );
  return (
    <fieldset className="min-w-0 space-y-2">
      <legend
        className={`${MONO} text-xs uppercase tracking-wide text-[#94a3b8]`}
      >
        Filter rows (any case)
      </legend>
      <div className="grid min-w-0 gap-2 @container @sm:grid-cols-2 @lg:grid-cols-4">
        {field("subject", "Subject ID", filters.subjectId, (subjectId) =>
          onChange({ ...filters, subjectId })
        )}
        {field("site", "Site", filters.site, (site) =>
          onChange({ ...filters, site })
        )}
        {field(
          "treatment",
          "Treatment",
          filters.treatment,
          (treatment) => onChange({ ...filters, treatment }),
          masked
        )}
        {request.factors.map((factor) =>
          field(
            `factor-${factor.id}`,
            sanitizeDisplayLabel(factor.label || factor.code),
            filters.factors?.[factor.id],
            (text) =>
              onChange({
                ...filters,
                factors: { ...filters.factors, [factor.id]: text },
              })
          )
        )}
      </div>
      {masked && (
        <p className="text-xs text-slate-400">
          Treatment filtering and sorting are off while treatment is masked.
        </p>
      )}
      <button
        type="button"
        className={`${BUTTON} min-w-12`}
        disabled={!any}
        onClick={() => onChange({})}
      >
        Clear filters
      </button>
    </fieldset>
  );
}

function SortHeader({
  label,
  column,
  sort,
  disabled,
  onSort,
}: {
  readonly label: string;
  readonly column: AllocationSortColumn;
  readonly sort: AllocationSort | null;
  readonly disabled?: boolean;
  readonly onSort: (sort: AllocationSort | null) => void;
}) {
  const active = sort?.column === column ? sort.direction : null;
  return (
    <th
      scope="col"
      aria-sort={active ?? "none"}
      className="px-2 py-1 font-medium"
    >
      <button
        type="button"
        disabled={disabled}
        className="inline-flex min-h-11 min-w-11 items-center gap-1 rounded px-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400 disabled:cursor-default active:scale-[0.98]"
        onClick={() => onSort(nextSort(sort, column))}
      >
        {label}
        <span aria-hidden="true" className="text-slate-500">
          {active === "ascending" ? "▲" : active === "descending" ? "▼" : "↕"}
        </span>
      </button>
    </th>
  );
}

/**
 * The flat allocation table (RND-RESUL-001). It renders one bounded page,
 * never a DOM row per allocation, in generated order unless a column sort
 * is chosen. Treatment is shown through the disclosure presentation.
 */
export function AllocationTable({
  request,
  page,
  presentation,
  sort,
  busy,
  onSort,
  onOffset,
}: {
  readonly request: RandomizationRequest;
  readonly page: AllocationQueryPage;
  readonly presentation: ResolvedPresentation;
  readonly sort: AllocationSort | null;
  readonly busy: boolean;
  readonly onSort: (sort: AllocationSort | null) => void;
  readonly onOffset: (offset: number) => void;
}) {
  const blocks = request.method === "BLOCK";
  const arms = new Map(
    request.arms.map((arm) => [
      arm.id,
      sanitizeDisplayLabel(arm.label || arm.code),
    ])
  );
  const sites = new Map(
    request.sites.map((s) => [s.id, sanitizeDisplayLabel(s.label || s.code)])
  );
  const levels = new Map(
    request.factors.map((f) => [
      f.id,
      new Map(
        f.levels.map((l) => [l.id, sanitizeDisplayLabel(l.label || l.code)])
      ),
    ])
  );
  const rows = presentAllocationRows(page.rows, presentation);
  return (
    <div className="space-y-2">
      <div
        className="max-h-[32rem] overflow-auto rounded border border-white/[0.08] focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"
        aria-busy={busy}
        role="region"
        aria-label="Allocation rows"
        tabIndex={0}
      >
        <table className="w-full min-w-0 text-left text-sm">
          <caption className="sr-only">
            Allocations {page.matchingRows === 0 ? 0 : page.offset + 1} to{" "}
            {page.offset + page.rows.length} of {page.matchingRows} matching
            rows ({page.totalRows} in the schedule)
          </caption>
          <thead className="bg-[#13151a]">
            <tr>
              <SortHeader
                label="Seq"
                column="sequence"
                sort={sort}
                onSort={onSort}
              />
              <SortHeader
                label="Subject"
                column="subjectId"
                sort={sort}
                onSort={onSort}
              />
              <SortHeader
                label="Site"
                column="site"
                sort={sort}
                onSort={onSort}
              />
              {request.factors.map((factor) => (
                <SortHeader
                  key={factor.id}
                  label={sanitizeDisplayLabel(factor.label || factor.code)}
                  column={`factor:${factor.id}`}
                  sort={sort}
                  onSort={onSort}
                />
              ))}
              {blocks && (
                <SortHeader
                  label="Block"
                  column="block"
                  sort={sort}
                  onSort={onSort}
                />
              )}
              <SortHeader
                label="Arm"
                column="treatment"
                sort={sort}
                disabled={presentation.maskTreatment}
                onSort={onSort}
              />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.sequence} className="border-t border-white/[0.08]">
                <td className={`${MONO} px-3 py-1`}>{row.sequence}</td>
                <td className={`${MONO} break-all px-3 py-1`}>
                  {row.subjectId}
                </td>
                <td className="px-3 py-1">
                  {sites.get(row.siteId) ?? row.siteId}
                </td>
                {request.factors.map((factor) => {
                  const levelId = row.stratumLevels[factor.id] ?? "";
                  return (
                    <td key={factor.id} className="px-3 py-1">
                      {levels.get(factor.id)?.get(levelId) ?? levelId}
                    </td>
                  );
                })}
                {blocks && (
                  <td className={`${MONO} px-3 py-1`}>
                    {row.blockIndex ?? "—"}
                    {row.blockSize !== null && (
                      <span className="text-slate-400">
                        {" "}
                        / size {row.blockSize}
                      </span>
                    )}
                  </td>
                )}
                <td className="px-3 py-1">
                  {presentation.maskTreatment
                    ? row.armCode
                    : (arms.get(row.armId) ?? row.armCode)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager
        label="rows"
        offset={page.offset}
        count={page.rows.length}
        total={page.matchingRows}
        onOffset={onOffset}
      />
    </div>
  );
}

/**
 * The grouped view (RND-RESUL-002): one row per block, keyed by site,
 * structural stratum key and block number, so equal display labels never
 * merge. Partial tails say so. Minimization has no blocks; its groups are
 * site and stratum cells.
 */
export function BlockGroupTable({
  request,
  page,
  masked,
  busy,
  onOffset,
}: {
  readonly request: RandomizationRequest;
  readonly page: AllocationBlockGroupPage;
  readonly masked: boolean;
  readonly busy: boolean;
  readonly onOffset: (offset: number) => void;
}) {
  const cells = page.cellsNotBlocks;
  return (
    <div className="space-y-2">
      {cells && (
        <p className="text-sm text-slate-300">
          Minimization assigns one subject at a time, so there are no blocks.
          Rows are grouped by site and stratum instead.
        </p>
      )}
      <div
        className="max-h-[32rem] overflow-auto rounded border border-white/[0.08] focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"
        aria-busy={busy}
        role="region"
        aria-label={cells ? "Site and stratum groups" : "Blocks"}
        tabIndex={0}
      >
        <table className="w-full min-w-0 text-left text-sm">
          <caption className="sr-only">
            {cells ? "Site and stratum groups" : "Blocks"}{" "}
            {page.totalGroups === 0 ? 0 : page.offset + 1} to{" "}
            {page.offset + page.groups.length} of {page.totalGroups}
          </caption>
          <thead className="bg-[#13151a]">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">
                Site
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Stratum
              </th>
              {!cells && (
                <th scope="col" className="px-3 py-2 font-medium">
                  Block
                </th>
              )}
              <th scope="col" className="px-3 py-2 font-medium">
                {cells ? "Rows" : "Filled"}
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Matching
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Arms
              </th>
            </tr>
          </thead>
          <tbody>
            {page.groups.map((group) => (
              <tr key={group.key} className="border-t border-white/[0.08]">
                <td className="px-3 py-1">{group.siteLabel}</td>
                <td className="px-3 py-1">{group.stratumLabel}</td>
                {!cells && (
                  <td className={`${MONO} px-3 py-1`}>{group.blockIndex}</td>
                )}
                <td className={`${MONO} px-3 py-1`}>
                  {cells
                    ? group.filled
                    : `${group.filled} of ${group.blockSize ?? "?"}`}
                  {!group.complete && (
                    <span className="ml-1 rounded border border-amber-500/40 px-1 text-xs text-amber-200">
                      partial
                    </span>
                  )}
                </td>
                <td className={`${MONO} px-3 py-1`}>{group.matching}</td>
                <td className={`${MONO} px-3 py-1`}>
                  {masked || !group.armCounts
                    ? "Masked"
                    : request.arms
                        .map(
                          (arm, i) => `${arm.code} ${group.armCounts?.[i] ?? 0}`
                        )
                        .join(" · ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager
        label={cells ? "groups" : "blocks"}
        offset={page.offset}
        count={page.groups.length}
        total={page.totalGroups}
        onOffset={onOffset}
      />
    </div>
  );
}
