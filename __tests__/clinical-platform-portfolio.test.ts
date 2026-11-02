// @vitest-environment node
import { createHash } from "node:crypto";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_PORTFOLIO_SEED,
  STUDY_DATA_PRODUCT_ID,
  checkRegulatoryWording,
  generatePortfolio,
  type Portfolio,
  type SyntheticRecord,
} from "@/lib/clinical-platform";
import {
  DEFAULT_SEED,
  DEFAULT_SUBJECT_COUNT,
  DEMO_301_STUDY,
  STANDARD_VERSIONS,
  runPipeline,
  type Dataset,
} from "@/lib/study-data";
import { expectWithinTimingBudget } from "./helpers/timing-budget";

/**
 * SHA-256 of `JSON.stringify(generatePortfolio({ seed: DEFAULT_PORTFOLIO_SEED }))`.
 * A change to the generator, or to the Study Data Pipeline's DEMO-301 run,
 * that alters any record changes this hash. Update it deliberately, in the
 * same commit, together with `GOLDEN_SUMMARY`, and say why.
 *
 * #2706: the run's declared standards now come from the clinical standards
 * profile (USDM 4.0.0, plus ADaM OCCDS and ADaM Conformance Rules). No
 * record changed; the hash with the standards field left out is the same.
 *
 * #2879: every EDC subject carries a screen failure reason, drawn from a
 * stream of its own. No other value moved; the hash with
 * `screenFailureReason` left out is the previous golden, b4ab4b63.
 *
 * #2880: every site carries its start-up stages (`selectedOn`,
 * `contractedOn`, `irbApprovedOn`), drawn from a stream of their own. With
 * those left out the hash is the previous golden, 330b619a.
 *
 * #2912: the finance feed's budget plan (`feeds.financePlan`) is new. It
 * draws nothing from any stream; with it left out the hash is the previous
 * golden, a72bba8e, so no other value moved.
 *
 * #2956: the EDC feed carries adverse events (`feeds.edc.adverseEvents`),
 * drawn from a stream of their own, and the data integrity signal's
 * description says its site reports almost none. With the events left out
 * and the old description put back the hash is the previous golden,
 * 73ae03f5.
 *
 * #2957: the EDC feed carries vital signs (`feeds.edc.vitalSigns`), drawn
 * from a stream of their own, and the data integrity signal's description
 * says its site rounds them and they barely vary. With the readings left
 * out and the old description put back the hash is the previous golden,
 * e376174f.
 *
 * #2806: each DEMO-301 subject attends the site DM.SITEID names instead of
 * a drawn one, and a site is activated a week before its first consent
 * when the plan activates it later, so six of DEMO-301's eight sites
 * activate earlier. The site draws no longer consume the study's stream, so
 * DEMO-301's queries (220 to 239) and deviations (50 to 53) move with it.
 * No other study's records change.
 */
const GOLDEN_SHA256 =
  "4636edbaeacd1060a8eebc1dbedf74b40e3bb9c4edecbf2aa58c014b3ff12851";

/** The fictional controlled list screen failure reasons come from (#2879). */
const SCREEN_FAILURE_REASONS: readonly string[] = [
  "Inclusion criterion not met",
  "Exclusion criterion met",
  "Consent withdrawn",
  "Lost before randomisation",
  "Other",
];

/** Record counts per study for the default seed: the readable half of the golden. */
const GOLDEN_SUMMARY = {
  "DEMO-101": {
    status: "closed",
    sites: 3,
    screened: 72,
    enrolled: 48,
    visits: 354,
    queries: 131,
    deviations: 12,
    kits: 92,
    adverseEvents: 116,
    vitalSigns: 1384,
  },
  "DEMO-201": {
    status: "follow-up",
    sites: 14,
    screened: 249,
    enrolled: 180,
    visits: 1453,
    queries: 588,
    deviations: 39,
    kits: 863,
    adverseEvents: 455,
    vitalSigns: 5700,
  },
  "DEMO-202": {
    status: "follow-up",
    sites: 12,
    screened: 206,
    enrolled: 160,
    visits: 971,
    queries: 394,
    deviations: 44,
    kits: 467,
    adverseEvents: 280,
    vitalSigns: 3816,
  },
  "DEMO-203": {
    status: "follow-up",
    sites: 10,
    screened: 145,
    enrolled: 90,
    visits: 636,
    queries: 378,
    deviations: 18,
    kits: 435,
    adverseEvents: 196,
    vitalSigns: 2444,
  },
  "DEMO-301": {
    status: "closed",
    sites: 8,
    screened: 90,
    enrolled: 81,
    visits: 576,
    queries: 239,
    deviations: 53,
    kits: 366,
    adverseEvents: 0,
    vitalSigns: 0,
  },
  "DEMO-302": {
    status: "enrolling",
    sites: 36,
    screened: 514,
    enrolled: 350,
    visits: 2014,
    queries: 994,
    deviations: 93,
    kits: 1119,
    adverseEvents: 580,
    vitalSigns: 7812,
  },
  "DEV-401": {
    status: "closed",
    sites: 5,
    screened: 72,
    enrolled: 40,
    visits: 268,
    queries: 137,
    deviations: 10,
    kits: 0,
    adverseEvents: 76,
    vitalSigns: 1048,
  },
  "DEV-402": {
    status: "enrolling",
    sites: 32,
    screened: 460,
    enrolled: 279,
    visits: 1455,
    queries: 717,
    deviations: 63,
    kits: 0,
    adverseEvents: 381,
    vitalSigns: 5632,
  },
};

