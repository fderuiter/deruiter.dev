/**
 * Reads a USDM v4.0 document into the pipeline's `StudyDefinition`.
 *
 * It reuses CRF Studio's USDM v4 reader for the schedule (timings resolved to
 * study days and visit windows) and extension helpers, so CRF Studio and the
 * pipeline agree on what a USDM schedule means. Everything downstream (the
 * synthetic subjects, trial design domains, visit windows in SV, the
 * endpoints the analysis targets) reads this structure rather than the raw
 * document.
 */
import {
  USDM_RANDOMISATION_EXTENSION_URL,
  USDM_SDTM_CAT_EXTENSION_URL,
  USDM_SDTM_DOMAIN_EXTENSION_URL,
  USDM_SDTM_STRESU_EXTENSION_URL,
  USDM_SDTM_TESTCD_EXTENSION_URL,
  getUsdmV4ExtensionString,
  resolveUsdmStudyDesign,
  type UsdmStudySelection,
  type UsdmV4BiomedicalConcept,
  type UsdmV4Code,
  type UsdmV4InterventionalStudyDesign,
  type UsdmV4StudyVersion,
} from "@/lib/clinical-standards";
import { getUsdmV4EncounterSchedule } from "@/lib/clinical-standards";
import type {
  ActivityDefinition,
  ArmDefinition,
  AssessmentDefinition,
  CodedValue,
  EpochDefinition,
  RandomisationDefinition,
  ScheduledActivity,
  StudyDefinition,
  VisitDefinition,
} from "../../types";

/** Thrown when a document is not a USDM v4 study the pipeline can run. */
export class StudyDefinitionError extends Error {
  constructor(message: string) {
    super(`USDM study definition: ${message}`);
    this.name = "StudyDefinitionError";
  }
}

function fail(message: string): never {
  throw new StudyDefinitionError(message);
}

function coded(code: UsdmV4Code | null | undefined): CodedValue {
  return { code: code?.code ?? "", decode: code?.decode ?? "" };
}

/** NCI codes for an experimental intervention and an investigational product. */
const EXPERIMENTAL_INTERVENTION = "C41161";
const INVESTIGATIONAL_PRODUCT = "C202579";

function list<T>(value: readonly T[] | undefined | null): readonly T[] {
  return Array.isArray(value) ? value : [];
}

function assessment(bc: UsdmV4BiomedicalConcept): AssessmentDefinition {
  const testCode =
    getUsdmV4ExtensionString(bc, USDM_SDTM_TESTCD_EXTENSION_URL) ??
    fail(`biomedical concept ${bc.id} has no SDTM test code extension`);
  const unit = getUsdmV4ExtensionString(bc, USDM_SDTM_STRESU_EXTENSION_URL);
  const category = getUsdmV4ExtensionString(bc, USDM_SDTM_CAT_EXTENSION_URL);
  return {
    conceptId: bc.id,
    nciCode: bc.code?.standardCode?.code ?? "",
    testCode,
    testName: bc.name,
    ...(unit === undefined ? {} : { unit }),
    ...(category === undefined ? {} : { category }),
  };
}

function readVisits(
  design: UsdmV4InterventionalStudyDesign
): readonly VisitDefinition[] {
  const encounters = new Map(list(design.encounters).map((e) => [e.id, e]));
  return getUsdmV4EncounterSchedule(design).map((entry, idx) => {
    const encounter =
      encounters.get(entry.encounterId) ??
      fail(
        `timeline instance points at unknown encounter ${entry.encounterId}`
      );
    if (entry.targetDay === null) {
      fail(`encounter ${encounter.id} has no timing that reaches the anchor`);
    }
    if (!entry.epochId) fail(`encounter ${encounter.id} has no epoch`);
    return {
      id: encounter.id,
      visitNum: idx + 1,
      name: encounter.name,
      epochId: entry.epochId,
      targetDay: entry.targetDay,
      windowBefore: entry.windowBefore,
      windowAfter: entry.windowAfter,
    };
  });
}

function readSchedule(
  design: UsdmV4InterventionalStudyDesign
): readonly ScheduledActivity[] {
  return getUsdmV4EncounterSchedule(design).flatMap((entry) =>
    entry.activityIds.map((activityId) => ({
      visitId: entry.encounterId,
      activityId,
    }))
  );
}

/**
 * Reads the design's randomisation extension, or `undefined` when it has
 * none. The ratio must name every arm once with a positive whole number, and
 * each stratum needs an ADSL `STRATnR` variable and at least one level.
 */
