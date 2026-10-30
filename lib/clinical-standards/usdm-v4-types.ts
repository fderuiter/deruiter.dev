/**
 * CDISC USDM v4.0 document types.
 *
 * Hand-written TypeScript for the part of the USDM v4.0 model that this
 * project reads and writes: study, study version, interventional study
 * design, arms, epochs, study cells and elements, encounters, activities,
 * schedule timelines (scheduled activity instances and timings),
 * biomedical concepts, objectives, endpoints, estimands and the small
 * supporting classes they need (Code, AliasCode, Quantity, Range,
 * ExtensionAttribute), and the protocol document classes Protocol Studio
 * writes: conditions and decision instances, parameter dictionaries,
 * narrative content, abbreviations and governance dates (#3398). Property
 * names, optionality and `instanceType`
 * discriminators follow the published USDM v4.0.0 API schema
 * (cdisc-org/DDF-RA, `Deliverables/API/USDM_API.json`); the test suite
 * checks documents built from these types against a vendored copy of that
 * schema. Classes this project never emits (amendments, products, devices,
 * sites) are left out rather than typed loosely, and so are the optional
 * comment annotations (`notes`) the schema allows on many classes.
 */
import { CLINICAL_STANDARDS_PROFILE } from "./profile";

/** The USDM release these types and the adapter's export target. */
export const USDM_V4_VERSION = CLINICAL_STANDARDS_PROFILE.USDM;

/**
 * Extension attribute URL carrying an activity's SDTM domain code (`VS`, `AE`, ...).
 * USDM v4 links activities to SDTM only through biomedical concepts and dataset
 * specializations, so a plain domain hint travels as an extension.
 */
export const USDM_SDTM_DOMAIN_EXTENSION_URL =
  "https://deruiter.dev/usdm/extensions/sdtm-domain";

/**
 * Extension attribute URL carrying a biomedical concept's SDTM test short
 * name (`--TESTCD`, for example `SYSBP`).
 */
export const USDM_SDTM_TESTCD_EXTENSION_URL =
  "https://deruiter.dev/usdm/extensions/sdtm-testcd";

/**
 * Extension attribute URL carrying a biomedical concept's standard result
 * unit (`--STRESU`, for example `mmHg`).
 */
export const USDM_SDTM_STRESU_EXTENSION_URL =
  "https://deruiter.dev/usdm/extensions/sdtm-stresu";

/**
 * Reads the `valueString` of the first extension attribute with the given URL
 * on any USDM object, or `undefined` when the object has none.
 */
export function getUsdmV4ExtensionString(
  owner: unknown,
  url: string
): string | undefined {
  if (!owner || typeof owner !== "object") return undefined;
  const attrs = (owner as { extensionAttributes?: unknown })
    .extensionAttributes;
  if (!Array.isArray(attrs)) return undefined;
  for (const attr of attrs) {
    if (
      attr &&
      typeof attr === "object" &&
      (attr as { url?: unknown }).url === url
    ) {
      const value = (attr as { valueString?: unknown }).valueString;
      return typeof value === "string" ? value : undefined;
    }
  }
  return undefined;
}

/** A USDM v4 extension attribute: the model's mechanism for sponsor-specific data. */
export interface UsdmV4ExtensionAttribute {
  id: string;
  url: string;
  valueString?: string | null;
  valueBoolean?: boolean | null;
  valueInteger?: number | null;
  valueId?: string | null;
  instanceType: "ExtensionAttribute";
}

/** Fields every identifiable USDM v4 class carries. */
export interface UsdmV4Base {
  id: string;
  extensionAttributes?: UsdmV4ExtensionAttribute[];
}

/** A coded value from a terminology (NCI EVS for CDISC CT). */
export interface UsdmV4Code extends UsdmV4Base {
  code: string;
  codeSystem: string;
  codeSystemVersion: string;
  decode: string;
  instanceType: "Code";
}

/** A standard code plus any aliases for it. */
export interface UsdmV4AliasCode extends UsdmV4Base {
  standardCode: UsdmV4Code;
  standardCodeAliases?: UsdmV4Code[];
  instanceType: "AliasCode";
}

/** A numeric value with an optional unit. */
export interface UsdmV4Quantity extends UsdmV4Base {
  value: number;
  unit?: UsdmV4AliasCode | null;
  instanceType: "Quantity";
}