const portfolio = generatePortfolio({ seed: DEFAULT_PORTFOLIO_SEED });

/** Portfolios by seed, so property tests over the same seeds share work. */
const bySeed = new Map<number, Portfolio>([
  [DEFAULT_PORTFOLIO_SEED, portfolio],
]);
function portfolioFor(seed: number): Portfolio {
  const cached = bySeed.get(seed);
  if (cached) return cached;
  const generated = generatePortfolio({ seed });
  bySeed.set(seed, generated);
  return generated;
}

function sha256(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function allRecords(p: Portfolio): SyntheticRecord[] {
  const { edc, ctms, irt, etmf, finance, cec } = p.feeds;
  return [
    ...p.studies,
    ...p.sites,
    ...p.vendors,
    ...p.signals,
    ...p.studyDataRuns,
    ...edc.subjects,
    ...edc.visits,
    ...edc.queries,
    ...edc.adverseEvents,
    ...edc.vitalSigns,
    ...ctms.milestones,
    ...ctms.monitoringVisits,
    ...ctms.deviations,
    ...irt.randomizations,
    ...irt.kits,
    ...etmf,
    ...finance,
    ...cec,
  ];
}

function summarize(p: Portfolio) {
  const { edc, ctms, irt } = p.feeds;
  return Object.fromEntries(
    p.studies.map((study) => {
      const of = <T extends { studyId: string | null }>(rows: readonly T[]) =>
        rows.filter((row) => row.studyId === study.id).length;
      return [
        study.id,
        {
          status: study.status,
          sites: of(p.sites),
          screened: of(edc.subjects),
          enrolled: of(edc.subjects.filter((s) => s.enrolledOn !== null)),
          visits: of(edc.visits),
          queries: of(edc.queries),
          deviations: of(ctms.deviations),
          kits: of(irt.kits),
          adverseEvents: of(edc.adverseEvents),
          vitalSigns: of(edc.vitalSigns),
        },
      ];
    })
  );
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/** Every string value in a JSON-shaped value. */
function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value !== null && typeof value === "object") {
    return Object.values(value).flatMap(strings);
  }
  return [];
}

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function collected(datasets: readonly Dataset[], name: string): Dataset {
  const dataset = datasets.find(
    (d) => d.layer === "collected" && d.name === name
  );
  if (!dataset) throw new Error(`no collected ${name}`);
  return dataset;
}

describe("generatePortfolio: determinism", () => {
  it("matches the golden hash and summary for the default seed", () => {
    expect(summarize(portfolio)).toEqual(GOLDEN_SUMMARY);
    expect(sha256(portfolio)).toBe(GOLDEN_SHA256);
  });

  it("gives byte-identical output for the same seed and different output for another", () => {
    expect(JSON.stringify(generatePortfolio({ seed: 7 }))).toBe(
      JSON.stringify(portfolioFor(7))
    );
    expect(sha256(portfolioFor(8))).not.toBe(sha256(portfolioFor(7)));
  });

  it("rejects a seed that is not an integer in range", () => {
    for (const seed of [-1, 1.5, Number.NaN, 2 ** 32]) {
      expect(() => generatePortfolio({ seed })).toThrow(RangeError);
    }
  });

  it("generates the default portfolio, pipeline run included, in under 500 ms", () => {
    generatePortfolio({ seed: DEFAULT_PORTFOLIO_SEED });
    const runs = Array.from({ length: 5 }, () => {
      const start = performance.now();
      generatePortfolio({ seed: DEFAULT_PORTFOLIO_SEED });
      return performance.now() - start;
    });
    expectWithinTimingBudget(
      "generatePortfolio, median of 5",
      median(runs),
      500
    );
  });
});