function readRandomisation(
  design: UsdmV4InterventionalStudyDesign,
  arms: readonly ArmDefinition[]
): RandomisationDefinition | undefined {
  const raw = getUsdmV4ExtensionString(
    design,
    USDM_RANDOMISATION_EXTENSION_URL
  );
  if (raw === undefined) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    fail("randomisation extension is not valid JSON");
  }
  const value = (parsed ?? {}) as {
    ratio?: unknown;
    method?: unknown;
    strata?: unknown;
  };
  const ratioIn =
    value.ratio && typeof value.ratio === "object" ? value.ratio : {};
  const armIds = new Set(arms.map((arm) => arm.id));
  const ratio: Record<string, number> = {};
  for (const [armId, share] of Object.entries(ratioIn)) {
    if (!armIds.has(armId)) {
      fail(`randomisation ratio names unknown arm ${armId}`);
    }
    if (!Number.isInteger(share) || (share as number) < 1) {
      fail(`randomisation ratio for ${armId} is not a positive whole number`);
    }
    ratio[armId] = share as number;
  }
  for (const arm of arms) {
    if (!(arm.id in ratio)) fail(`randomisation ratio omits arm ${arm.id}`);
  }
  const strata = (Array.isArray(value.strata) ? value.strata : []).map(
    (stratum: unknown, idx: number) => {
      const s = (stratum ?? {}) as {
        factor?: unknown;
        adslVariable?: unknown;
        levels?: unknown;
      };
      const levels = Array.isArray(s.levels)
        ? s.levels.filter((level): level is string => typeof level === "string")
        : [];
      if (
        typeof s.adslVariable !== "string" ||
        !/^STRAT[1-9]\d?R$/.test(s.adslVariable)
      ) {
        fail(`randomisation stratum ${idx + 1} has no ADSL STRATnR variable`);
      }
      if (levels.length === 0 || new Set(levels).size !== levels.length) {
        fail(`randomisation stratum ${s.adslVariable} needs distinct levels`);
      }
      return {
        factor: typeof s.factor === "string" ? s.factor : s.adslVariable,
        adslVariable: s.adslVariable,
        levels,
      };
    }
  );
  if (new Set(strata.map((s) => s.adslVariable)).size !== strata.length) {
    fail("randomisation strata repeat an ADSL variable");
  }
  return {
    ratio,
    method: typeof value.method === "string" ? value.method : "",
    strata,
  };
}

/**
 * Reads a USDM v4.0 document (the API Wrapper shape) into a `StudyDefinition`:
 * arms, epochs, elements and cells, visits with study days and windows, the
 * schedule of activities, objectives with endpoints, estimands and analysis
 * populations. A document with one study version and one design is read as
 * it is; one with more needs `selection`, and is never read from its first.
 *
 * @param usdm - The parsed USDM v4.0 document.
 * @param selection - The study version and design to read, by id.
 * @returns The study definition the pipeline runs.
 * @throws StudyDefinitionError when the document is not a USDM v4 study, or
 *   when a reference inside it does not resolve.
 */
