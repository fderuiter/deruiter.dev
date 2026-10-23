/**
 * The seeded portfolio generator: the bronze layer of the Clinical Data
 * Platform (ADR 0066).
 */
import { DEFAULT_SUBJECT_COUNT } from "@/lib/study-data";
import type {
  CecAdjudication,
  CtmsMilestone,
  CtmsMonitoringVisit,
  EdcQuery,
  EdcSubject,
  EdcVisit,
  EtmfDocument,
  FinanceLine,
  IrtKit,
  IrtRandomization,
  Portfolio,
  PortfolioOptions,
  PortfolioSignal,
  ProtocolDeviation,
  Site,
  Study,
  StudyDataRunReference,
} from "../../types";
import {
  AS_OF,
  BEHIND_PLAN_STUDY_ID,
  OVER_BUDGET_VENDOR_ID,
  SPONSOR,
  VENDORS,
  studyBlueprints,
} from "./blueprint";
import { isoDate, toDay } from "./calendar";
import { studyOperations } from "./operations";
import { studyFromPipeline } from "./pipeline";
import type { StudySimulation } from "./records";
import { planSites } from "./sites";
import { simulateStudy } from "./subjects";

/** Screening pace of the study planted behind plan, against plan. */
const BEHIND_PLAN_PACE = 0.55;

/**
 * Generates the synthetic sponsor portfolio and its bronze operational
 * feeds: eight studies (drug Phase I to III, two device IDE studies, three
 * run by fictional CROs), about 120 sites in 12 countries, and EDC, CTMS,
 * IRT, eTMF, finance, protocol deviation and CEC adjudication records.
 *
 * DEMO-301 is the Study Data Pipeline's study. Its protocol is the USDM
 * definition the pipeline reads, and its subjects, randomisations and visits
 * are the collected data of `runPipeline` from `@/lib/study-data`, run with
 * the same seed. `studyDataRuns` records how to reproduce that run.
 *
 * The output is a pure function of the seed: the same seed gives a
 * byte-identical result, with no clock, locale or network input. Every
 * record carries `synthetic: true`, and no record describes anything after
 * the data cut in `asOf`. Planted patterns are listed in `signals`.
 *
 * @param options - Generation options; `seed` is an integer from 0 to 4294967295.
 * @returns The portfolio.
 * @throws RangeError when the seed is not an integer in range.
 */
export function generatePortfolio(options: PortfolioOptions): Portfolio {
  const { seed } = options;
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new RangeError(
      `seed must be an integer from 0 to 4294967295, got ${seed}`
    );
  }
  const asOfDay = toDay(AS_OF);
  const takenNames = new Set<string>();
  const studies: Study[] = [];
  const sites: Site[] = [];
  const signals: PortfolioSignal[] = [];
  const studyDataRuns: StudyDataRunReference[] = [];
  const feeds = {
    edc: {
      subjects: [] as EdcSubject[],
      visits: [] as EdcVisit[],
      queries: [] as EdcQuery[],
    },
    ctms: {
      milestones: [] as CtmsMilestone[],
      monitoringVisits: [] as CtmsMonitoringVisit[],
      deviations: [] as ProtocolDeviation[],
    },
    irt: { randomizations: [] as IrtRandomization[], kits: [] as IrtKit[] },
    etmf: [] as EtmfDocument[],
    finance: [] as FinanceLine[],
    cec: [] as CecAdjudication[],
  };

  for (const blueprint of studyBlueprints()) {
    const startDay = toDay(blueprint.startOn);
    const plans = planSites(seed, blueprint, startDay, asOfDay, takenNames);
    const behind = blueprint.id === BEHIND_PLAN_STUDY_ID;
    let sim: StudySimulation;
    if (blueprint.studyDefinition !== null) {
      const fromRun = studyFromPipeline(
        seed,
        blueprint,
        blueprint.studyDefinition,
        DEFAULT_SUBJECT_COUNT,
        plans,
        asOfDay
      );
      sim = fromRun.simulation;
      studyDataRuns.push(fromRun.reference);
    } else {
      sim = simulateStudy(
        seed,
        blueprint,
        plans,
        asOfDay,
        behind ? BEHIND_PLAN_PACE : 1
      );
    }
    const ops = studyOperations(seed, blueprint, plans, sim, startDay, asOfDay);

    studies.push({
      synthetic: true,
      id: blueprint.id,
      title: blueprint.title,
      therapeuticArea: blueprint.therapeuticArea,
      productType: blueprint.productType,
      phase: blueprint.phase,
      regulatoryPath: blueprint.productType === "device" ? "IDE" : "IND",
      operatingModel: blueprint.operatingModel,
      croVendorId: blueprint.croVendorId,
      status: ops.status,
      startOn: blueprint.startOn,
      plannedEnrollment: blueprint.plannedEnrollment,
      randomized: blueprint.randomized,
      arms: blueprint.arms,
      plannedVisits: blueprint.plannedVisits,
      scheduleSource: blueprint.scheduleSource,
      cecAdjudication: blueprint.cecAdjudication,
      studyDataProductId: blueprint.studyDataProductId,
    });

    for (const plan of plans) {
      sites.push({
        synthetic: true,
        id: plan.id,
        studyId: plan.studyId,
        siteNumber: plan.siteNumber,
        country: plan.country,
        name: plan.name,
        plannedEnrollment: plan.plannedEnrollment,
        activatedOn:
          plan.activationDay === null ? null : isoDate(plan.activationDay),
      });
      if (plan.slow) {
        signals.push({
          synthetic: true,
          kind: "slow-enrolling-site",
          studyId: plan.studyId,
          siteId: plan.id,
          vendorId: null,
          description:
            "Screens subjects at a fraction of the planned rate and enters data late.",
        });
      }
      if (plan.integrity) {
        signals.push({
          synthetic: true,
          kind: "data-integrity",
          studyId: plan.studyId,
          siteId: plan.id,
          vendorId: null,
          description:
            "Every visit falls on its planned day, all data is entered at the same minute, and queries and deviations are nearly absent.",
        });
      }
    }
    if (behind) {
      signals.push({
        synthetic: true,
        kind: "study-behind-plan",
        studyId: blueprint.id,
        siteId: null,
        vendorId: null,
        description:
          "Sites activated late and screen at about half the planned rate, so enrollment milestones slip.",
      });
    }

    feeds.edc.subjects.push(...sim.subjects);
    feeds.edc.visits.push(...sim.visits);
    feeds.edc.queries.push(...sim.queries);
    feeds.ctms.milestones.push(...ops.milestones);
    feeds.ctms.monitoringVisits.push(...ops.monitoringVisits);
    feeds.ctms.deviations.push(...sim.deviations);
    feeds.irt.randomizations.push(...sim.randomizations);
    feeds.irt.kits.push(...sim.kits);
    feeds.etmf.push(...ops.documents);
    feeds.finance.push(...ops.finance);
    feeds.cec.push(...sim.cec);
  }

  signals.push({
    synthetic: true,
    kind: "vendor-over-budget",
    studyId: null,
    siteId: null,
    vendorId: OVER_BUDGET_VENDOR_ID,
    description:
      "Quarterly actual spend runs 15 to 30 percent over budget and rises each quarter.",
  });

  return {
    id: `portfolio-${seed}`,
    sponsor: SPONSOR,
    seed,
    asOf: AS_OF,
    studies,
    sites,
    vendors: VENDORS,
    feeds,
    signals,
    studyDataRuns,
  };
}