describe("generatePortfolio: shape", () => {
  it("has eight studies across drug phases, two IDE device studies and three CRO-run studies", () => {
    const { studies } = portfolio;
    expect(studies).toHaveLength(8);
    const phases = new Set(studies.map((s) => s.phase));
    for (const phase of ["Phase I", "Phase II", "Phase III"] as const) {
      expect(phases.has(phase)).toBe(true);
    }
    const devices = studies.filter((s) => s.productType === "device");
    expect(devices).toHaveLength(2);
    expect(devices.every((s) => s.regulatoryPath === "IDE")).toBe(true);
    expect(devices.filter((s) => s.cecAdjudication)).toHaveLength(1);
    const cro = studies.filter((s) => s.operatingModel === "cro");
    expect(cro).toHaveLength(3);
    expect(cro.every((s) => s.croVendorId !== null)).toBe(true);
  });

  it("spreads about 120 sites over 12 countries with unique ids and names", () => {
    const { sites } = portfolio;
    expect(sites.length).toBeGreaterThanOrEqual(110);
    expect(sites.length).toBeLessThanOrEqual(130);
    expect(new Set(sites.map((s) => s.country)).size).toBe(12);
    expect(new Set(sites.map((s) => s.id)).size).toBe(sites.length);
    expect(new Set(sites.map((s) => s.name)).size).toBe(sites.length);
  });

  it("fills every feed, and the CEC feed only for the study that has a committee", () => {
    const { edc, ctms, irt, etmf, finance, cec } = portfolio.feeds;
    for (const feed of [
      edc.subjects,
      edc.visits,
      edc.queries,
      edc.adverseEvents,
      edc.vitalSigns,
      ctms.milestones,
      ctms.monitoringVisits,
      ctms.deviations,
      irt.randomizations,
      irt.kits,
      etmf,
      finance,
      cec,
    ]) {
      expect(feed.length).toBeGreaterThan(0);
    }
    const cecStudies = new Set(
      portfolio.studies.filter((s) => s.cecAdjudication).map((s) => s.id)
    );
    expect(cec.every((event) => cecStudies.has(event.studyId))).toBe(true);
    expect(new Set(ctms.deviations.map((d) => d.importance))).toEqual(
      new Set(["important", "not-important"])
    );
  });

  it("records why each screen failure failed, in every study (#2879)", () => {
    const failures = portfolio.feeds.edc.subjects.filter(
      (s) => s.status === "screen-failed"
    );
    expect(new Set(failures.map((s) => s.screenFailureReason))).toEqual(
      new Set(SCREEN_FAILURE_REASONS)
    );
    // DEMO-301's subjects come from the Study Data Pipeline, whose DS domain
    // records the failure but not its reason; the portfolio supplies one.
    const studies = new Set(failures.map((s) => s.studyId));
    expect(studies.has("DEMO-301")).toBe(true);
    expect(studies.size).toBe(portfolio.studies.length);
  });

  it("links every visit to a planned visit of its study", () => {
    const planned = new Map(
      portfolio.studies.map((s) => [
        s.id,
        new Set(s.plannedVisits.map((v) => v.id)),
      ])
    );
    expect(
      portfolio.feeds.edc.visits.every((v) =>
        planned.get(v.studyId)?.has(v.plannedVisitId)
      )
    ).toBe(true);
  });
});

describe("generatePortfolio: synthetic only", () => {
  it("marks every record synthetic", () => {
    const records = allRecords(portfolio);
    expect(records.length).toBeGreaterThan(10_000);
    expect(records.every((record) => record.synthetic === true)).toBe(true);
    expect(portfolio.sponsor).toMatch(/fictional/i);
  });

  it("names no real clinical research vendor", () => {
    const real =
      /\b(IQVIA|Parexel|ICON plc|Syneos|PPD|Labcorp|Covance|Medpace|Fortrea|PRA Health|Medidata|Veeva|Oracle|Signant|Suvoda|Almac|Clario|Bioclinica|Calyx|Q2 Solutions|WCG|Florence Healthcare|Thermo Fisher|Charles River)\b/;
    for (const vendor of portfolio.vendors) {
      expect(vendor.name).not.toMatch(real);
    }
    expect(JSON.stringify(portfolio)).not.toMatch(real);
  });

  it("makes no compliance, validation or immutability claim", () => {
    const text = strings(portfolio).join("\n");
    expect(checkRegulatoryWording(text)).toEqual([]);
    expect(text).not.toMatch(/\bimmutable\b|Part 11 compliant/i);
  });
});

