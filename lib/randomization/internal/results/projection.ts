/**
 * Read-only projections over one immutable allocation result (#4008,
 * RND-RESUL-001 to RND-RESUL-010, RND-EXPER-004).
 *
 * Every function here reads the generated rows and never changes them.
 * Filters and sorting change what a view shows, not the schedule, so the
 * canonical export and the content digest always cover every row.
 *
 * The filter projection is the same for every view. A row is shown when it
 * passes every column filter and the one chart (category) filter:
 * - the flat table pages the matching rows, in generated order unless a
 *   sort is chosen;
 * - the grouped view lists each block (site, structural stratum key and
 *   block number) that holds at least one matching row, with the block's
 *   own size and fill taken from the whole schedule;
 * - categorical counts are counted over the matching rows.
 * The balance report always covers the whole schedule, because balance is
 * a property of the allocation, not of a display filter.
 *
 * Masking is enforced here as well as in the page: while treatment is
 * masked, treatment filters, treatment sorting and the treatment category
 * are ignored, and per-arm counts are left out, so no projection can show
 * which rows share an arm.
 */
import { clamp } from "@/lib/utils";
import type { AllocationRow, RandomizationRequest } from "../../types";
import { sanitizeDisplayLabel } from "../disclosure/policy";

/** Longest filter text a query may carry. */
export const MAX_RESULT_FILTER_LENGTH = 120;

/** Most grouped entries or balance cells one answer may carry. */
export const MAX_RESULT_GROUPS_PER_PAGE = 200;

/** A sortable column: a fixed one, or `factor:<factorId>`. */
export type AllocationSortColumn =
  | "sequence"
  | "subjectId"
  | "site"
  | "block"
  | "treatment"
  | `factor:${string}`;

/** A categorical dimension: a fixed one, or `factor:<factorId>`. */
export type AllocationCategoryDimension =
  "site" | "treatment" | "stratum" | `factor:${string}`;

/** Sorting on one column. No sort means generated order. */
export interface AllocationSort {
  readonly column: AllocationSortColumn;
  readonly direction: "ascending" | "descending";
}

/** Case-insensitive "contains" filters on the displayed text. */
export interface AllocationColumnFilters {
  readonly subjectId?: string;
  readonly site?: string;
  readonly treatment?: string;
  /** Keyed by factor ID. */
  readonly factors?: Readonly<Record<string, string>>;
}

/** The one filter a chart segment or legend item sets. Exact key match. */
export interface AllocationCategoryFilter {
  readonly dimension: AllocationCategoryDimension;
  readonly key: string;
}

/** What a view shows. Every field is optional. */
export interface AllocationQuery {
  readonly sort?: AllocationSort | null;
  readonly filters?: AllocationColumnFilters;
  readonly category?: AllocationCategoryFilter | null;
}

/** Options shared by every projection. */
export interface AllocationProjectionOptions {
  /** True while the display masks treatment. */
  readonly maskTreatment: boolean;
}

/** One page of the flat allocation table. */
export interface AllocationQueryPage {
  readonly offset: number;
  /** Rows in the whole schedule. */
  readonly totalRows: number;
  /** Rows that pass the query. */
  readonly matchingRows: number;
  readonly rows: readonly AllocationRow[];
  /** Query parts dropped because treatment is masked. */
  readonly ignored: readonly (
    "treatment-filter" | "treatment-sort" | "treatment-category"
  )[];
}

/** One block of the grouped view (or one site and stratum cell for minimization). */
export interface AllocationBlockGroup {
  /** Collision-free key: JSON of [siteId, stratumKey, blockIndex]. */
  readonly key: string;
  readonly siteId: string;
  readonly siteLabel: string;
  readonly stratumKey: string;
  readonly stratumLabel: string;
  /** Null for minimization, which has no blocks. */
  readonly blockIndex: number | null;
  readonly blockSize: number | null;
  /** Rows the block holds in the whole schedule. */
  readonly filled: number;
  /** Rows of the block that pass the query. */
  readonly matching: number;
  /** False when a block holds fewer rows than its size (a partial tail). */
  readonly complete: boolean;
  readonly firstSequence: number;
  /** Rows per arm in plan order; null while treatment is masked. */
  readonly armCounts: readonly number[] | null;
}