/** A numeric range between two quantities. */
export interface UsdmV4Range extends UsdmV4Base {
  minValue: UsdmV4Quantity;
  maxValue: UsdmV4Quantity;
  isApproximate: boolean;
  instanceType: "Range";
}

/** A planned length of time, which may vary from subject to subject. */
export interface UsdmV4Duration extends UsdmV4Base {
  text?: string | null;
  quantity?: UsdmV4Quantity | UsdmV4Range | null;
  durationWillVary: boolean;
  reasonDurationWillVary?: string | null;
  instanceType: "Duration";
}

/** Common descriptive fields on named USDM v4 classes. */
export interface UsdmV4Named extends UsdmV4Base {
  name: string;
  label?: string | null;
  description?: string | null;
}

/** A protocol arm. */
export interface UsdmV4StudyArm extends UsdmV4Named {
  type: UsdmV4Code;
  dataOriginDescription: string;
  dataOriginType: UsdmV4Code;
  populationIds?: string[];
  instanceType: "StudyArm";
}

/** A protocol epoch, ordered through `previousId` / `nextId`. */
export interface UsdmV4StudyEpoch extends UsdmV4Named {
  type: UsdmV4Code;
  previousId?: string | null;
  nextId?: string | null;
  instanceType: "StudyEpoch";
}

/** A study element (the building block placed in a study cell). */
export interface UsdmV4StudyElement extends UsdmV4Named {
  studyInterventionIds?: string[];
  instanceType: "StudyElement";
}

/** The intersection of one arm and one epoch. */
export interface UsdmV4StudyCell extends UsdmV4Base {
  armId: string;
  epochId: string;
  elementIds: string[];
  instanceType: "StudyCell";
}

/** A planned contact with the subject (a visit). */
export interface UsdmV4Encounter extends UsdmV4Named {
  type: UsdmV4Code;
  previousId?: string | null;
  nextId?: string | null;
  scheduledAtId?: string | null;
  environmentalSettings?: UsdmV4Code[];
  contactModes?: UsdmV4Code[];
  instanceType: "Encounter";
}

/**
 * A stand-in for a biomedical concept that the CDISC library does not
 * define, so an activity can still say what it collects.
 */
export interface UsdmV4BiomedicalConceptSurrogate extends UsdmV4Named {
  reference?: string | null;
  instanceType: "BiomedicalConceptSurrogate";
}

/** A procedure that an activity performs. */
export interface UsdmV4Procedure extends UsdmV4Named {
  procedureType: string;
  code: UsdmV4Code;
  studyInterventionId?: string | null;
  instanceType: "Procedure";
}

/** An activity in the schedule of activities. */
export interface UsdmV4Activity extends UsdmV4Named {
  previousId?: string | null;
  nextId?: string | null;
  childIds?: string[];
  definedProcedures?: UsdmV4Procedure[];
  biomedicalConceptIds?: string[];
  bcCategoryIds?: string[];
  bcSurrogateIds?: string[];
  timelineId?: string | null;
  instanceType: "Activity";
}

/** A node on a schedule timeline that performs activities at an encounter. */
export interface UsdmV4ScheduledActivityInstance extends UsdmV4Named {
  defaultConditionId?: string | null;
  epochId?: string | null;
  timelineId?: string | null;
  timelineExitId?: string | null;
  activityIds?: string[];
  encounterId?: string | null;
  instanceType: "ScheduledActivityInstance";
}

/** The timing of one scheduled instance relative to another. */
export interface UsdmV4Timing extends UsdmV4Named {
  type: UsdmV4Code;
  /** ISO 8601 duration, e.g. `P14D`. */
  value: string;
  valueLabel: string;
  relativeToFrom: UsdmV4Code;
  relativeFromScheduledInstanceId: string;
  relativeToScheduledInstanceId?: string | null;
  /** ISO 8601 duration the visit may fall before its target. */
  windowLower?: string | null;
  /** ISO 8601 duration the visit may fall after its target. */
  windowUpper?: string | null;
  windowLabel?: string | null;
  instanceType: "Timing";
}

/** The end point of a schedule timeline. */
export interface UsdmV4ScheduleTimelineExit extends UsdmV4Base {
  instanceType: "ScheduleTimelineExit";
}