describe("generatePortfolio: DEMO-301 from the Study Data Pipeline", () => {
  const demo = portfolio.studies.find((s) => s.id === "DEMO-301");
  const reference = portfolio.studyDataRuns.find(
    (r) => r.studyId === "DEMO-301"
  );
  const run = runPipeline(DEMO_301_STUDY, {
    seed: DEFAULT_PORTFOLIO_SEED,
    nSubjects: DEFAULT_SUBJECT_COUNT,
  });
  const shift = reference?.dateShiftDays ?? 0;

  it("defaults to the pipeline's own default run", () => {
    expect(DEFAULT_PORTFOLIO_SEED).toBe(DEFAULT_SEED);
    expect(portfolio.studyDataRuns).toHaveLength(1);
    expect(reference).toEqual({
      synthetic: true,
      studyId: "DEMO-301",
      productId: STUDY_DATA_PRODUCT_ID,
      seed: DEFAULT_PORTFOLIO_SEED,
      nSubjects: DEFAULT_SUBJECT_COUNT,
      sourceDatasets: ["DM", "RAND", "SV", "EX", "DS"],
      dateShiftDays: shift,
      standards: STANDARD_VERSIONS,
    });
    expect(Number.isInteger(shift)).toBe(true);
  });

  it("takes its protocol from the USDM study definition", () => {
    const { design } = DEMO_301_STUDY;
    expect(demo?.studyDataProductId).toBe(STUDY_DATA_PRODUCT_ID);
    expect(demo?.scheduleSource).toBe("usdm");
    expect(demo?.title).toBe(DEMO_301_STUDY.title);
    expect(demo?.plannedEnrollment).toBe(design.plannedEnrollment);
    expect(demo?.arms).toEqual(design.arms.map((arm) => arm.name));
    expect(demo?.plannedVisits.map((v) => v.id)).toEqual(
      design.visits.map((v) => v.id)
    );
    expect(demo?.plannedVisits.find((v) => v.day === 0)?.id).toBe(
      "enc_baseline"
    );
    expect(
      portfolio.studies
        .filter((s) => s.id !== "DEMO-301")
        .every((s) => s.scheduleSource === "blueprint" && !s.studyDataProductId)
    ).toBe(true);
  });

  it("plans the sites and countries the pipeline's EDC records (#2801)", () => {
    const dm = collected(run.datasets, "DM");
    const planned = new Map(
      portfolio.sites
        .filter((s) => s.studyId === "DEMO-301")
        .map((s) => [s.siteNumber, s.country])
    );
    const alpha3: Record<string, string> = { US: "USA", CA: "CAN" };
    const recorded = new Map(
      dm.columns.SITEID.map((site, row) => [site, dm.columns.COUNTRY[row]])
    );
    expect(recorded.size).toBe(planned.size);
    for (const [site, country] of recorded) {
      expect(planned.has(String(site))).toBe(true);
      expect(country).toBe(alpha3[planned.get(String(site))!]);
    }
  });

  // #2806: the platform and /study-data agree on which subject is at which
  // site, and a site is active a week before its first consent.
  it("puts every subject at the site the pipeline's EDC records", () => {
    const dm = collected(run.datasets, "DM");
    const siteBySubject = new Map(
      dm.columns.USUBJID.map((id, row) => [id, String(dm.columns.SITEID[row])])
    );
    const sites = new Map(
      portfolio.sites
        .filter((s) => s.studyId === "DEMO-301")
        .map((s) => [s.id, s])
    );
    const subjects = portfolio.feeds.edc.subjects.filter(
      (s) => s.studyId === "DEMO-301"
    );
    expect(subjects.length).toBeGreaterThan(0);
    for (const subject of subjects) {
      const site = sites.get(subject.siteId);
      expect(site?.siteNumber, subject.subjectId).toBe(
        siteBySubject.get(subject.subjectId)
      );
      expect(site?.activatedOn, subject.siteId).not.toBeNull();
      expect(
        addDays(String(site?.activatedOn), 7) <= subject.screenedOn,
        `${subject.subjectId} screened on ${subject.screenedOn} at a site activated on ${site?.activatedOn}`
      ).toBe(true);
    }
  });

  it("has exactly the pipeline's subjects, randomised to the pipeline's arms", () => {
    const dm = collected(run.datasets, "DM");
    const rand = collected(run.datasets, "RAND");
    const subjects = portfolio.feeds.edc.subjects.filter(
      (s) => s.studyId === "DEMO-301"
    );
    expect(subjects.map((s) => s.subjectId)).toEqual(dm.columns.USUBJID);
    const arms = new Map(
      portfolio.feeds.irt.randomizations
        .filter((r) => r.studyId === "DEMO-301")
        .map((r) => [r.subjectId, r.arm])
    );
    const enrolled = new Map(subjects.map((s) => [s.subjectId, s.enrolledOn]));
    rand.columns.USUBJID.forEach((id, row) => {
      expect(arms.get(String(id))).toBe(rand.columns.ARM[row]);
      expect(enrolled.get(String(id))).toBe(
        addDays(String(rand.columns.RANDDTC[row]), shift)
      );
    });
    expect(arms.size).toBe(rand.rowCount);
  });

  it("has one visit record per scheduled pipeline visit, on the shifted date", () => {
    const sv = collected(run.datasets, "SV");
    const visitIds = new Map(
      DEMO_301_STUDY.design.visits.map((v) => [v.visitNum, v.id])
    );
    const expected: [string, string | null][] = [];
    for (let row = 0; row < sv.rowCount; row += 1) {
      const id = visitIds.get(Number(sv.columns.VISITNUM[row]));
      if (id === undefined) continue;
      const date = sv.columns.SVDTC[row];
      expected.push([
        `${sv.columns.USUBJID[row]}-${id}`,
        date === null ? null : addDays(String(date), shift),
      ]);
    }
    const actual = portfolio.feeds.edc.visits
      .filter((v) => v.studyId === "DEMO-301")
      .map((v) => [v.visitId, v.visitDate]);
    expect(actual).toEqual(expected);
  });

  it("follows the pipeline for any seed", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 0xffffffff }), (seed) => {
        const p = portfolioFor(seed);
        const dm = collected(
          runPipeline(DEMO_301_STUDY, {
            seed,
            nSubjects: DEFAULT_SUBJECT_COUNT,
          }).datasets,
          "DM"
        );
        const ids = p.feeds.edc.subjects
          .filter((s) => s.studyId === "DEMO-301")
          .map((s) => s.subjectId);
        return (
          p.studyDataRuns[0]?.seed === seed &&
          JSON.stringify(ids) === JSON.stringify(dm.columns.USUBJID)
        );
      }),
      { numRuns: 3, seed: 2622 }
    );
  }, 60_000);
});

