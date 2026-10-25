/**
 * Central statistical monitoring (#2631): each site of a study tested
 * against its peers, the study's other sites, on gold data only. Every
 * test is one-sided in the direction that points at a data integrity or
 * reporting problem, and the study's p-values are adjusted together by
 * Benjamini-Hochberg, so the false discovery rate holds across sites and
 * tests at once.
 *
 * Each test compares like with like. Sites differ legitimately in how fast
 * they enter data, so no test asks a site to match its peers' entry lag;
 * the schedule and the query and deviation rates are the study's own, so
 * those are what a site is held to.
 */
import type {
  CsmExclusion,
  CsmResult,
  CsmRun,
  Warehouse,
  WarehouseRow,
} from "../../types";
import { CSM_TESTS } from "./library";
import {
  benjaminiHochberg,
  fCdf,
  invertMatrix,
  mean,
  poissonCdf,
} from "./stats";

/** Entered visits a site needs before it is tested. */
export const CSM_MIN_SITE_VISITS = 10;
/** Sites with enough data a study needs before its sites are tested against each other. */
export const CSM_MIN_SITES = 6;
/** The default false discovery rate. */
export const CSM_DEFAULT_FDR = 0.05;

/** Measures in the KRI profile, in vector order. */
const PROFILE_MEASURES = 4;

interface SiteData {
  readonly siteId: string;
  /** Visits made, entered or not. */
  readonly visits: number;
  /** Visits whose data was entered. */
  readonly entered: number;
  readonly queries: number;
  readonly deviations: number;
  /** Entry lags in days of the entered visits. */
  readonly lags: readonly number[];
  /** Visits made to planned visits that have a window, by planned visit. */
  readonly scheduled: ReadonlyMap<string, number>;
  /** Of those, the visits made exactly on their planned day. */
  readonly onDay: ReadonlyMap<string, number>;
}

interface Draft {
  readonly testId: string;
  readonly siteId: string;
  readonly n: number;
  readonly statistic: number;
  readonly pValue: number;
  readonly detail: string;
}

interface Tally {
  visits: number;
  entered: number;
  queries: number;
  deviations: number;
  lags: number[];
  offsets: { plannedVisit: string; offset: number }[];
}

const num = (row: WarehouseRow, column: string): number | null => {
  const value = row[column];
  return typeof value === "number" ? value : null;
};

const fixed = (value: number, digits = 1) => value.toFixed(digits);
const clamp01 = (p: number) => (p < 0 ? 0 : p > 1 ? 1 : p);
const sum = (values: Iterable<number>) => {
  let total = 0;
  for (const v of values) total += v;
  return total;
};
const add = (map: Map<string, number>, key: string, by = 1) =>
  map.set(key, (map.get(key) ?? 0) + by);

/** Gathers what the tests read, per site of one study. */
function siteData(warehouse: Warehouse, studyKey: number): SiteData[] {
  const siteIdOf = new Map<unknown, string>(
    warehouse.tables["gold.dim_site"].map((s) => [
      s.site_key,
      String(s.site_id),
    ])
  );
  const tallies = new Map<string, Tally>();
  const of = (siteKey: unknown): Tally => {
    const siteId = siteIdOf.get(siteKey);
    if (siteId === undefined) throw new Error(`unknown site key ${siteKey}`);
    let tally = tallies.get(siteId);
    if (tally === undefined) {
      tally = {
        visits: 0,
        entered: 0,
        queries: 0,
        deviations: 0,
        lags: [],
        offsets: [],
      };
      tallies.set(siteId, tally);
    }
    return tally;
  };
  // A planned visit that is never off its planned day anywhere in the study
  // (screening, the anchor visit) has no window, so it says nothing about
  // how a site keeps to its schedule.
  const windowed = new Set<string>();
  for (const visit of warehouse.tables["gold.fct_visit"]) {
    if (visit.study_key !== studyKey || visit.visit_status === "missed")
      continue;
    const tally = of(visit.site_key);
    tally.visits += 1;
    const plannedVisit = String(visit.planned_visit_id);
    const offset = num(visit, "day_offset");
    if (offset !== null) {
      tally.offsets.push({ plannedVisit, offset });
      if (offset !== 0) windowed.add(plannedVisit);
    }
    const lag = num(visit, "entry_lag_days");
    if (lag !== null) {
      tally.entered += 1;
      tally.lags.push(lag);
    }
  }
  for (const query of warehouse.tables["gold.fct_query"]) {
    if (query.study_key === studyKey) of(query.site_key).queries += 1;
  }
  for (const deviation of warehouse.tables["gold.fct_deviation"]) {
    if (deviation.study_key === studyKey)
      of(deviation.site_key).deviations += 1;
  }
  return [...tallies.entries()]
    .map(([siteId, tally]) => {
      const scheduled = new Map<string, number>();
      const onDay = new Map<string, number>();
      for (const { plannedVisit, offset } of tally.offsets) {
        if (!windowed.has(plannedVisit)) continue;
        add(scheduled, plannedVisit);
        if (offset === 0) add(onDay, plannedVisit);
      }
      return {
        siteId,
        visits: tally.visits,
        entered: tally.entered,
        queries: tally.queries,
        deviations: tally.deviations,
        lags: tally.lags,
        scheduled,
        onDay,
      };
    })
    .sort((a, b) => (a.siteId < b.siteId ? -1 : 1));
}