/** A schedule of activities. */
export interface UsdmV4ScheduleTimeline extends UsdmV4Named {
  mainTimeline: boolean;
  entryCondition: string;
  entryId: string;
  exits?: UsdmV4ScheduleTimelineExit[];
  timings?: UsdmV4Timing[];
  instances?: UsdmV4ScheduledActivityInstance[];
  plannedDuration?: UsdmV4Duration | null;
  instanceType: "ScheduleTimeline";
}

/** A permitted response for a biomedical concept property. */
export interface UsdmV4ResponseCode extends UsdmV4Base {
  name: string;
  label?: string | null;
  isEnabled: boolean;
  code: UsdmV4Code;
  instanceType: "ResponseCode";
}

/** A property (variable) of a biomedical concept. */
export interface UsdmV4BiomedicalConceptProperty extends UsdmV4Base {
  name: string;
  label?: string | null;
  isRequired: boolean;
  isEnabled: boolean;
  datatype: string;
  responseCodes?: UsdmV4ResponseCode[];
  code: UsdmV4AliasCode;
  instanceType: "BiomedicalConceptProperty";
}

/** A biomedical concept (CDISC 360 / COSMoS). */
export interface UsdmV4BiomedicalConcept extends UsdmV4Base {
  name: string;
  label?: string | null;
  synonyms?: string[];
  reference: string;
  properties?: UsdmV4BiomedicalConceptProperty[];
  code: UsdmV4AliasCode;
  instanceType: "BiomedicalConcept";
}

/** An endpoint of an objective. */
export interface UsdmV4Endpoint extends UsdmV4Named {
  text: string;
  dictionaryId?: string | null;
  purpose: string;
  level: UsdmV4Code;
  instanceType: "Endpoint";
}

/** A study objective and its endpoints. */
export interface UsdmV4Objective extends UsdmV4Named {
  text: string;
  dictionaryId?: string | null;
  level: UsdmV4Code;
  endpoints?: UsdmV4Endpoint[];
  instanceType: "Objective";
}

/** An intercurrent event and the strategy that handles it. */
export interface UsdmV4IntercurrentEvent extends UsdmV4Named {
  text: string;
  dictionaryId?: string | null;
  strategy: string;
  instanceType: "IntercurrentEvent";
}

/** An ICH E9(R1) estimand. */
export interface UsdmV4Estimand extends UsdmV4Named {
  populationSummary: string;
  analysisPopulationId: string;
  interventionIds: string[];
  variableOfInterestId: string;
  intercurrentEvents: UsdmV4IntercurrentEvent[];
  instanceType: "Estimand";
}

/** A named analysis population. */
export interface UsdmV4AnalysisPopulation extends UsdmV4Named {
  text: string;
  subsetOfIds?: string[];
  instanceType: "AnalysisPopulation";
}

/** A cohort within the study design population. */
export interface UsdmV4StudyCohort extends UsdmV4Named {
  includesHealthySubjects: boolean;
  plannedEnrollmentNumber?: UsdmV4Quantity | UsdmV4Range | null;
  plannedCompletionNumber?: UsdmV4Quantity | UsdmV4Range | null;
  plannedSex?: UsdmV4Code[];
  criterionIds?: string[];
  plannedAge?: UsdmV4Range | null;
  indicationIds?: string[];
  instanceType: "StudyCohort";
}

/** The population a study design targets. */
export interface UsdmV4StudyDesignPopulation extends UsdmV4Named {
  includesHealthySubjects: boolean;
  plannedEnrollmentNumber?: UsdmV4Quantity | UsdmV4Range | null;
  plannedCompletionNumber?: UsdmV4Quantity | UsdmV4Range | null;
  plannedSex?: UsdmV4Code[];
  criterionIds?: string[];
  plannedAge?: UsdmV4Range | null;
  cohorts?: UsdmV4StudyCohort[];
  instanceType: "StudyDesignPopulation";
}

/** One eligibility criterion, pointing at its text item. */
export interface UsdmV4EligibilityCriterion extends UsdmV4Named {
  category: UsdmV4Code;
  identifier: string;
  criterionItemId: string;
  nextId?: string | null;
  previousId?: string | null;
  instanceType: "EligibilityCriterion";
}

/** The text of an eligibility criterion. */
export interface UsdmV4EligibilityCriterionItem extends UsdmV4Named {
  text: string;
  dictionaryId?: string | null;
  instanceType: "EligibilityCriterionItem";
}