describe("generatePortfolio: adverse events (#2956)", () => {
  const { edc } = portfolio.feeds;
  const visits = new Map(edc.visits.map((v) => [v.visitId, v]));
  const enrolledOn = new Map(
    edc.subjects.map((s) => [s.subjectId, s.enrolledOn])
  );

  it("reports each event at an entered on-study visit of its own subject", () => {
    expect(edc.adverseEvents.length).toBeGreaterThan(1000);
    expect(new Set(edc.adverseEvents.map((e) => e.aeId)).size).toBe(
      edc.adverseEvents.length
    );
    for (const event of edc.adverseEvents) {
      const visit = visits.get(event.visitId);
      expect(visit?.status).toBe("entered");
      expect(visit?.subjectId).toBe(event.subjectId);
      expect(visit?.siteId).toBe(event.siteId);
      expect(visit?.studyId).toBe(event.studyId);
      expect(event.reportedOn).toBe(visit?.dataEnteredAt?.slice(0, 10));
      expect(event.aeId.startsWith(`${event.visitId}-AE`)).toBe(true);
    }
  });

  it("begins every event after enrollment and within four weeks before its visit", () => {
    for (const event of edc.adverseEvents) {
      const visitDate = visits.get(event.visitId)?.visitDate ?? "";
      const enrolled = enrolledOn.get(event.subjectId) ?? "";
      expect(event.onsetOn >= enrolled).toBe(true);
      expect(event.onsetOn <= visitDate).toBe(true);
      expect(event.onsetOn >= addDays(visitDate, -27)).toBe(true);
      expect(event.onsetOn <= event.reportedOn).toBe(true);
    }
  });

  it("reports about four events per ten on-study visits, mostly mild and rarely serious", () => {
    const integrity = new Set(
      portfolio.signals
        .filter((s) => s.kind === "data-integrity")
        .map((s) => s.siteId)
    );
    const onStudy = edc.visits.filter(
      (v) =>
        v.studyId !== "DEMO-301" &&
        !integrity.has(v.siteId) &&
        v.status === "entered" &&
        v.visitDate !== null &&
        v.visitDate >= (enrolledOn.get(v.subjectId) ?? "9999")
    );
    const events = edc.adverseEvents.filter((e) => !integrity.has(e.siteId));
    expect(events.length / onStudy.length).toBeGreaterThan(0.36);
    expect(events.length / onStudy.length).toBeLessThan(0.44);
    const serious = events.filter((e) => e.serious).length / events.length;
    expect(serious).toBeGreaterThan(0.03);
    expect(serious).toBeLessThan(0.09);
    const mild = events.filter((e) => e.severity === "mild").length;
    expect(mild / events.length).toBeGreaterThan(0.5);
    expect(new Set(events.map((e) => e.severity))).toEqual(
      new Set(["mild", "moderate", "severe"])
    );
  });

  it("leaves DEMO-301's adverse events in its Study Data Pipeline run", () => {
    expect(edc.adverseEvents.some((e) => e.studyId === "DEMO-301")).toBe(false);
  });
});