/** One page of the grouped view. */
export interface AllocationBlockGroupPage {
  readonly offset: number;
  readonly totalGroups: number;
  readonly groups: readonly AllocationBlockGroup[];
  /** True for minimization: groups are site and stratum cells, not blocks. */
  readonly cellsNotBlocks: boolean;
}

/** One entry of a categorical summary. */
export interface AllocationCategoryEntry {
  readonly key: string;
  readonly label: string;
  readonly count: number;
  /** Share of the matching rows, 0 to 100. */
  readonly percent: number;
}

/** Counts of one dimension over the matching rows. */
export interface AllocationCategorySummary {
  readonly dimension: AllocationCategoryDimension;
  readonly label: string;
  readonly entries: readonly AllocationCategoryEntry[];
  /** True when masking collapsed every arm into one entry. */
  readonly masked: boolean;
}

/** Actual and planned rows for one arm in one group. */
export interface ArmBalance {
  readonly armId: string;
  readonly label: string;
  readonly actual: number;
  /** Group size times ratio over total ratio. Can be fractional. */
  readonly target: number;
  readonly difference: number;
}

/** Balance for one group (the study, a site, or a site and stratum cell). */
export interface BalanceGroup {
  readonly key: string;
  readonly label: string;
  readonly total: number;
  /** Null while treatment is masked. */
  readonly arms: readonly ArmBalance[] | null;
  /** Blocks in this group that hold fewer rows than their size. */
  readonly partialBlocks: number;
}

/** Arm totals for one factor level (minimization margins). */
export interface MarginalBalanceGroup extends BalanceGroup {
  readonly factorId: string;
  readonly levelId: string;
}

/** The descriptive balance report over the whole schedule. */
export interface AllocationBalanceReport {
  readonly method: RandomizationRequest["method"];
  readonly ratios: readonly number[];
  readonly global: BalanceGroup;
  readonly sites: readonly BalanceGroup[];
  readonly intersections: readonly BalanceGroup[];
  /** Site and stratum cells left out of `intersections` by the page bound. */
  readonly intersectionsOmitted: number;
  /** Minimization only: arm totals per factor level. Empty for blocks. */
  readonly marginals: readonly MarginalBalanceGroup[];
  readonly masked: boolean;
}

/** Categorical counts over the matching rows plus the whole-schedule balance. */
export interface AllocationSummaryProjection {
  readonly totalRows: number;
  readonly matchingRows: number;
  readonly categories: readonly AllocationCategorySummary[];
  readonly balance: AllocationBalanceReport;
}

interface Labels {
  readonly site: ReadonlyMap<string, string>;
  readonly arm: ReadonlyMap<string, string>;
  readonly armIndex: ReadonlyMap<string, number>;
  readonly level: ReadonlyMap<string, ReadonlyMap<string, string>>;
}

const labelCache = new WeakMap<RandomizationRequest, Labels>();

function labelsOf(request: RandomizationRequest): Labels {
  const cached = labelCache.get(request);
  if (cached) return cached;
  const labels: Labels = {
    site: new Map(
      request.sites.map((s) => [s.id, sanitizeDisplayLabel(s.label || s.code)])
    ),
    arm: new Map(
      request.arms.map((a) => [a.id, sanitizeDisplayLabel(a.label || a.code)])
    ),
    armIndex: new Map(request.arms.map((a, i) => [a.id, i])),
    level: new Map(
      request.factors.map((f) => [
        f.id,
        new Map(
          f.levels.map((l) => [l.id, sanitizeDisplayLabel(l.label || l.code)])
        ),
      ])
    ),
  };
  labelCache.set(request, labels);
  return labels;
}

function siteLabel(labels: Labels, siteId: string): string {
  return labels.site.get(siteId) ?? siteId;
}

function levelLabel(labels: Labels, factorId: string, levelId: string): string {
  return labels.level.get(factorId)?.get(levelId) ?? levelId;
}