/** An interventional study design. */
export interface UsdmV4InterventionalStudyDesign extends UsdmV4Named {
  studyType?: UsdmV4Code | null;
  studyPhase?: UsdmV4AliasCode | null;
  therapeuticAreas?: UsdmV4Code[];
  characteristics?: UsdmV4Code[];
  encounters?: UsdmV4Encounter[];
  activities?: UsdmV4Activity[];
  arms: UsdmV4StudyArm[];
  studyCells: UsdmV4StudyCell[];
  rationale: string;
  epochs: UsdmV4StudyEpoch[];
  elements?: UsdmV4StudyElement[];
  estimands?: UsdmV4Estimand[];
  studyInterventionIds?: string[];
  objectives?: UsdmV4Objective[];
  population: UsdmV4StudyDesignPopulation;
  scheduleTimelines?: UsdmV4ScheduleTimeline[];
  eligibilityCriteria: UsdmV4EligibilityCriterion[];
  analysisPopulations?: UsdmV4AnalysisPopulation[];
  subTypes?: UsdmV4Code[];
  model: UsdmV4Code;
  intentTypes?: UsdmV4Code[];
  blindingSchema?: UsdmV4AliasCode | null;
  instanceType: "InterventionalStudyDesign";
}

/** An identifier for the study issued by an organization. */
export interface UsdmV4StudyIdentifier extends UsdmV4Base {
  text: string;
  scopeId: string;
  instanceType: "StudyIdentifier";
}

/** A study title of a given type (official, brief, ...). */
export interface UsdmV4StudyTitle extends UsdmV4Base {
  text: string;
  type: UsdmV4Code;
  instanceType: "StudyTitle";
}

/** An organization, such as the sponsor. */
export interface UsdmV4Organization extends UsdmV4Base {
  name: string;
  label?: string | null;
  type: UsdmV4Code;
  identifierScheme: string;
  identifier: string;
  instanceType: "Organization";
}

/** A study intervention (the investigational product or placebo). */
export interface UsdmV4StudyIntervention extends UsdmV4Named {
  role: UsdmV4Code;
  type: UsdmV4Code;
  codes?: UsdmV4Code[];
  instanceType: "StudyIntervention";
}

/**
 * A product administered in the study: its dose form, whether it is an
 * investigational product, and its pharmacologic class (MED-RT).
 */
export interface UsdmV4AdministrableProduct extends UsdmV4Named {
  administrableDoseForm: UsdmV4AliasCode;
  productDesignation: UsdmV4Code;
  pharmacologicClass?: UsdmV4Code | null;
  instanceType: "AdministrableProduct";
}

/** One version of the study definition. */
export interface UsdmV4StudyVersion extends UsdmV4Base {
  versionIdentifier: string;
  rationale: string;
  studyIdentifiers: UsdmV4StudyIdentifier[];
  studyDesigns?: UsdmV4InterventionalStudyDesign[];
  titles: UsdmV4StudyTitle[];
  eligibilityCriterionItems?: UsdmV4EligibilityCriterionItem[];
  roles?: UsdmV4StudyRole[];
  organizations?: UsdmV4Organization[];
  studyInterventions?: UsdmV4StudyIntervention[];
  administrableProducts?: UsdmV4AdministrableProduct[];
  biomedicalConcepts?: UsdmV4BiomedicalConcept[];
  bcSurrogates?: UsdmV4BiomedicalConceptSurrogate[];
  conditions?: UsdmV4Condition[];
  dictionaries?: UsdmV4SyntaxTemplateDictionary[];
  abbreviations?: UsdmV4Abbreviation[];
  narrativeContentItems?: UsdmV4NarrativeContentItem[];
  dateValues?: UsdmV4GovernanceDate[];
  instanceType: "StudyVersion";
}

/** Whether a study role is masked, and how. */
export interface UsdmV4Masking extends UsdmV4Base {
  text: string;
  isMasked: boolean;
  instanceType: "Masking";
}

/**
 * A condition the protocol states in words, such as a dosing rule, and the
 * activities or instances it applies to.
 */
export interface UsdmV4Condition extends UsdmV4Named {
  text: string;
  dictionaryId?: string | null;
  contextIds?: string[];
  appliesToIds?: string[];
  instanceType: "Condition";
}

/** One branch of a decision: the condition and the instance it leads to. */
export interface UsdmV4ConditionAssignment extends UsdmV4Base {
  condition: string;
  conditionTargetId: string;
  instanceType: "ConditionAssignment";
}