describe("generatePortfolio: vital signs (#2957)", () => {
  const { edc } = portfolio.feeds;
  /** Plausible range and recorded precision of each sign, as generated. */
  const SIGNS = {
    SYSBP: { unit: "mmHg", min: 85, max: 200, decimals: 0 },
    DIABP: { unit: "mmHg", min: 50, max: 120, decimals: 0 },
    PULSE: { unit: "beats/min", min: 45, max: 130, decimals: 0 },
    WEIGHT: { unit: "kg", min: 40, max: 160, decimals: 1 },
  } as const;

  it("records each sign once at every entered visit of the portfolio studies but DEMO-301", () => {
    const measured = edc.visits.filter(
      (v) =>
        v.studyId !== "DEMO-301" &&
        v.status === "entered" &&
        v.visitDate !== null
    );
    expect(edc.vitalSigns).toHaveLength(measured.length * 4);
    expect(new Set(edc.vitalSigns.map((r) => r.vitalSignId)).size).toBe(
      edc.vitalSigns.length
    );
    const byVisit = new Map(measured.map((v) => [v.visitId, v]));
    for (const reading of edc.vitalSigns) {
      const visit = byVisit.get(reading.visitId);
      expect(visit).toBeDefined();
      expect(reading.vitalSignId).toBe(`${reading.visitId}-${reading.test}`);
      expect(reading.subjectId).toBe(visit?.subjectId);
      expect(reading.siteId).toBe(visit?.siteId);
      expect(reading.studyId).toBe(visit?.studyId);
      expect(reading.measuredOn).toBe(visit?.visitDate);
    }
  });

  it("keeps every reading in its plausible range, unit and precision, diastolic well below systolic", () => {
    const systolic = new Map<string, number>();
    for (const reading of edc.vitalSigns) {
      const sign = SIGNS[reading.test];
      expect(reading.unit).toBe(sign.unit);
      expect(reading.value).toBeGreaterThanOrEqual(sign.min);
      expect(reading.value).toBeLessThanOrEqual(sign.max);
      expect(Number(reading.value.toFixed(sign.decimals))).toBe(reading.value);
      if (reading.test === "SYSBP")
        systolic.set(reading.visitId, reading.value);
    }
    for (const reading of edc.vitalSigns.filter((r) => r.test === "DIABP")) {
      expect(reading.value).toBeLessThanOrEqual(
        (systolic.get(reading.visitId) ?? 0) - 20
      );
    }
  });

  it("leaves DEMO-301's vital signs in its Study Data Pipeline run", () => {
    expect(edc.vitalSigns.some((r) => r.studyId === "DEMO-301")).toBe(false);
  });
});