export function readStudyDefinition(
  usdm: unknown,
  selection?: UsdmStudySelection
): StudyDefinition {
  if (!usdm || typeof usdm !== "object") fail("expected a JSON object");
  const doc = usdm as {
    usdmVersion?: unknown;
    study?: { name?: string; versions?: UsdmV4StudyVersion[] };
  };
  if (
    typeof doc.usdmVersion !== "string" ||
    !/^4(\.|$)/.test(doc.usdmVersion)
  ) {
    fail(`expected usdmVersion 4.x, got ${String(doc.usdmVersion)}`);
  }
  const resolved = resolveUsdmStudyDesign(doc.study, selection);
  if (!resolved.ok) fail(resolved.message);
  const { version, design } = resolved;

  const studyId =
    list(version.studyIdentifiers)[0]?.text ?? doc.study?.name ?? "";
  if (!studyId) fail("study has no identifier");
  const titles = list(version.titles);
  const title =
    titles.find((t) => t.type?.decode === "Official Study Title")?.text ??
    titles[0]?.text ??
    studyId;

  const conceptsById = new Map(
    list(version.biomedicalConcepts).map((bc) => [bc.id, bc])
  );
  const criterionItemsById = new Map(
    list(version.eligibilityCriterionItems).map((item) => [item.id, item])
  );

  const arms: ArmDefinition[] = list(design.arms).map((arm) => ({
    id: arm.id,
    armCode: arm.label ?? arm.id,
    name: arm.name,
    description: arm.description ?? "",
    type: coded(arm.type),
  }));

  const epochs: EpochDefinition[] = list(design.epochs).map((epoch, idx) => ({
    id: epoch.id,
    name: epoch.name,
    type: coded(epoch.type),
    order: idx + 1,
  }));

  const activities: ActivityDefinition[] = list(design.activities).map(
    (act) => ({
      id: act.id,
      name: act.name,
      domain:
        getUsdmV4ExtensionString(act, USDM_SDTM_DOMAIN_EXTENSION_URL) ??
        fail(`activity ${act.id} has no SDTM domain extension`),
      assessments: list(act.biomedicalConceptIds).map((id) =>
        assessment(
          conceptsById.get(id) ??
            fail(`activity ${act.id} references unknown concept ${id}`)
        )
      ),
    })
  );

  const visits = readVisits(design);
  const schedule = readSchedule(design);
  const activityIds = new Set(activities.map((a) => a.id));
  const epochIds = new Set(epochs.map((e) => e.id));
  for (const cell of schedule) {
    if (!activityIds.has(cell.activityId)) {
      fail(`schedule references unknown activity ${cell.activityId}`);
    }
  }
  for (const visit of visits) {
    if (!epochIds.has(visit.epochId)) {
      fail(`visit ${visit.id} references unknown epoch ${visit.epochId}`);
    }
  }

  const interventions = list(version.studyInterventions);
  const experimental =
    interventions.find(
      (item) => item.role?.code === EXPERIMENTAL_INTERVENTION
    ) ?? interventions[0];
  const products = list(version.administrableProducts).filter(
    (product) => product.productDesignation?.code === INVESTIGATIONAL_PRODUCT
  );
  const productClass = products.find(
    (product) => product.pharmacologicClass?.code
  )?.pharmacologicClass;
  const doseForm = products.find(
    (product) => product.administrableDoseForm?.standardCode?.code
  )?.administrableDoseForm.standardCode;

  const randomisation = readRandomisation(design, arms);

  const planned = design.population?.plannedEnrollmentNumber;
  const plannedEnrollment = planned && "value" in planned ? planned.value : 0;

  return {
    studyId,
    title,
    usdm,
    design: {
      phase: design.studyPhase?.standardCode?.decode ?? "",
      phaseCode: design.studyPhase?.standardCode?.code ?? "",
      model: design.model?.decode ?? "",
      modelCode: design.model?.code ?? "",
      blinding: design.blindingSchema?.standardCode?.decode ?? "",
      blindingCode: design.blindingSchema?.standardCode?.code ?? "",
      interventionType: coded(experimental?.type),
      pharmacologicClass: productClass
        ? { ...coded(productClass), version: productClass.codeSystemVersion }
        : null,
      doseForm: doseForm ? coded(doseForm) : null,
      plannedEnrollment,
      arms,
      epochs,
      elements: list(design.elements).map((el) => ({
        id: el.id,
        elementCode: el.label ?? el.id,
        name: el.name,
        description: el.description ?? "",
      })),
      cells: list(design.studyCells).map((cell) => ({
        armId: cell.armId,
        epochId: cell.epochId,
        elementIds: [...cell.elementIds],
      })),
      visits,
      activities,
      schedule,
      eligibilityCriteria: list(design.eligibilityCriteria).map(
        (criterion) => ({
          id: criterion.id,
          identifier: criterion.identifier,
          category:
            criterion.category.decode === "Inclusion Criteria"
              ? ("INCLUSION" as const)
              : ("EXCLUSION" as const),
          text:
            criterionItemsById.get(criterion.criterionItemId)?.text ??
            fail(
              `criterion ${criterion.id} references unknown item ${criterion.criterionItemId}`
            ),
        })
      ),
      objectives: list(design.objectives).map((obj) => ({
        id: obj.id,
        name: obj.name,
        text: obj.text,
        level: coded(obj.level),
        endpoints: list(obj.endpoints).map((ep) => ({
          id: ep.id,
          name: ep.name,
          text: ep.text,
          level: coded(ep.level),
          purpose: ep.purpose,
        })),
      })),
      estimands: list(design.estimands).map((est) => ({
        id: est.id,
        name: est.name,
        endpointId: est.variableOfInterestId,
        analysisPopulationId: est.analysisPopulationId,
        populationSummary: est.populationSummary,
        intercurrentEvents: list(est.intercurrentEvents).map((ice) => ({
          name: ice.name,
          text: ice.text,
          strategy: ice.strategy,
        })),
      })),
      analysisPopulations: list(design.analysisPopulations).map((pop) => ({
        id: pop.id,
        name: pop.name,
        text: pop.text,
      })),
      ...(randomisation ? { randomisation } : {}),
    },
  };
}