/**
 * A node on a schedule timeline where the path depends on a condition. The
 * schema puts it in `ScheduleTimeline.instances` beside scheduled activity
 * instances; `UsdmV4ScheduleTimeline` types that list as activity instances
 * only, since every timeline this project reads is linear.
 */
export interface UsdmV4ScheduledDecisionInstance extends UsdmV4Named {
  defaultConditionId?: string | null;
  epochId?: string | null;
  conditionAssignments: UsdmV4ConditionAssignment[];
  instanceType: "ScheduledDecisionInstance";
}

/** A tag in a syntax template and the model attribute it is filled from. */
export interface UsdmV4ParameterMap extends UsdmV4Base {
  tag: string;
  reference: string;
  instanceType: "ParameterMap";
}

/**
 * The parameters of the syntax templates (objective, endpoint and criterion
 * texts) that name it through `dictionaryId`.
 */
export interface UsdmV4SyntaxTemplateDictionary extends UsdmV4Named {
  parameterMaps: UsdmV4ParameterMap[];
  instanceType: "SyntaxTemplateDictionary";
}

/** The text of one narrative section, kept apart so sections can share it. */
export interface UsdmV4NarrativeContentItem extends UsdmV4Base {
  name: string;
  text: string;
  instanceType: "NarrativeContentItem";
}

/** One section of a study definition document, ordered by `previousId` / `nextId`. */
export interface UsdmV4NarrativeContent extends UsdmV4Base {
  name: string;
  sectionNumber?: string | null;
  sectionTitle?: string | null;
  displaySectionNumber: boolean;
  displaySectionTitle: boolean;
  childIds?: string[];
  previousId?: string | null;
  nextId?: string | null;
  contentItemId?: string | null;
  instanceType: "NarrativeContent";
}

/** Where a governance date applies: globally, a region or a country. */
export interface UsdmV4GeographicScope extends UsdmV4Base {
  type: UsdmV4Code;
  code?: UsdmV4AliasCode | null;
  instanceType: "GeographicScope";
}

/** A dated governance milestone, such as a protocol approval. */
export interface UsdmV4GovernanceDate extends UsdmV4Named {
  type: UsdmV4Code;
  /** ISO 8601 date. */
  dateValue: string;
  geographicScopes: UsdmV4GeographicScope[];
  instanceType: "GovernanceDate";
}

/** One version of a study definition document, with its sections. */
export interface UsdmV4StudyDefinitionDocumentVersion extends UsdmV4Base {
  version: string;
  status: UsdmV4Code;
  dateValues?: UsdmV4GovernanceDate[];
  contents?: UsdmV4NarrativeContent[];
  instanceType: "StudyDefinitionDocumentVersion";
}

/** A document that defines the study, such as the protocol. */
export interface UsdmV4StudyDefinitionDocument extends UsdmV4Named {
  language: UsdmV4Code;
  type: UsdmV4Code;
  templateName: string;
  versions?: UsdmV4StudyDefinitionDocumentVersion[];
  childIds?: string[];
  instanceType: "StudyDefinitionDocument";
}

/** An abbreviation used in the study's documents, and what it stands for. */
export interface UsdmV4Abbreviation extends UsdmV4Base {
  abbreviatedText: string;
  expandedText: string;
  instanceType: "Abbreviation";
}

/** A role in the study, such as the sponsor or the investigator. */
export interface UsdmV4StudyRole extends UsdmV4Named {
  code: UsdmV4Code;
  /** The study version or study designs the role applies to. */
  appliesToIds?: string[];
  organizationIds?: string[];
  masking?: UsdmV4Masking | null;
  instanceType: "StudyRole";
}

/** The study, holding one or more versions. */
export interface UsdmV4Study {
  /** A UUID, or `null`: the USDM v4 schema accepts nothing else here. */
  id?: string | null;
  extensionAttributes?: UsdmV4ExtensionAttribute[];
  name: string;
  description?: string | null;
  label?: string | null;
  versions?: UsdmV4StudyVersion[];
  documentedBy?: UsdmV4StudyDefinitionDocument[];
  instanceType: "Study";
}

/** The top-level USDM v4 document (the API "Wrapper"). */
export interface UsdmV4Document {
  study: UsdmV4Study;
  usdmVersion: string;
  systemName?: string | null;
  systemVersion?: string | null;
}