describe("generatePortfolio: planted signals", () => {
  const { signals, sites, feeds } = portfolio;

  it("lists one signal of each kind or more", () => {
    const kinds = new Set(signals.map((s) => s.kind));
    expect(kinds).toEqual(
      new Set([
        "slow-enrolling-site",
        "data-integrity",
        "study-behind-plan",
        "vendor-over-budget",
      ])
    );
  });

  it("slow sites screen far below the median site of their study", () => {
    for (const signal of signals.filter(
      (s) => s.kind === "slow-enrolling-site"
    )) {
      const studySites = sites.filter((s) => s.studyId === signal.studyId);
      const rate = (siteId: string) => {
        const site = studySites.find((s) => s.id === siteId);
        const screened = feeds.edc.subjects.filter(
          (x) => x.siteId === siteId
        ).length;
        return screened / Math.max(site?.plannedEnrollment ?? 1, 1);
      };
      const typical = median(studySites.map((s) => rate(s.id)));
      expect(rate(signal.siteId ?? "")).toBeLessThan(typical * 0.5);
    }
  });

  it("the data integrity site enters every visit at one time of day and draws almost no queries", () => {
    const signal = signals.find((s) => s.kind === "data-integrity");
    const visits = feeds.edc.visits.filter(
      (v) => v.siteId === signal?.siteId && v.dataEnteredAt
    );
    expect(visits.length).toBeGreaterThan(20);
    expect(new Set(visits.map((v) => v.dataEnteredAt?.slice(11)))).toEqual(
      new Set(["17:00:00Z"])
    );
    expect(visits.every((v) => v.dayOffset === 0)).toBe(true);
    const queries = feeds.edc.queries.filter(
      (q) => q.siteId === signal?.siteId
    ).length;
    expect(queries / visits.length).toBeLessThan(0.1);
  });

  it("the data integrity site reports adverse events at a fraction of its peers' rate (#2956)", () => {
    const signal = signals.find((s) => s.kind === "data-integrity");
    const rate = (inSite: (siteId: string) => boolean) => {
      const entered = feeds.edc.visits.filter(
        (v) =>
          v.studyId === signal?.studyId &&
          inSite(v.siteId) &&
          v.status === "entered"
      ).length;
      const events = feeds.edc.adverseEvents.filter(
        (e) => e.studyId === signal?.studyId && inSite(e.siteId)
      ).length;
      return events / entered;
    };
    const site = rate((id) => id === signal?.siteId);
    const peers = rate((id) => id !== signal?.siteId);
    expect(site).toBeLessThan(peers * 0.25);
  });

  it("the data integrity site rounds its vital signs to 0 or 5, and they barely vary (#2957)", () => {
    const signal = signals.find((s) => s.kind === "data-integrity");
    const inStudy = feeds.edc.vitalSigns.filter(
      (r) => r.studyId === signal?.studyId
    );
    const site = inStudy.filter((r) => r.siteId === signal?.siteId);
    const peers = inStudy.filter((r) => r.siteId !== signal?.siteId);
    const whole = site.filter((r) => r.test !== "WEIGHT");
    expect(whole.length).toBeGreaterThan(50);
    expect(whole.every((r) => r.value % 5 === 0)).toBe(true);
    /** Mean squared deviation of systolic readings from each subject's own mean. */
    const withinVariance = (readings: typeof inStudy) => {
      const bySubject = new Map<string, number[]>();
      for (const r of readings.filter((x) => x.test === "SYSBP")) {
        bySubject.set(r.subjectId, [
          ...(bySubject.get(r.subjectId) ?? []),
          r.value,
        ]);
      }
      let ss = 0;
      let df = 0;
      for (const values of bySubject.values()) {
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        ss += values.reduce((a, b) => a + (b - mean) ** 2, 0);
        df += values.length - 1;
      }
      return ss / df;
    };
    expect(withinVariance(site)).toBeLessThan(withinVariance(peers) * 0.4);
  });

  it("the study behind plan misses its planned 50% enrollment date", () => {
    const signal = signals.find((s) => s.kind === "study-behind-plan");
    const milestone = feeds.ctms.milestones.find(
      (m) =>
        m.studyId === signal?.studyId && m.kind === "fifty-percent-enrolled"
    );
    expect(milestone).toBeDefined();
    expect(
      milestone?.actualOn === null ||
        (milestone?.actualOn ?? "") > (milestone?.plannedOn ?? "")
    ).toBe(true);
  });

  it("only the flagged vendor runs over budget", () => {
    const flagged = signals.find(
      (s) => s.kind === "vendor-over-budget"
    )?.vendorId;
    const ratio = (vendorId: string | null) => {
      const lines = feeds.finance.filter((l) => l.vendorId === vendorId);
      const budget = lines.reduce((sum, l) => sum + l.budgetUsd, 0);
      return lines.reduce((sum, l) => sum + l.actualUsd, 0) / budget;
    };
    expect(ratio(flagged ?? null)).toBeGreaterThan(1.1);
    for (const vendor of portfolio.vendors.filter((v) => v.id !== flagged)) {
      if (feeds.finance.some((l) => l.vendorId === vendor.id)) {
        expect(ratio(vendor.id)).toBeLessThan(1.05);
      }
    }
  });
});