/** Display label of a row's stratum, from its own levels in factor order. */
function stratumLabel(
  request: RandomizationRequest,
  labels: Labels,
  row: AllocationRow
): string {
  if (request.factors.length === 0) return "All participants";
  return request.factors
    .map((f) => levelLabel(labels, f.id, row.stratumLevels[f.id] ?? ""))
    .join(" / ");
}

function bounded(text: string | undefined): string {
  return (text ?? "").trim().slice(0, MAX_RESULT_FILTER_LENGTH).toLowerCase();
}

function contains(haystack: readonly string[], needle: string): boolean {
  return haystack.some((value) => value.toLowerCase().includes(needle));
}

function factorIdOf(value: string): string | null {
  return value.startsWith("factor:") ? value.slice("factor:".length) : null;
}

/** Builds the row test for a query, honoring the mask. */
function compileFilter(
  request: RandomizationRequest,
  query: AllocationQuery,
  options: AllocationProjectionOptions
): {
  readonly test: (row: AllocationRow) => boolean;
  readonly ignored: AllocationQueryPage["ignored"][number][];
} {
  const labels = labelsOf(request);
  const ignored: AllocationQueryPage["ignored"][number][] = [];
  const subject = bounded(query.filters?.subjectId);
  const site = bounded(query.filters?.site);
  let treatment = bounded(query.filters?.treatment);
  if (treatment && options.maskTreatment) {
    ignored.push("treatment-filter");
    treatment = "";
  }
  const factorFilters = Object.entries(query.filters?.factors ?? {})
    .map(([factorId, text]) => [factorId, bounded(text)] as const)
    .filter(([factorId, text]) => text && labels.level.has(factorId));
  let category = query.category ?? null;
  if (category?.dimension === "treatment" && options.maskTreatment) {
    ignored.push("treatment-category");
    category = null;
  }
  const categoryFactor = category ? factorIdOf(category.dimension) : null;
  const armCode = new Map(request.arms.map((a) => [a.id, a.code]));
  const siteCode = new Map(request.sites.map((s) => [s.id, s.code]));
  const levelCode = new Map(
    request.factors.map((f) => [
      f.id,
      new Map(f.levels.map((l) => [l.id, l.code])),
    ])
  );

  const test = (row: AllocationRow): boolean => {
    if (subject && !row.subjectId.toLowerCase().includes(subject)) return false;
    if (
      site &&
      !contains(
        [siteLabel(labels, row.siteId), siteCode.get(row.siteId) ?? row.siteId],
        site
      )
    ) {
      return false;
    }
    if (
      treatment &&
      !contains(
        [
          labels.arm.get(row.armId) ?? row.armId,
          armCode.get(row.armId) ?? row.armCode,
        ],
        treatment
      )
    ) {
      return false;
    }
    for (const [factorId, text] of factorFilters) {
      const levelId = row.stratumLevels[factorId] ?? "";
      if (
        !contains(
          [
            levelLabel(labels, factorId, levelId),
            levelCode.get(factorId)?.get(levelId) ?? levelId,
          ],
          text
        )
      ) {
        return false;
      }
    }
    if (category) {
      if (category.dimension === "site" && row.siteId !== category.key) {
        return false;
      }
      if (category.dimension === "treatment" && row.armId !== category.key) {
        return false;
      }
      if (category.dimension === "stratum" && row.stratumKey !== category.key) {
        return false;
      }
      if (
        categoryFactor !== null &&
        (row.stratumLevels[categoryFactor] ?? "") !== category.key
      ) {
        return false;
      }
    }
    return true;
  };
  return { test, ignored };
}

const collator = new Intl.Collator("en", {
  numeric: true,
  sensitivity: "base",
});

function sortKey(
  labels: Labels,
  column: AllocationSortColumn
): ((row: AllocationRow) => string | number) | null {
  switch (column) {
    case "sequence":
      return (row) => row.sequence;
    case "subjectId":
      return (row) => row.subjectId;
    case "site":
      return (row) => siteLabel(labels, row.siteId);
    case "block":
      return (row) => row.blockIndex ?? 0;
    case "treatment":
      return (row) => labels.armIndex.get(row.armId) ?? -1;
    default: {
      const factorId = factorIdOf(column);
      if (factorId === null || !labels.level.has(factorId)) return null;
      return (row) =>
        levelLabel(labels, factorId, row.stratumLevels[factorId] ?? "");
    }
  }
}