/** A count against the peer rate times the site's exposure, lower tail. */
function underReporting(
  testId: string,
  site: SiteData,
  peers: readonly SiteData[],
  count: (s: SiteData) => number,
  exposure: (s: SiteData) => number,
  [one, many]: readonly [string, string],
  per: string
): Draft | CsmExclusion {
  const peerCount = sum(peers.map(count));
  const peerExposure = sum(peers.map(exposure));
  if (peerCount === 0 || peerExposure === 0) {
    return {
      siteId: site.siteId,
      testId,
      reason: `The site's peers report no ${many}, so there is no rate to compare against.`,
    };
  }
  const rate = peerCount / peerExposure;
  const expected = rate * exposure(site);
  const observed = count(site);
  return {
    testId,
    siteId: site.siteId,
    n: exposure(site),
    statistic: observed,
    pValue: clamp01(poissonCdf(observed, expected)),
    detail: `${observed} ${observed === 1 ? one : many} over ${exposure(site)} ${per}; the peer rate of ${fixed(rate * 100)} per 100 predicts ${fixed(expected)}.`,
  };
}

/**
 * Visits on their exact planned day against the peers' rate for each
 * planned visit, upper tail. The Poisson tail is conservative for a sum of
 * Bernoulli trials: its variance is the mean, which is more than theirs.
 */
function exactDayVisits(
  testId: string,
  site: SiteData,
  peers: readonly SiteData[]
): Draft | CsmExclusion {
  let expected = 0;
  let observed = 0;
  let n = 0;
  for (const [plannedVisit, count] of site.scheduled) {
    const peerVisits = sum(
      peers.map((p) => p.scheduled.get(plannedVisit) ?? 0)
    );
    if (peerVisits === 0) continue;
    const peerOnDay = sum(peers.map((p) => p.onDay.get(plannedVisit) ?? 0));
    expected += (count * peerOnDay) / peerVisits;
    observed += site.onDay.get(plannedVisit) ?? 0;
    n += count;
  }
  if (n === 0) {
    return {
      siteId: site.siteId,
      testId,
      reason:
        "The site has made no visits with a window that its peers also made.",
    };
  }
  const pValue = observed === 0 ? 1 : 1 - poissonCdf(observed - 1, expected);
  return {
    testId,
    siteId: site.siteId,
    n,
    statistic: observed,
    pValue: clamp01(pValue),
    detail: `${observed} of ${n} scheduled visits on their exact planned day; the peers' rates predict ${fixed(expected)}.`,
  };
}

/** Share of the site's scheduled visits made on their exact planned day. */
function onDayShare(site: SiteData): number {
  const n = sum(site.scheduled.values());
  return n === 0 ? 0 : sum(site.onDay.values()) / n;
}

function profile(site: SiteData): number[] {
  return [
    site.queries / site.entered,
    site.deviations / site.visits,
    mean(site.lags) ?? 0,
    onDayShare(site),
  ];
}