describe("generatePortfolio: properties over seeds", () => {
  const seeds = fc.integer({ min: 0, max: 0xffffffff });
  // One fixed fast-check seed, so the properties draw the same portfolio
  // seeds and share the generated portfolios.
  const options = { numRuns: 8, seed: 2622 };

  it("never dates a milestone or site activation before its study's start", () => {
    fc.assert(
      fc.property(seeds, (seed) => {
        const p = portfolioFor(seed);
        const start = new Map(p.studies.map((s) => [s.id, s.startOn]));
        for (const m of p.feeds.ctms.milestones) {
          const startOn = start.get(m.studyId) ?? "";
          if (m.plannedOn < startOn) return false;
          if (
            m.actualOn !== null &&
            (m.actualOn < startOn || m.actualOn > p.asOf)
          )
            return false;
        }
        return p.sites.every(
          (s) =>
            s.activatedOn === null ||
            (s.activatedOn >= (start.get(s.studyId) ?? "") &&
              s.activatedOn <= p.asOf)
        );
      }),
      options
    );
  }, 60_000);

  it("never enrolls more subjects than were screened, at any site or study", () => {
    fc.assert(
      fc.property(seeds, (seed) => {
        const p = portfolioFor(seed);
        const screened = new Map<string, number>();
        const enrolled = new Map<string, number>();
        for (const subject of p.feeds.edc.subjects) {
          for (const key of [subject.siteId, subject.studyId]) {
            screened.set(key, (screened.get(key) ?? 0) + 1);
            if (subject.enrolledOn !== null)
              enrolled.set(key, (enrolled.get(key) ?? 0) + 1);
          }
          if (
            subject.enrolledOn !== null &&
            subject.enrolledOn < subject.screenedOn
          )
            return false;
        }
        for (const [key, count] of enrolled) {
          if (count > (screened.get(key) ?? 0)) return false;
        }
        return p.studies.every(
          (s) => (enrolled.get(s.id) ?? 0) <= s.plannedEnrollment
        );
      }),
      options
    );
  }, 60_000);

  it("takes every site through start-up in order, after protocol finalisation and by the data cut (#2880)", () => {
    fc.assert(
      fc.property(seeds, (seed) => {
        const p = portfolioFor(seed);
        const start = new Map(p.studies.map((s) => [s.id, s.startOn]));
        return p.sites.every((site) => {
          const stages = [
            site.selectedOn,
            site.contractedOn,
            site.irbApprovedOn,
            site.activatedOn,
          ];
          const reached = stages.filter((d): d is string => d !== null);
          // Reached stages come first, in order; the rest are still ahead.
          return (
            stages.slice(0, reached.length).every((d) => d !== null) &&
            reached.every(
              (day, i) =>
                day >= (start.get(site.studyId) ?? "") &&
                day <= p.asOf &&
                (i === 0 || reached[i - 1] <= day)
            )
          );
        });
      }),
      options
    );
  }, 60_000);

  it("gives a screen failure reason to exactly the subjects who failed screening (#2879)", () => {
    fc.assert(
      fc.property(seeds, (seed) =>
        portfolioFor(seed).feeds.edc.subjects.every((subject) =>
          subject.status === "screen-failed"
            ? SCREEN_FAILURE_REASONS.includes(subject.screenFailureReason ?? "")
            : subject.screenFailureReason === null
        )
      ),
      options
    );
  }, 60_000);

  it("never closes or answers a query before it was opened", () => {
    fc.assert(
      fc.property(seeds, (seed) => {
        const p = portfolioFor(seed);
        return p.feeds.edc.queries.every(
          (q) =>
            (q.answeredAt === null || q.answeredAt >= q.openedAt) &&
            (q.closedAt === null ||
              (q.answeredAt !== null && q.closedAt >= q.answeredAt)) &&
            q.openedAt.slice(0, 10) <= p.asOf
        );
      }),
      options
    );
  }, 60_000);

  it("never reports an adverse event before it began, or after the data cut (#2956)", () => {
    fc.assert(
      fc.property(seeds, (seed) => {
        const p = portfolioFor(seed);
        return p.feeds.edc.adverseEvents.every(
          (e) => e.onsetOn <= e.reportedOn && e.reportedOn <= p.asOf
        );
      }),
      options
    );
  }, 60_000);

  it("takes every vital sign at an entered visit, on its date (#2957)", () => {
    fc.assert(
      fc.property(seeds, (seed) => {
        const p = portfolioFor(seed);
        const visits = new Map(p.feeds.edc.visits.map((v) => [v.visitId, v]));
        return p.feeds.edc.vitalSigns.every((r) => {
          const visit = visits.get(r.visitId);
          return (
            visit?.status === "entered" &&
            visit.visitDate === r.measuredOn &&
            r.measuredOn <= p.asOf
          );
        });
      }),
      options
    );
  }, 60_000);

  it("never records a visit, subject event or deviation after the data cut", () => {
    fc.assert(
      fc.property(seeds, (seed) => {
        const p = portfolioFor(seed);
        const { edc, ctms, irt } = p.feeds;
        const dates = [
          ...edc.visits.map((v) => v.visitDate),
          ...edc.visits.map((v) => v.dataEnteredAt?.slice(0, 10) ?? null),
          ...edc.subjects.flatMap((s) => [
            s.screenedOn,
            s.enrolledOn,
            s.completedOn,
            s.discontinuedOn,
          ]),
          ...ctms.deviations.map((d) => d.identifiedOn),
          ...irt.randomizations.map((r) => r.randomizedAt.slice(0, 10)),
          ...irt.kits.map((k) => k.dispensedOn),
        ];
        return dates.every((date) => date === null || date <= p.asOf);
      }),
      options
    );
  }, 60_000);
});