/**
 * Applies a query and returns one bounded page of matching rows. Without a
 * sort the rows keep their generated order; a sort is stable and breaks
 * ties by sequence, so clearing it restores the original order.
 */
export function queryAllocationRows(
  request: RandomizationRequest,
  rows: readonly AllocationRow[],
  query: AllocationQuery,
  window: { readonly offset: number; readonly limit: number },
  options: AllocationProjectionOptions
): AllocationQueryPage {
  const { test, ignored } = compileFilter(request, query, options);
  let matching = rows.filter(test);
  let sort = query.sort ?? null;
  if (sort?.column === "treatment" && options.maskTreatment) {
    ignored.push("treatment-sort");
    sort = null;
  }
  if (sort) {
    const key = sortKey(labelsOf(request), sort.column);
    if (key) {
      const sign = sort.direction === "descending" ? -1 : 1;
      matching = matching
        .map((row) => ({ row, k: key(row) }))
        .sort((a, b) => {
          const order =
            typeof a.k === "number" && typeof b.k === "number"
              ? a.k - b.k
              : collator.compare(String(a.k), String(b.k));
          return order !== 0 ? sign * order : a.row.sequence - b.row.sequence;
        })
        .map((entry) => entry.row);
    }
  }
  const offset = clamp(window.offset, 0, matching.length);
  return {
    offset,
    totalRows: rows.length,
    matchingRows: matching.length,
    rows: matching.slice(offset, offset + Math.max(0, window.limit)),
    ignored,
  };
}

interface MutableGroup {
  key: string;
  siteId: string;
  stratumKey: string;
  stratumLabel: string;
  blockIndex: number | null;
  blockSize: number | null;
  filled: number;
  matching: number;
  firstSequence: number;
  armCounts: number[];
}

function groupKey(row: AllocationRow, blocks: boolean): string {
  return JSON.stringify([
    row.siteId,
    row.stratumKey,
    blocks ? (row.blockIndex ?? 0) : null,
  ]);
}

function collectGroups(
  request: RandomizationRequest,
  rows: readonly AllocationRow[],
  test: (row: AllocationRow) => boolean
): MutableGroup[] {
  const labels = labelsOf(request);
  const blocks = request.method === "BLOCK";
  const groups = new Map<string, MutableGroup>();
  for (const row of rows) {
    const key = groupKey(row, blocks);
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        siteId: row.siteId,
        stratumKey: row.stratumKey,
        stratumLabel: stratumLabel(request, labels, row),
        blockIndex: blocks ? row.blockIndex : null,
        blockSize: blocks ? row.blockSize : null,
        filled: 0,
        matching: 0,
        firstSequence: row.sequence,
        armCounts: request.arms.map(() => 0),
      };
      groups.set(key, group);
    }
    group.filled += 1;
    if (test(row)) group.matching += 1;
    const arm = labels.armIndex.get(row.armId);
    if (arm !== undefined) group.armCounts[arm] += 1;
  }
  return [...groups.values()];
}

/**
 * Groups rows by site, structural stratum key and block number, in order of
 * each block's first row. The key is the structural one, so two strata with
 * the same display abbreviation never merge. Minimization has no blocks, so
 * its groups are site and stratum cells.
 */
export function groupAllocationBlocks(
  request: RandomizationRequest,
  rows: readonly AllocationRow[],
  query: AllocationQuery,
  window: { readonly offset: number; readonly limit: number },
  options: AllocationProjectionOptions
): AllocationBlockGroupPage {
  const { test } = compileFilter(request, query, options);
  const labels = labelsOf(request);
  const shown = collectGroups(request, rows, test).filter(
    (g) => g.matching > 0
  );
  const limit = clamp(window.limit, 0, MAX_RESULT_GROUPS_PER_PAGE);
  const offset = clamp(window.offset, 0, shown.length);
  return {
    offset,
    totalGroups: shown.length,
    cellsNotBlocks: request.method !== "BLOCK",
    groups: shown.slice(offset, offset + limit).map((g) => ({
      key: g.key,
      siteId: g.siteId,
      siteLabel: siteLabel(labels, g.siteId),
      stratumKey: g.stratumKey,
      stratumLabel: g.stratumLabel,
      blockIndex: g.blockIndex,
      blockSize: g.blockSize,
      filled: g.filled,
      matching: g.matching,
      complete: g.blockSize === null || g.filled >= g.blockSize,
      firstSequence: g.firstSequence,
      armCounts: options.maskTreatment ? null : [...g.armCounts],
    })),
  };
}