/** Hotelling's T² for one new observation against its peers, upper tail. */
function kriProfile(
  testId: string,
  site: SiteData,
  peers: readonly SiteData[]
): Draft | CsmExclusion {
  const n = peers.length;
  const k = PROFILE_MEASURES;
  if (n < k + 2) {
    return {
      siteId: site.siteId,
      testId,
      reason: `A ${k}-measure profile needs at least ${k + 2} peer sites; the site has ${n}.`,
    };
  }
  const rows = peers.map(profile);
  const centre = Array.from(
    { length: k },
    (_, j) => sum(rows.map((r) => r[j])) / n
  );
  const covariance = Array.from({ length: k }, (_, a) =>
    Array.from(
      { length: k },
      (_, b) =>
        sum(rows.map((r) => (r[a] - centre[a]) * (r[b] - centre[b]))) / (n - 1)
    )
  );
  const inverse = invertMatrix(covariance);
  if (inverse === null) {
    return {
      siteId: site.siteId,
      testId,
      reason:
        "The peers' measures are collinear, so the profile's covariance has no inverse.",
    };
  }
  const delta = profile(site).map((v, j) => v - centre[j]);
  const distance = Math.max(
    0,
    sum(
      delta.map((da, a) => sum(delta.map((db, b) => da * inverse[a][b] * db)))
    )
  );
  const f = (distance * n * (n - k)) / ((n + 1) * (n - 1) * k);
  return {
    testId,
    siteId: site.siteId,
    n: site.visits,
    statistic: distance,
    pValue: clamp01(1 - fCdf(f, k, n - k)),
    detail: `Mahalanobis distance ${fixed(Math.sqrt(distance), 2)} from the mean of ${n} peer sites.`,
  };
}

const isExclusion = (d: Draft | CsmExclusion): d is CsmExclusion =>
  "reason" in d;

/**
 * Runs the central statistical monitoring tests on one study's sites.
 *
 * @param warehouse - A warehouse from `buildWarehouse`.
 * @param studyId - The study to monitor.
 * @param fdr - False discovery rate, above 0 and below 1.
 * @returns Every test at every site with enough data, with what was left out and why.
 * @throws RangeError when `fdr` is outside (0, 1); Error for an unknown study.
 */
export function centralMonitoring(
  warehouse: Warehouse,
  studyId: string,
  fdr: number = CSM_DEFAULT_FDR
): CsmRun {
  if (!(fdr > 0 && fdr < 1)) {
    throw new RangeError(`fdr must be between 0 and 1, got ${fdr}`);
  }
  const study = warehouse.tables["gold.dim_study"].find(
    (s) => s.study_id === studyId
  );
  if (study === undefined) throw new Error(`unknown study ${studyId}`);
  const all = siteData(warehouse, Number(study.study_key));
  const excluded: CsmExclusion[] = [];
  const eligible = all.filter((site) => {
    if (site.entered >= CSM_MIN_SITE_VISITS) return true;
    excluded.push({
      siteId: site.siteId,
      testId: null,
      reason: `${site.entered} entered visits; a site needs ${CSM_MIN_SITE_VISITS} to be tested.`,
    });
    return false;
  });
  if (eligible.length < CSM_MIN_SITES) {
    excluded.push({
      siteId: null,
      testId: null,
      reason: `${eligible.length} sites have enough data; comparing sites with each other needs at least ${CSM_MIN_SITES}.`,
    });
    return { fdr, sites: [], results: [], excluded };
  }

  const drafts: Draft[] = [];
  for (const site of eligible) {
    const peers = eligible.filter((p) => p !== site);
    const outcomes = [
      underReporting(
        "csm-query-under-reporting",
        site,
        peers,
        (s) => s.queries,
        (s) => s.entered,
        ["query", "queries"],
        "entered visits"
      ),
      underReporting(
        "csm-deviation-under-reporting",
        site,
        peers,
        (s) => s.deviations,
        (s) => s.visits,
        ["deviation", "deviations"],
        "visits"
      ),
      exactDayVisits("csm-exact-day-visits", site, peers),
      kriProfile("csm-kri-profile", site, peers),
    ];
    for (const outcome of outcomes) {
      if (isExclusion(outcome)) excluded.push(outcome);
      else drafts.push(outcome);
    }
  }

  const order = new Map(CSM_TESTS.map((t, i) => [t.id, i]));
  const q = benjaminiHochberg(drafts.map((d) => d.pValue));
  const results: CsmResult[] = drafts
    .map((d, i) => ({ ...d, qValue: q[i], flagged: q[i] <= fdr }))
    .sort(
      (a, b) =>
        (a.siteId < b.siteId ? -1 : a.siteId > b.siteId ? 1 : 0) ||
        order.get(a.testId)! - order.get(b.testId)!
    );
  return {
    fdr,
    sites: eligible.map((s) => s.siteId),
    results,
    excluded,
  };
}