function percent(count: number, total: number): number {
  return total === 0 ? 0 : Math.round((count / total) * 1000) / 10;
}

function categorize(
  dimension: AllocationCategoryDimension,
  label: string,
  rows: readonly AllocationRow[],
  keyOf: (row: AllocationRow) => string,
  order: readonly { readonly key: string; readonly label: string }[],
  labelOf: (key: string, row: AllocationRow) => string
): AllocationCategorySummary {
  const counts = new Map<string, { label: string; count: number }>();
  for (const entry of order)
    counts.set(entry.key, { label: entry.label, count: 0 });
  for (const row of rows) {
    const key = keyOf(row);
    const current = counts.get(key);
    if (current) current.count += 1;
    else counts.set(key, { label: labelOf(key, row), count: 1 });
  }
  return {
    dimension,
    label,
    masked: false,
    entries: [...counts.entries()]
      .filter(([, value]) => value.count > 0)
      .map(([key, value]) => ({
        key,
        label: value.label,
        count: value.count,
        percent: percent(value.count, rows.length),
      })),
  };
}

function armBalance(
  request: RandomizationRequest,
  labels: Labels,
  counts: readonly number[],
  total: number
): ArmBalance[] {
  const ratioTotal = request.arms.reduce(
    (sum, a) => sum + a.allocationRatio,
    0
  );
  return request.arms.map((arm, index) => {
    const target =
      ratioTotal > 0 ? (total * arm.allocationRatio) / ratioTotal : 0;
    return {
      armId: arm.id,
      label: labels.arm.get(arm.id) ?? arm.id,
      actual: counts[index] ?? 0,
      target,
      difference: (counts[index] ?? 0) - target,
    };
  });
}

interface Tally {
  key: string;
  label: string;
  total: number;
  counts: number[];
  partialBlocks: number;
}

function tally(
  map: Map<string, Tally>,
  key: string,
  label: string,
  arms: number
): Tally {
  let entry = map.get(key);
  if (!entry) {
    entry = {
      key,
      label,
      total: 0,
      counts: new Array<number>(arms).fill(0),
      partialBlocks: 0,
    };
    map.set(key, entry);
  }
  return entry;
}

/**
 * Builds categorical counts over the rows that pass the query, and the
 * balance report over the whole schedule. Targets are the group size times
 * each arm's ratio over the total ratio; the report states differences and
 * partial blocks and makes no pass or fail judgment.
 */
export function summarizeAllocationResults(
  request: RandomizationRequest,
  rows: readonly AllocationRow[],
  query: AllocationQuery,
  options: AllocationProjectionOptions
): AllocationSummaryProjection {
  const labels = labelsOf(request);
  const { test } = compileFilter(request, query, options);
  const matching = rows.filter(test);
  const masked = options.maskTreatment;

  const categories: AllocationCategorySummary[] = [
    categorize(
      "site",
      "Site",
      matching,
      (row) => row.siteId,
      request.sites.map((s) => ({ key: s.id, label: siteLabel(labels, s.id) })),
      (key) => siteLabel(labels, key)
    ),
  ];
  if (masked) {
    categories.push({
      dimension: "treatment",
      label: "Treatment",
      masked: true,
      entries:
        matching.length > 0
          ? [
              {
                key: "Blinded",
                label: "Blinded",
                count: matching.length,
                percent: 100,
              },
            ]
          : [],
    });
  } else {
    categories.push(
      categorize(
        "treatment",
        "Treatment",
        matching,
        (row) => row.armId,
        request.arms.map((a) => ({
          key: a.id,
          label: labels.arm.get(a.id) ?? a.id,
        })),
        (key) => labels.arm.get(key) ?? key
      )
    );
  }
  if (request.factors.length > 0) {
    categories.push(
      categorize(
        "stratum",
        "Stratum",
        matching,
        (row) => row.stratumKey,
        [],
        (_key, row) => stratumLabel(request, labels, row)
      )
    );
  }
  for (const factor of request.factors) {
    categories.push(
      categorize(
        `factor:${factor.id}`,
        sanitizeDisplayLabel(factor.label || factor.code),
        matching,
        (row) => row.stratumLevels[factor.id] ?? "",
        factor.levels.map((l) => ({
          key: l.id,
          label: levelLabel(labels, factor.id, l.id),
        })),
        (key) => levelLabel(labels, factor.id, key)
      )
    );
  }

  // Balance covers the whole schedule.
  const armCount = request.arms.length;
  const global = tally(new Map(), "all", "All sites", armCount);
  const sites = new Map<string, Tally>();
  for (const site of request.sites) {
    tally(sites, site.id, siteLabel(labels, site.id), armCount);
  }
  const cells = new Map<string, Tally>();
  const marginals = new Map<
    string,
    Tally & { factorId: string; levelId: string }
  >();
  for (const row of rows) {
    const arm = labels.armIndex.get(row.armId);
    const site = tally(
      sites,
      row.siteId,
      siteLabel(labels, row.siteId),
      armCount
    );
    const cell = tally(
      cells,
      JSON.stringify([row.siteId, row.stratumKey]),
      `${siteLabel(labels, row.siteId)} · ${stratumLabel(request, labels, row)}`,
      armCount
    );
    for (const group of [global, site, cell]) {
      group.total += 1;
      if (arm !== undefined) group.counts[arm] += 1;
    }
    if (request.method === "MINIMIZATION") {
      for (const factor of request.factors) {
        const levelId = row.stratumLevels[factor.id] ?? "";
        const key = JSON.stringify([factor.id, levelId]);
        let entry = marginals.get(key);
        if (!entry) {
          entry = {
            ...tally(
              new Map(),
              key,
              `${sanitizeDisplayLabel(factor.label || factor.code)}: ${levelLabel(labels, factor.id, levelId)}`,
              armCount
            ),
            factorId: factor.id,
            levelId,
          };
          marginals.set(key, entry);
        }
        entry.total += 1;
        if (arm !== undefined) entry.counts[arm] += 1;
      }
    }
  }
  if (request.method === "BLOCK") {
    for (const group of collectGroups(request, rows, () => true)) {
      if (group.blockSize !== null && group.filled < group.blockSize) {
        global.partialBlocks += 1;
        const site = sites.get(group.siteId);
        if (site) site.partialBlocks += 1;
        const cell = cells.get(
          JSON.stringify([group.siteId, group.stratumKey])
        );
        if (cell) cell.partialBlocks += 1;
      }
    }
  }

  const present = (t: Tally): BalanceGroup => ({
    key: t.key,
    label: t.label,
    total: t.total,
    arms: masked ? null : armBalance(request, labels, t.counts, t.total),
    partialBlocks: t.partialBlocks,
  });
  const cellList = [...cells.values()];
  const marginalOrder = request.factors.flatMap((f) =>
    f.levels.map((l) => JSON.stringify([f.id, l.id]))
  );

  return {
    totalRows: rows.length,
    matchingRows: matching.length,
    categories,
    balance: {
      method: request.method,
      ratios: request.arms.map((a) => a.allocationRatio),
      global: present(global),
      sites: [...sites.values()].filter((s) => s.total > 0).map(present),
      intersections: cellList.slice(0, MAX_RESULT_GROUPS_PER_PAGE).map(present),
      intersectionsOmitted: Math.max(
        0,
        cellList.length - MAX_RESULT_GROUPS_PER_PAGE
      ),
      marginals: marginalOrder
        .map((key) => marginals.get(key))
        .filter((m): m is NonNullable<typeof m> => m !== undefined)
        .map((m) => ({
          ...present(m),
          factorId: m.factorId,
          levelId: m.levelId,
        })),
      masked,
    },
  };
}
