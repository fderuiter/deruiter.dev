/** SDTMIG 3.4 subject tabulations from the separate synthetic collection layer. */
import type {
  CellValue,
  Dataset,
  StudyDefinition,
  VariableMeta,
  VariableOrigin,
  VariableRole,
} from "../../types";
import { terminologyCodelist } from "@/lib/clinical-standards";
import { codeAeTerm, codeHistoryTerm } from "./ae-dictionary";
import { codeMedication } from "./cm-dictionary";
import { sdtmCodelist } from "./codelists";
import { deriveComments } from "./comments";
import { labReference } from "./lab-ranges";
import { deriveRelrec } from "./relrec";
import { sdtmRequired } from "./required";
import type { SdtmMethodId } from "./methods";
import { deriveSubjectElements } from "./subject-elements";
import { toStandardUnit } from "./units";

type Row = Record<string, CellValue>;
type SubjectDomain =
  | "DM"
  | "SV"
  | "EX"
  | "CM"
  | "AE"
  | "MH"
  | "IE"
  | "VS"
  | "LB"
  | "EG"
  | "DS"
  | "SUPPDM"
  | "RELREC"
  | "SE"
  | "CO"
  | "CE";
interface ColumnSpec {
  readonly name: string;
  readonly label: string;
  readonly role: VariableRole;
  readonly type?: VariableMeta["type"];
  readonly origin: VariableOrigin;
  readonly method?: SdtmMethodId;
  readonly source?: string;
}
interface DomainSpec {
  readonly label: string;
  readonly class: string;
  readonly structure: string;
  readonly keys: readonly string[];
  readonly columns: readonly ColumnSpec[];
}
const assigned = (
  name: string,
  label: string,
  role: VariableRole = "Identifier"
): ColumnSpec => ({ name, label, role, origin: "Assigned" });
const collected = (
  name: string,
  label: string,
  source: string,
  role: VariableRole = "Topic",
  type?: VariableMeta["type"]
): ColumnSpec => ({ name, label, role, type, origin: "Collected", source });
const derived = (
  name: string,
  label: string,
  method: SdtmMethodId,
  role: VariableRole = "Timing",
  type?: VariableMeta["type"]
): ColumnSpec => ({ name, label, role, type, origin: "Derived", method });
const COMMON = [
  assigned("STUDYID", "Study Identifier"),
  assigned("DOMAIN", "Domain Abbreviation"),
  assigned("USUBJID", "Unique Subject Identifier"),
] as const;
const SEQ = (domain: string) =>
  derived(
    `${domain}SEQ`,
    "Sequence Number",
    "SOURCE_ORDER",
    "Identifier",
    "integer"
  );
/** A variable looked up from the AE preferred term in the study dictionary. */
const coded = (name: string, label: string, type?: VariableMeta["type"]) =>
  derived(name, label, "AE_DICTIONARY_CODING", "Variable Qualifier", type);
const EPOCH = derived("EPOCH", "Epoch", "ACTUAL_ELEMENT_FROM_TA_TE", "Timing");
const VISITNUM = collected(
  "VISITNUM",
  "Visit Number",
  "SV.VISITNUM",
  "Timing",
  "float"
);
const VISIT = collected("VISIT", "Visit Name", "SV.VISIT", "Timing");
// SV is one record per visit, so the visit is its topic (SDTMIG 3.4 roles).
const SV_VISITNUM: ColumnSpec = { ...VISITNUM, role: "Topic" };
const SV_VISIT: ColumnSpec = { ...VISIT, role: "Synonym Qualifier" };
/** The seriousness criteria AE carries, in SDTMIG 3.4 order and labels. */
const AE_SERIOUSNESS_CRITERIA = [
  ["AESCONG", "Congenital Anomaly or Birth Defect"],
  ["AESDISAB", "Persist or Signif Disability/Incapacity"],
  ["AESDTH", "Results in Death"],
  ["AESHOSP", "Requires or Prolongs Hospitalization"],
  ["AESLIFE", "Is Life Threatening"],
  ["AESMIE", "Other Medically Important Serious Event"],
] as const;
const SPECS: Record<SubjectDomain, DomainSpec> = {
  DM: {
    label: "Demographics",
    class: "Special Purpose",
    structure: "One record per subject",
    keys: ["STUDYID", "USUBJID"],
    columns: [
      ...COMMON,
      collected("SUBJID", "Subject Identifier", "DM.USUBJID", "Topic"),
      derived(
        "RFSTDTC",
        "Subject Reference Start Date",
        "FIRST_EXPOSURE",
        "Record Qualifier",
        "date"
      ),
      derived(
        "RFENDTC",
        "Subject Reference End Date",
        "LAST_EXPOSURE",
        "Record Qualifier",
        "date"
      ),
      derived(
        "RFXSTDTC",
        "Date of First Study Treatment",
        "FIRST_EXPOSURE",
        "Record Qualifier",
        "date"
      ),
      derived(
        "RFXENDTC",
        "Date of Last Study Treatment",
        "LAST_EXPOSURE",
        "Record Qualifier",
        "date"
      ),
      collected(
        "RFICDTC",
        "Informed Consent Date",
        "DM.CONSENTDTC",
        "Record Qualifier",
        "date"
      ),
      derived(
        "RFPENDTC",
        "Date/Time of End of Participation",
        "LAST_PARTICIPATION",
        "Record Qualifier",
        "date"
      ),
      derived(
        "DTHDTC",
        "Date/Time of Death",
        "DEATH_DATE",
        "Record Qualifier",
        "date"
      ),
      derived("DTHFL", "Subject Death Flag", "DEATH_FLAG", "Record Qualifier"),
      collected(
        "SITEID",
        "Study Site Identifier",
        "DM.SITEID",
        "Record Qualifier"
      ),
      collected("AGE", "Age", "DM.AGE", "Record Qualifier", "integer"),
      assigned("AGEU", "Age Units", "Variable Qualifier"),
      collected("SEX", "Sex", "DM.SEX", "Record Qualifier"),
      collected("RACE", "Race", "DM.RACE", "Record Qualifier"),
      derived("ARMCD", "Planned Arm Code", "RANDOMIZATION", "Record Qualifier"),
      derived(
        "ARM",
        "Description of Planned Arm",
        "RANDOMIZATION",
        "Synonym Qualifier"
      ),
      derived(
        "ACTARMCD",
        "Actual Arm Code",
        "EXPOSURE_ARM",
        "Record Qualifier"
      ),
      derived(
        "ACTARM",
        "Description of Actual Arm",
        "EXPOSURE_ARM",
        "Synonym Qualifier"
      ),
      derived(
        "ARMNRS",
        "Reason Arm and/or Actual Arm is Null",
        "ARM_NULL_REASON",
        "Record Qualifier"
      ),
      derived(
        "ACTARMUD",
        "Description of Unplanned Actual Arm",
        "UNPLANNED_ARM",
        "Record Qualifier"
      ),
      collected("COUNTRY", "Country", "DM.COUNTRY", "Record Qualifier"),
    ],
  },
  SV: {
    label: "Subject Visits",
    class: "Special Purpose",
    structure: "One record per actual or planned visit per subject",
    keys: ["STUDYID", "USUBJID", "VISITNUM"],
    columns: [
      ...COMMON,
      SV_VISITNUM,
      SV_VISIT,
      derived(
        "SVPRESP",
        "Pre-specified",
        "PLANNED_VISIT",
        "Variable Qualifier"
      ),
      derived("SVOCCUR", "Occurrence", "VISIT_OCCURRED", "Record Qualifier"),
      collected("SVSTDTC", "Start Date of Visit", "SV.SVDTC", "Timing", "date"),
      collected("SVENDTC", "End Date of Visit", "SV.SVDTC", "Timing", "date"),
      derived(
        "SVSTDY",
        "Study Day of Start of Visit",
        "STUDY_DAY",
        "Timing",
        "integer"
      ),
      derived(
        "SVENDY",
        "Study Day of End of Visit",
        "STUDY_DAY",
        "Timing",
        "integer"
      ),
    ],
  },
  EX: {
    label: "Exposure",
    class: "Interventions",
    structure: "One record per constant-dosing interval per subject",
    keys: ["STUDYID", "USUBJID", "EXSEQ"],
    columns: [
      ...COMMON,
      SEQ("EX"),
      collected("EXTRT", "Name of Treatment", "EX.EXTRT"),
      collected("EXDOSE", "Dose", "EX.EXDOSE", "Record Qualifier", "float"),
      derived("EXDOSU", "Dose Units", "CT_UNIT_MAPPING", "Variable Qualifier"),
      derived("EXDOSFRM", "Dose Form", "USDM_DOSE_FORM", "Variable Qualifier"),
      EPOCH,
      collected(
        "EXSTDTC",
        "Start Date of Treatment",
        "EX.EXSTDTC",
        "Timing",
        "date"
      ),
      collected(
        "EXENDTC",
        "End Date of Treatment",
        "EX.EXENDTC",
        "Timing",
        "date"
      ),
      derived(
        "EXSTDY",
        "Study Day of Start of Treatment",
        "STUDY_DAY",
        "Timing",
        "integer"
      ),
      derived(
        "EXENDY",
        "Study Day of End of Treatment",
        "STUDY_DAY",
        "Timing",
        "integer"
      ),
    ],
  },
  CM: {
    label: "Concomitant/Prior Medications",
    class: "Interventions",
    structure:
      "One record per recorded intervention occurrence or constant-dosing interval per subject",
    keys: ["STUDYID", "USUBJID", "CMSEQ"],
    columns: [
      ...COMMON,
      SEQ("CM"),
      collected("CMTRT", "Reported Name of Drug, Med, or Therapy", "CM.CMTRT"),
      derived(
        "CMDECOD",
        "Standardized Medication Name",
        "CM_DICTIONARY_CODING",
        "Synonym Qualifier"
      ),
      collected(
        "CMCAT",
        "Category for Medication",
        "CM.CMCAT",
        "Grouping Qualifier"
      ),
      collected("CMINDC", "Indication", "CM.CMINDC", "Record Qualifier"),
      derived(
        "CMCLAS",
        "Medication Class",
        "CM_DICTIONARY_CODING",
        "Variable Qualifier"
      ),
      derived(
        "CMCLASCD",
        "Medication Class Code",
        "CM_DICTIONARY_CODING",
        "Variable Qualifier"
      ),
      collected(
        "CMDOSE",
        "Dose per Administration",
        "CM.CMDOSE",
        "Record Qualifier",
        "float"
      ),
      collected("CMDOSU", "Dose Units", "CM.CMDOSU", "Variable Qualifier"),
      collected(
        "CMDOSFRQ",
        "Dosing Frequency per Interval",
        "CM.CMDOSFRQ",
        "Record Qualifier"
      ),
      collected(
        "CMROUTE",
        "Route of Administration",
        "CM.CMROUTE",
        "Variable Qualifier"
      ),
      EPOCH,
      collected(
        "CMSTDTC",
        "Start Date/Time of Medication",
        "CM.CMSTDTC",
        "Timing",
        "date"
      ),
      collected(
        "CMENDTC",
        "End Date/Time of Medication",
        "CM.CMENDTC",
        "Timing",
        "date"
      ),
      derived(
        "CMSTDY",
        "Study Day of Start of Medication",
        "STUDY_DAY",
        "Timing",
        "integer"
      ),
      derived(
        "CMENDY",
        "Study Day of End of Medication",
        "STUDY_DAY",
        "Timing",
        "integer"
      ),
      derived(
        "CMENRTPT",
        "End Relative to Reference Time Point",
        "CM_ONGOING",
        "Timing"
      ),
      derived("CMENTPT", "End Reference Time Point", "CM_ONGOING", "Timing"),
    ],
  },
  MH: {
    label: "Medical History",
    class: "Events",
    structure: "One record per medical history event per subject",
    keys: ["STUDYID", "USUBJID", "MHSEQ"],
    columns: [
      ...COMMON,
      SEQ("MH"),
      collected("MHTERM", "Reported Term for the Medical History", "MH.MHTERM"),
      derived(
        "MHDECOD",
        "Dictionary-Derived Term",
        "MH_DICTIONARY_CODING",
        "Synonym Qualifier"
      ),
      collected(
        "MHCAT",
        "Category for Medical History",
        "MH.MHCAT",
        "Grouping Qualifier"
      ),
      derived(
        "MHBODSYS",
        "Body System or Organ Class",
        "MH_DICTIONARY_CODING",
        "Record Qualifier"
      ),
      collected(
        "MHDTC",
        "Date/Time of History Collection",
        "MH.MHDTC",
        "Timing",
        "date"
      ),
      collected(
        "MHSTDTC",
        "Start Date/Time of Medical History Event",
        "MH.MHSTDTC",
        "Timing",
        "date"
      ),
      collected(
        "MHENDTC",
        "End Date/Time of Medical History Event",
        "MH.MHENDTC",
        "Timing",
        "date"
      ),
      derived(
        "MHDY",
        "Study Day of History Collection",
        "STUDY_DAY",
        "Timing",
        "integer"
      ),
      derived(
        "MHENRTPT",
        "End Relative to Reference Time Point",
        "MH_ONGOING",
        "Timing"
      ),
      derived("MHENTPT", "End Reference Time Point", "MH_ONGOING", "Timing"),
    ],
  },
  IE: {
    label: "Inclusion/Exclusion Criteria Not Met",
    class: "Findings",
    structure:
      "One record per inclusion/exclusion criterion not met per subject",
    keys: ["STUDYID", "USUBJID", "IETESTCD"],
    columns: [
      ...COMMON,
      SEQ("IE"),
      collected(
        "IETESTCD",
        "Inclusion/Exclusion Criterion Short Name",
        "IE.IETESTCD"
      ),
      derived(
        "IETEST",
        "Inclusion/Exclusion Criterion",
        "IE_CRITERION_FROM_TI",
        "Synonym Qualifier"
      ),
      collected(
        "IECAT",
        "Inclusion/Exclusion Category",
        "IE.IECAT",
        "Grouping Qualifier"
      ),
      derived(
        "IEORRES",
        "I/E Criterion Original Result",
        "IE_RESULT",
        "Result Qualifier"
      ),
      derived(
        "IESTRESC",
        "I/E Criterion Result in Std Format",
        "IE_RESULT",
        "Result Qualifier"
      ),
      VISITNUM,
      VISIT,
      EPOCH,
      collected(
        "IEDTC",
        "Date/Time of Collection",
        "IE.IEDTC",
        "Timing",
        "date"
      ),
    ],
  },
  AE: {
    label: "Adverse Events",
    class: "Events",
    structure: "One record per adverse event per subject",
    keys: ["STUDYID", "USUBJID", "AESEQ"],
    columns: [
      ...COMMON,
      SEQ("AE"),
      collected("AETERM", "Reported Term for the Adverse Event", "AE.AEDECOD"),
      coded("AELLT", "Lowest Level Term"),
      coded("AELLTCD", "Lowest Level Term Code", "integer"),
      collected(
        "AEDECOD",
        "Dictionary Derived Term",
        "AE.AEDECOD",
        "Synonym Qualifier"
      ),
      coded("AEPTCD", "Preferred Term Code", "integer"),
      coded("AEHLT", "High Level Term"),
      coded("AEHLTCD", "High Level Term Code", "integer"),
      coded("AEHLGT", "High Level Group Term"),
      coded("AEHLGTCD", "High Level Group Term Code", "integer"),
      collected(
        "AEBODSYS",
        "Body System or Organ Class",
        "AE.AEBODSYS",
        "Record Qualifier"
      ),
      coded("AEBDSYCD", "Body System or Organ Class Code", "integer"),
      coded("AESOC", "Primary System Organ Class"),
      coded("AESOCCD", "Primary System Organ Class Code", "integer"),
      collected("AESER", "Serious Event", "AE.AESER", "Record Qualifier"),
      collected(
        "AEACN",
        "Action Taken with Study Treatment",
        "AE.AEACN",
        "Record Qualifier"
      ),
      derived(
        "AEREL",
        "Causality",
        "CT_RELATIONSHIP_MAPPING",
        "Record Qualifier"
      ),
      ...AE_SERIOUSNESS_CRITERIA.map(([name, label]) =>
        collected(name, label, `AE.${name}`, "Record Qualifier")
      ),
      EPOCH,
      collected(
        "AESTDTC",
        "Start Date of Adverse Event",
        "AE.AESTDTC",
        "Timing",
        "date"
      ),
      collected(
        "AEENDTC",
        "End Date of Adverse Event",
        "AE.AEENDTC",
        "Timing",
        "date"
      ),
      derived(
        "AESTDY",
        "Study Day of Start of Adverse Event",
        "STUDY_DAY",
        "Timing",
        "integer"
      ),
      derived(
        "AEENDY",
        "Study Day of End of Adverse Event",
        "STUDY_DAY",
        "Timing",
        "integer"
      ),
    ],
  },
  VS: {
    label: "Vital Signs",
    class: "Findings",
    structure: "One record per vital sign measurement per visit per subject",
    keys: ["STUDYID", "USUBJID", "VSSEQ"],
    columns: [
      ...COMMON,
      SEQ("VS"),
      collected("VSTESTCD", "Vital Signs Test Short Name", "VS.VSTESTCD"),
      derived(
        "VSTEST",
        "Vital Signs Test Name",
        "USDM_ASSESSMENT",
        "Synonym Qualifier"
      ),
      derived(
        "VSORRES",
        "Result or Finding in Original Units",
        "TEXT_RESULT",
        "Result Qualifier"
      ),
      collected(
        "VSORRESU",
        "Original Units",
        "VS.VSORRESU",
        "Variable Qualifier"
      ),
      derived(
        "VSSTRESC",
        "Character Result in Standard Units",
        "STANDARD_RESULT",
        "Result Qualifier"
      ),
      derived(
        "VSSTRESN",
        "Numeric Result in Standard Units",
        "STANDARD_RESULT",
        "Result Qualifier",
        "float"
      ),
      derived(
        "VSSTRESU",
        "Standard Units",
        "USDM_ASSESSMENT",
        "Variable Qualifier"
      ),
      derived(
        "VSLOBXFL",
        "Last Observation Before Exposure Flag",
        "LAST_PRE_DOSE",
        "Record Qualifier"
      ),
      VISITNUM,
      VISIT,
      EPOCH,
      collected("VSDTC", "Date of Vital Signs", "VS.VSDTC", "Timing", "date"),
      derived(
        "VSDY",
        "Study Day of Vital Signs",
        "STUDY_DAY",
        "Timing",
        "integer"
      ),
    ],
  },
  LB: {
    label: "Laboratory Test Results",
    class: "Findings",
    structure: "One record per lab test per visit per subject",
    keys: ["STUDYID", "USUBJID", "LBSEQ"],
    columns: [
      ...COMMON,
      SEQ("LB"),
      collected("LBTESTCD", "Lab Test Short Name", "LB.LBTESTCD"),
      derived(
        "LBTEST",
        "Lab Test Name",
        "USDM_ASSESSMENT",
        "Synonym Qualifier"
      ),
      derived(
        "LBCAT",
        "Category for Lab Test",
        "LAB_CATEGORY",
        "Grouping Qualifier"
      ),
      derived(
        "LBORRES",
        "Result or Finding in Original Units",
        "TEXT_RESULT",
        "Result Qualifier"
      ),
      collected(
        "LBORRESU",
        "Original Units",
        "LB.LBORRESU",
        "Variable Qualifier"
      ),
      derived(
        "LBORNRLO",
        "Reference Range Lower Limit in Orig Unit",
        "LAB_REFERENCE_RANGE",
        "Variable Qualifier"
      ),
      derived(
        "LBORNRHI",
        "Reference Range Upper Limit in Orig Unit",
        "LAB_REFERENCE_RANGE",
        "Variable Qualifier"
      ),
      derived(
        "LBSTRESC",
        "Character Result in Standard Units",
        "STANDARD_RESULT",
        "Result Qualifier"
      ),
      derived(
        "LBSTRESN",
        "Numeric Result in Standard Units",
        "STANDARD_RESULT",
        "Result Qualifier",
        "float"
      ),
      derived(
        "LBSTRESU",
        "Standard Units",
        "USDM_ASSESSMENT",
        "Variable Qualifier"
      ),
      derived(
        "LBSTNRLO",
        "Reference Range Lower Limit-Std Units",
        "LAB_REFERENCE_RANGE",
        "Variable Qualifier",
        "float"
      ),
      derived(
        "LBSTNRHI",
        "Reference Range Upper Limit-Std Units",
        "LAB_REFERENCE_RANGE",
        "Variable Qualifier",
        "float"
      ),
      collected(
        "LBNRIND",
        "Reference Range Indicator",
        "LB.LBNRIND",
        "Variable Qualifier"
      ),
      derived(
        "LBLOBXFL",
        "Last Observation Before Exposure Flag",
        "LAST_PRE_DOSE",
        "Record Qualifier"
      ),
      VISITNUM,
      VISIT,
      EPOCH,
      collected("LBDTC", "Date of Lab Test", "LB.LBDTC", "Timing", "date"),
      derived(
        "LBDY",
        "Study Day of Lab Test",
        "STUDY_DAY",
        "Timing",
        "integer"
      ),
    ],
  },
  EG: {
    label: "ECG Test Results",
    class: "Findings",
    structure:
      "One record per ECG observation per replicate per time point or one record per ECG observation per beat per visit per subject",
    keys: ["STUDYID", "USUBJID", "EGSEQ"],
    columns: [
      ...COMMON,
      SEQ("EG"),
      collected(
        "EGTESTCD",
        "ECG Test or Examination Short Name",
        "EG.EGTESTCD"
      ),
      derived(
        "EGTEST",
        "ECG Test or Examination Name",
        "USDM_ASSESSMENT",
        "Synonym Qualifier"
      ),
      derived(
        "EGORRES",
        "Result or Finding in Original Units",
        "TEXT_RESULT",
        "Result Qualifier"
      ),
      collected(
        "EGORRESU",
        "Original Units",
        "EG.EGORRESU",
        "Variable Qualifier"
      ),
      derived(
        "EGSTRESC",
        "Character Result/Finding in Std Format",
        "STANDARD_RESULT",
        "Result Qualifier"
      ),
      derived(
        "EGSTRESN",
        "Numeric Result/Finding in Standard Units",
        "STANDARD_RESULT",
        "Result Qualifier",
        "float"
      ),
      derived(
        "EGSTRESU",
        "Standard Units",
        "USDM_ASSESSMENT",
        "Variable Qualifier"
      ),
      derived(
        "EGLOBXFL",
        "Last Observation Before Exposure Flag",
        "LAST_PRE_DOSE",
        "Record Qualifier"
      ),
      VISITNUM,
      VISIT,
      EPOCH,
      collected("EGDTC", "Date/Time of ECG", "EG.EGDTC", "Timing", "date"),
      derived("EGDY", "Study Day of ECG", "STUDY_DAY", "Timing", "integer"),
    ],
  },
  DS: {
    label: "Disposition",
    class: "Events",
    structure:
      "One record per disposition status or protocol milestone per subject",
    keys: ["STUDYID", "USUBJID", "DSSEQ"],
    columns: [
      ...COMMON,
      SEQ("DS"),
      collected("DSTERM", "Reported Term for Disposition", "DS.DSDECOD"),
      collected(
        "DSDECOD",
        "Standardized Disposition Term",
        "DS.DSDECOD",
        "Synonym Qualifier"
      ),
      collected(
        "DSCAT",
        "Category for Disposition",
        "DS.DSSCAT",
        "Grouping Qualifier"
      ),
      EPOCH,
      collected(
        "DSSTDTC",
        "Start Date of Disposition Event",
        "DS.DSSTDTC",
        "Timing",
        "date"
      ),
      derived(
        "DSSTDY",
        "Study Day of Disposition Event",
        "STUDY_DAY",
        "Timing",
        "integer"
      ),
    ],
  },
  SUPPDM: {
    label: "Supplemental Qualifiers for DM",
    class: "Relationships",
    structure: "One record per supplemental qualifier per subject",
    keys: ["STUDYID", "RDOMAIN", "USUBJID", "QNAM"],
    columns: [
      assigned("STUDYID", "Study Identifier"),
      assigned("RDOMAIN", "Related Domain Abbreviation"),
      assigned("USUBJID", "Unique Subject Identifier"),
      assigned("IDVAR", "Identifying Variable", "Record Qualifier"),
      assigned("IDVARVAL", "Identifying Variable Value", "Record Qualifier"),
      assigned("QNAM", "Qualifier Variable Name", "Topic"),
      assigned("QLABEL", "Qualifier Variable Label", "Synonym Qualifier"),
      collected(
        "QVAL",
        "Data Value",
        "DM.SCREENFL or DM.RANDFL",
        "Result Qualifier"
      ),
      assigned("QORIG", "Origin", "Record Qualifier"),
      assigned("QEVAL", "Evaluator", "Record Qualifier"),
    ],
  },
  // Each adverse event and the medication given for it (#3414).
  RELREC: {
    label: "Related Records",
    class: "Relationships",
    structure: "One record per related record per relationship",
    keys: ["STUDYID", "RDOMAIN", "USUBJID", "IDVAR", "IDVARVAL", "RELID"],
    columns: [
      assigned("STUDYID", "Study Identifier"),
      assigned("RDOMAIN", "Related Domain Abbreviation"),
      assigned("USUBJID", "Unique Subject Identifier"),
      // SDTMIG 3.4 makes the keys of the related record Identifiers.
      assigned("IDVAR", "Identifying Variable"),
      assigned("IDVARVAL", "Identifying Variable Value"),
      assigned("RELTYPE", "Relationship Type", "Record Qualifier"),
      derived(
        "RELID",
        "Relationship Identifier",
        "RELATED_RECORDS",
        "Record Qualifier"
      ),
    ],
  },
  // The elements each subject passed through (#2711).
  SE: {
    label: "Subject Elements",
    class: "Special Purpose",
    structure: "One record per actual Element per subject",
    keys: ["STUDYID", "USUBJID", "ETCD", "SESTDTC"],
    columns: [
      ...COMMON,
      SEQ("SE"),
      derived("ETCD", "Element Code", "SUBJECT_ELEMENT", "Topic"),
      derived(
        "ELEMENT",
        "Description of Element",
        "SUBJECT_ELEMENT",
        "Synonym Qualifier"
      ),
      derived(
        "TAETORD",
        "Planned Order of Element within Arm",
        "SUBJECT_ELEMENT",
        "Timing",
        "integer"
      ),
      derived("EPOCH", "Epoch", "SUBJECT_ELEMENT", "Timing"),
      derived(
        "SESTDTC",
        "Start Date/Time of Element",
        "ELEMENT_START",
        "Timing",
        "date"
      ),
      derived(
        "SEENDTC",
        "End Date/Time of Element",
        "ELEMENT_END",
        "Timing",
        "date"
      ),
      derived(
        "SESTDY",
        "Study Day of Start of Element",
        "STUDY_DAY",
        "Timing",
        "integer"
      ),
      derived(
        "SEENDY",
        "Study Day of End of Element",
        "STUDY_DAY",
        "Timing",
        "integer"
      ),
      derived(
        "SEUPDES",
        "Description of Unplanned Element",
        "UNPLANNED_ELEMENT",
        "Synonym Qualifier"
      ),
    ],
  },
  // The comments a site recorded against a subject's records (#2711).
  CE: {
    label: "Clinical Events",
    class: "Events",
    structure: "One record per event per subject",
    keys: ["STUDYID", "USUBJID", "CEDECOD", "CESTDTC"],
    columns: [
      ...COMMON,
      SEQ("CE"),
      collected("CETERM", "Reported Term for the Clinical Event", "CE.CETERM"),
      collected(
        "CEDECOD",
        "Dictionary-Derived Term",
        "CE.CEDECOD",
        "Synonym Qualifier"
      ),
      assigned("CECAT", "Category for Clinical Event", "Grouping Qualifier"),
      EPOCH,
      collected(
        "CESTDTC",
        "Start Date/Time of Clinical Event",
        "CE.CESTDTC",
        "Timing",
        "date"
      ),
      derived(
        "CESTDY",
        "Study Day of Start of Clinical Event",
        "STUDY_DAY",
        "Timing",
        "integer"
      ),
    ],
  },
  CO: {
    label: "Comments",
    class: "Special Purpose",
    structure: "One record per comment per subject",
    keys: ["STUDYID", "USUBJID", "COSEQ"],
    columns: [
      assigned("STUDYID", "Study Identifier"),
      assigned("DOMAIN", "Domain Abbreviation"),
      derived(
        "RDOMAIN",
        "Related Domain Abbreviation",
        "COMMENT_TARGET",
        "Record Qualifier"
      ),
      assigned("USUBJID", "Unique Subject Identifier"),
      SEQ("CO"),
      derived(
        "IDVAR",
        "Identifying Variable",
        "COMMENT_TARGET",
        "Record Qualifier"
      ),
      derived(
        "IDVARVAL",
        "Identifying Variable Value",
        "COMMENT_TARGET",
        "Record Qualifier"
      ),
      collected("COVAL", "Comment", "CO.COVAL", "Topic"),
    ],
  },
};

function rows(dataset: Dataset): Row[] {
  return Array.from({ length: dataset.rowCount }, (_, index) =>
    Object.fromEntries(
      dataset.variables.map(({ name }) => [
        name,
        dataset.columns[name]?.[index] ?? null,
      ])
    )
  );
}
function text(value: CellValue): string | null {
  return typeof value === "string" ? value : null;
}
function num(value: CellValue): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
/**
 * A complete calendar date, or null. The round trip rejects dates that do
 * not exist, such as 30 February, which `Date` would otherwise roll over
 * into March and turn into a wrong study day (#2605).
 */
function isoDate(value: CellValue): string | null {
  const valueText = text(value);
  if (!valueText || !/^\d{4}-\d{2}-\d{2}$/.test(valueText)) return null;
  const parsed = new Date(`${valueText}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === valueText
    ? valueText
    : null;
}
function day(date: CellValue, reference: CellValue): number | null {
  const d = isoDate(date);
  const r = isoDate(reference);
  if (!d || !r) return null;
  const diff = Math.round(
    (Date.parse(`${d}T00:00:00Z`) - Date.parse(`${r}T00:00:00Z`)) / 86400000
  );
  return diff >= 0 ? diff + 1 : diff;
}
function table(
  name: SubjectDomain,
  entries: readonly { row: Row; sourceIds: readonly string[] }[]
): Dataset {
  const spec = SPECS[name];
  return {
    name,
    label: spec.label,
    layer: "sdtm",
    class: spec.class,
    structure: spec.structure,
    keys: spec.keys,
    variables: spec.columns.map((column) => ({
      name: column.name,
      label: column.label,
      role: column.role,
      type: column.type ?? "text",
      ...(column.type ? {} : { length: 200 }),
      origin: column.origin,
      ...sdtmCodelist(column.name),
      ...sdtmRequired(name, column.name),
      ...(column.method ? { method: column.method } : {}),
      ...(column.source ? { source: column.source } : {}),
    })),
    columns: Object.fromEntries(
      spec.columns.map(({ name: variable }) => [
        variable,
        entries.map(({ row }) => row[variable] ?? null),
      ])
    ),
    rowCount: entries.length,
    lineage: entries.map(({ sourceIds }) => sourceIds),
  };
}
function numbered(
  name: SubjectDomain,
  entries: readonly { row: Row; sourceIds: readonly string[] }[]
): Dataset {
  const counters = new Map<string, number>();
  return table(
    name,
    entries.map(({ row, sourceIds }) => {
      const subject = text(row.USUBJID) ?? "";
      const next = (counters.get(subject) ?? 0) + 1;
      counters.set(subject, next);
      return { row: { ...row, [`${name}SEQ`]: next }, sourceIds };
    })
  );
}

/**
 * Derive DM, SV, EX, CM, AE, MH, IE, VS, LB, EG, DS, SUPPDM, RELREC, SE and CO
 * from collected records, and CE when the study collects adjudicated events.
 */
export function deriveSubjectDomains(
  definition: StudyDefinition,
  collectedDatasets: readonly Dataset[],
  trialDesign: readonly Dataset[]
): readonly Dataset[] {
  const source = new Map(
    collectedDatasets.map((dataset) => [dataset.name, rows(dataset)])
  );
  const get = (name: string) => source.get(name) ?? [];
  const bySubject = (name: string) =>
    new Map(get(name).map((row) => [text(row.USUBJID), row]));
  const bySubjectFirst = (name: string) => {
    const first = new Map<string | null, Row>();
    for (const row of get(name))
      if (!first.has(text(row.USUBJID))) first.set(text(row.USUBJID), row);
    return first;
  };
  const randBySubject = bySubject("RAND");
  const exBySubject = bySubject("EX");
  const deathBySubject = new Map(
    get("DS")
      .filter((row) => row.DSDECOD === "DEATH")
      .map((row) => [text(row.USUBJID), row])
  );
  // The subject's last contact: the latest complete date on any of their
  // collected records, kept with the record it came from for the lineage.
  const lastContactBySubject = new Map<
    string | null,
    { date: string; record: Row }
  >();
  for (const dataset of collectedDatasets) {
    const dateNames = dataset.variables
      .filter((variable) => variable.type === "date")
      .map((variable) => variable.name);
    for (const record of rows(dataset)) {
      const subject = text(record.USUBJID);
      for (const name of dateNames) {
        const date = isoDate(record[name] ?? null);
        const latest = lastContactBySubject.get(subject);
        if (date && (!latest || date > latest.date))
          lastContactBySubject.set(subject, { date, record });
      }
    }
  }
  const tv = trialDesign.find((dataset) => dataset.name === "TV");
  const plannedVisits = new Map(
    (tv ? rows(tv) : []).map((row) => [num(row.VISITNUM), row])
  );
  const ta = trialDesign.find((dataset) => dataset.name === "TA");
  const epochs = new Set(
    (ta ? rows(ta) : [])
      .map((row) => text(row.EPOCH))
      .filter((value) => value !== null)
  );
  const sortedEpochs = [...definition.design.epochs]
    .sort((a, b) => a.order - b.order)
    .map((epoch) => epoch.name);
  const epochAt = (
    date: CellValue,
    exposure: Row | undefined
  ): string | null => {
    if (!exposure) return sortedEpochs[0] ?? null;
    const value = isoDate(date);
    if (!value) return null;
    const first = isoDate(exposure.EXSTDTC);
    const last = isoDate(exposure.EXENDTC);
    const candidate =
      !first || value < first
        ? sortedEpochs[0]
        : last && value <= last
          ? sortedEpochs[1]
          : sortedEpochs[2];
    return candidate && epochs.has(candidate) ? candidate : null;
  };
  const visit = (row: Row): Pick<Row, "VISITNUM" | "VISIT"> => {
    const planned = plannedVisits.get(num(row.VISITNUM));
    return {
      VISITNUM: row.VISITNUM ?? null,
      VISIT: planned?.VISIT ?? row.VISIT ?? null,
    };
  };
  const sourceIds = (...records: (Row | undefined)[]): string[] =>
    records.flatMap((record) =>
      text(record?.SRCID ?? null) ? [text(record?.SRCID ?? null)!] : []
    );
  const item = (row: Row, ...records: (Row | undefined)[]) => ({
    row,
    sourceIds: sourceIds(...records),
  });
  const common = (subject: CellValue, domain: string): Row => ({
    STUDYID: definition.studyId,
    DOMAIN: domain,
    USUBJID: subject,
  });
  // The actual arm is the planned arm whose treatment the subject received
  // (#2813), so it comes from exposure rather than randomization.
  const armByTreatment = new Map(
    definition.design.arms.map((arm) => [arm.name, arm])
  );
  const actualArmOf = (subject: string | null) => {
    const ex = exBySubject.get(subject);
    const treatment = text(ex?.EXTRT ?? null);
    const arm = treatment === null ? undefined : armByTreatment.get(treatment);
    return {
      arm,
      unplannedTreatment: ex && !arm ? (treatment ?? undefined) : undefined,
    };
  };
  const dm = get("DM").map((record) => {
    const subject = text(record.USUBJID);
    const rand = randBySubject.get(subject);
    const ex = exBySubject.get(subject);
    const actual = actualArmOf(subject);
    const death = deathBySubject.get(subject);
    const lastContact = lastContactBySubject.get(subject);
    return item(
      {
        ...common(record.USUBJID, "DM"),
        SUBJID: subject?.split("-").at(-1) ?? null,
        RFICDTC: record.CONSENTDTC,
        RFSTDTC: ex?.EXSTDTC ?? null,
        RFENDTC: ex?.EXENDTC ?? null,
        RFXSTDTC: ex?.EXSTDTC ?? null,
        RFXENDTC: ex?.EXENDTC ?? null,
        RFPENDTC: lastContact?.date ?? null,
        DTHDTC: death?.DSSTDTC ?? null,
        DTHFL: death ? "Y" : null,
        SITEID: record.SITEID,
        AGE: record.AGE,
        AGEU: "YEARS",
        SEX: record.SEX,
        RACE: record.RACE,
        // A subject is left unrandomized only when screening fails (#2802).
        // A randomized subject has no actual arm when never dosed, or when
        // dosed with a treatment no arm plans (#2813).
        ARMCD: rand?.ARMCD ?? null,
        ARM: rand?.ARM ?? null,
        ACTARMCD: actual.arm?.armCode ?? null,
        ACTARM: actual.arm?.name ?? null,
        ARMNRS: !rand
          ? ex
            ? "NOT ASSIGNED"
            : "SCREEN FAILURE"
          : !ex
            ? "ASSIGNED, NOT TREATED"
            : actual.unplannedTreatment !== undefined
              ? "UNPLANNED TREATMENT"
              : null,
        ACTARMUD: actual.unplannedTreatment ?? null,
        COUNTRY: record.COUNTRY,
      },
      record,
      rand,
      ex,
      death,
      lastContact?.record
    );
  });
  const sv = get("SV").map((record) => {
    const ex = exBySubject.get(text(record.USUBJID));
    const planned = plannedVisits.has(num(record.VISITNUM));
    return item(
      {
        ...common(record.USUBJID, "SV"),
        ...visit(record),
        SVPRESP: planned ? "Y" : null,
        SVOCCUR: planned ? (record.SVDTC ? "Y" : "N") : null,
        SVSTDTC: record.SVDTC,
        SVENDTC: record.SVDTC,
        SVSTDY: day(record.SVDTC, ex?.EXSTDTC ?? null),
        SVENDY: day(record.SVDTC, ex?.EXSTDTC ?? null),
      },
      record,
      ex
    );
  });
  const doseForm =
    terminologyCodelist("FRM").terms.find(
      (term) => term.nciCode === definition.design.doseForm?.code
    )?.value ?? null;
  const ex = get("EX").map((record) => {
    const exposure = exBySubject.get(text(record.USUBJID));
    return item(
      {
        ...common(record.USUBJID, "EX"),
        EXTRT: record.EXTRT,
        EXDOSE: record.EXDOSE,
        EXDOSU: record.EXDOSU,
        EXDOSFRM: doseForm,
        EXSTDTC: record.EXSTDTC,
        EXENDTC: record.EXENDTC,
        EXSTDY: 1,
        EXENDY: day(record.EXENDTC, exposure?.EXSTDTC ?? null),
        EPOCH: epochAt(record.EXSTDTC, record),
      },
      record
    );
  });
  const dmBySubject = bySubject("DM");
  const cm = get("CM").map((record) => {
    const exposure = exBySubject.get(text(record.USUBJID));
    const consent = isoDate(
      dmBySubject.get(text(record.USUBJID))?.CONSENTDTC ?? null
    );
    const start = isoDate(record.CMSTDTC);
    const coding = codeMedication(record.CMTRT);
    const ongoing = record.CMONGO === "Y";
    return item(
      {
        ...common(record.USUBJID, "CM"),
        CMTRT: record.CMTRT,
        CMDECOD: coding?.decod ?? null,
        CMCAT: record.CMCAT,
        CMINDC: record.CMINDC,
        CMCLAS: coding?.cls ?? null,
        CMCLASCD: coding?.clscd ?? null,
        CMDOSE: record.CMDOSE,
        CMDOSU: record.CMDOSU,
        CMDOSFRQ: record.CMDOSFRQ,
        CMROUTE: record.CMROUTE,
        // A medication started before consent began before the study.
        EPOCH:
          start && consent && start >= consent
            ? epochAt(start, exposure)
            : null,
        CMSTDTC: record.CMSTDTC,
        CMENDTC: record.CMENDTC,
        CMSTDY: day(record.CMSTDTC, exposure?.EXSTDTC ?? null),
        CMENDY: day(record.CMENDTC, exposure?.EXSTDTC ?? null),
        CMENRTPT: ongoing ? "ONGOING" : null,
        CMENTPT: ongoing ? "END OF STUDY" : null,
      },
      record,
      exposure
    );
  });
  const ae = get("AE").map((record) => {
    const exposure = exBySubject.get(text(record.USUBJID));
    const coding = codeAeTerm(record.AEDECOD);
    return item(
      {
        ...common(record.USUBJID, "AE"),
        AETERM: record.AEDECOD,
        AELLT: coding?.llt ?? null,
        AELLTCD: coding?.lltcd ?? null,
        AEDECOD: record.AEDECOD,
        AEPTCD: coding?.ptcd ?? null,
        AEHLT: coding?.hlt ?? null,
        AEHLTCD: coding?.hltcd ?? null,
        AEHLGT: coding?.hlgt ?? null,
        AEHLGTCD: coding?.hlgtcd ?? null,
        AEBODSYS: record.AEBODSYS,
        AEBDSYCD: coding?.soccd ?? null,
        AESOC: coding?.soc ?? null,
        AESOCCD: coding?.soccd ?? null,
        AESER: record.AESER,
        AEREL: record.AEREL === "RELATED" ? "POSSIBLY RELATED" : record.AEREL,
        AEACN: record.AEACN,
        ...Object.fromEntries(
          AE_SERIOUSNESS_CRITERIA.map(([name]) => [name, record[name] ?? null])
        ),
        AESTDTC: record.AESTDTC,
        AEENDTC: record.AEENDTC,
        AESTDY: day(record.AESTDTC, exposure?.EXSTDTC ?? null),
        AEENDY: day(record.AEENDTC, exposure?.EXSTDTC ?? null),
        EPOCH: epochAt(record.AESTDTC, exposure),
      },
      record,
      exposure
    );
  });
  const mh = get("MH").map((record) => {
    const exposure = exBySubject.get(text(record.USUBJID));
    const coding = codeHistoryTerm(record.MHTERM);
    const ongoing = record.MHONGO === "Y";
    return item(
      {
        ...common(record.USUBJID, "MH"),
        MHTERM: record.MHTERM,
        MHDECOD: coding?.pt ?? null,
        MHCAT: record.MHCAT,
        MHBODSYS: coding?.soc ?? null,
        MHDTC: record.MHDTC,
        MHSTDTC: record.MHSTDTC,
        MHENDTC: record.MHENDTC,
        MHDY: day(record.MHDTC, exposure?.EXSTDTC ?? null),
        MHENRTPT: ongoing ? "ONGOING" : null,
        MHENTPT: ongoing ? "SCREENING" : null,
      },
      record,
      exposure
    );
  });
  const ti = trialDesign.find((dataset) => dataset.name === "TI");
  const criterionByCode = new Map(
    (ti ? rows(ti) : []).map((row) => [text(row.IETESTCD), row])
  );
  const ie = get("IE").map((record) => {
    const criterion = criterionByCode.get(text(record.IETESTCD));
    // IE holds only criteria not met: an inclusion answered No, an
    // exclusion answered Yes.
    const result =
      record.IECAT === "INCLUSION"
        ? "N"
        : record.IECAT === "EXCLUSION"
          ? "Y"
          : null;
    return item(
      {
        ...common(record.USUBJID, "IE"),
        IETESTCD: record.IETESTCD,
        IETEST: criterion?.IETEST ?? null,
        IECAT: record.IECAT,
        IEORRES: result,
        IESTRESC: result,
        ...visit(record),
        EPOCH: epochAt(record.IEDTC, exBySubject.get(text(record.USUBJID))),
        IEDTC: record.IEDTC,
      },
      record
    );
  });
  const assessmentByCode = new Map(
    definition.design.activities.flatMap((activity) =>
      activity.assessments.map(
        (assessment) => [assessment.testCode, assessment] as const
      )
    )
  );
  const findings = (name: "VS" | "LB" | "EG") => {
    const dates = {
      date: `${name}DTC`,
      code: `${name}TESTCD`,
      result: `${name}ORRES`,
      unit: `${name}ORRESU`,
    };
    const records = get(name);
    const baseline = new Map<string, { date: string; source: string }>();
    for (const record of records) {
      const exposure = exBySubject.get(text(record.USUBJID));
      const observed = isoDate(record[dates.date]);
      const firstDose = isoDate(exposure?.EXSTDTC ?? null);
      if (!observed || !firstDose || observed > firstDose) continue;
      const key = `${record.USUBJID}|${record[dates.code]}`;
      const prior = baseline.get(key);
      if (!prior || observed >= prior.date)
        baseline.set(key, { date: observed, source: text(record.SRCID)! });
    }
    return records.map((record) => {
      const exposure = exBySubject.get(text(record.USUBJID));
      const assessment = assessmentByCode.get(text(record[dates.code]) ?? "");
      const result = num(record[dates.result]);
      const standardUnit = assessment?.unit ?? text(record[dates.unit]);
      const standard =
        result === null
          ? null
          : toStandardUnit(
              text(record[dates.code]) ?? "",
              result,
              text(record[dates.unit]),
              standardUnit
            );
      const source = text(record.SRCID);
      const key = `${record.USUBJID}|${record[dates.code]}`;
      const baselineFlag = baseline.get(key)?.source === source ? "Y" : null;
      const row: Row = {
        ...common(record.USUBJID, name),
        [`${name}TESTCD`]: record[dates.code],
        [`${name}TEST`]: assessment?.testName ?? null,
        [`${name}ORRES`]: result === null ? null : String(result),
        [`${name}ORRESU`]: record[dates.unit],
        [`${name}STRESC`]: standard === null ? null : String(standard),
        [`${name}STRESN`]: standard,
        [`${name}STRESU`]: standardUnit,
        ...visit(record),
        [dates.date]: record[dates.date],
        [`${name}DY`]: day(record[dates.date], exposure?.EXSTDTC ?? null),
        [`${name}LOBXFL`]: baselineFlag,
        EPOCH: epochAt(record[dates.date], exposure),
      };
      if (name === "LB") {
        const reference = labReference(record[dates.code]);
        const inStandardUnit = text(record[dates.unit]) === standardUnit;
        row.LBCAT = reference?.category ?? null;
        row.LBORNRLO =
          reference && inStandardUnit ? String(reference.low) : null;
        row.LBORNRHI =
          reference && inStandardUnit ? String(reference.high) : null;
        row.LBSTNRLO = reference?.low ?? null;
        row.LBSTNRHI = reference?.high ?? null;
        row.LBNRIND = record.LBNRIND;
      }
      return item(row, record, exposure);
    });
  };
  const ds = get("DS").map((record) => {
    const exposure = exBySubject.get(text(record.USUBJID));
    return item(
      {
        ...common(record.USUBJID, "DS"),
        DSTERM: record.DSDECOD,
        DSDECOD: record.DSDECOD,
        DSCAT: record.DSSCAT,
        DSSTDTC: record.DSSTDTC,
        DSSTDY: day(record.DSSTDTC, exposure?.EXSTDTC ?? null),
        EPOCH: epochAt(record.DSSTDTC, exposure),
      },
      record,
      exposure
    );
  });
  // The stratum each subject was randomised in, for a study that declares
  // strata, from the randomisation record.
  const strata = definition.design.randomisation?.strata ?? [];
  const suppdm = get("DM").flatMap((record) =>
    [
      ["SCREENFL", "Screening Outcome", record.SCREENFL] as const,
      ["RANDFL", "Randomized Flag", record.RANDFL] as const,
      ...strata.flatMap((factor) => {
        const value = randBySubject.get(text(record.USUBJID))?.[
          factor.adslVariable
        ];
        return value == null
          ? []
          : [[factor.adslVariable, factor.factor, value] as const];
      }),
    ].map(([name, label, value]) =>
      item(
        {
          STUDYID: definition.studyId,
          RDOMAIN: "DM",
          USUBJID: record.USUBJID,
          IDVAR: null,
          IDVARVAL: null,
          QNAM: name,
          QLABEL: label,
          QVAL: value,
          QORIG: "Collected",
          QEVAL: null,
        },
        record
      )
    )
  );
  // One element sequence per subject, from their first consent: a second
  // DM record for the same subject is DM's defect, which SD-035 reports.
  const se = deriveSubjectElements(
    definition.studyId,
    [...bySubjectFirst("DM").values()].map((record) => {
      const subject = text(record.USUBJID);
      const lastContact = lastContactBySubject.get(subject);
      const actual = actualArmOf(subject);
      return {
        subject: subject ?? "",
        demographics: record,
        randomization: randBySubject.get(subject),
        exposure: exBySubject.get(subject),
        ...(actual.arm ? { actualArm: actual.arm.armCode } : {}),
        ...(actual.unplannedTreatment !== undefined
          ? { unplannedTreatment: actual.unplannedTreatment }
          : {}),
        ...(lastContact ? { lastContact } : {}),
      };
    }),
    ta,
    sortedEpochs,
    (date, input) => day(date, input.exposure?.EXSTDTC ?? null)
  );
  const svDataset = table("SV", sv);
  const exDataset = numbered("EX", ex);
  const cmDataset = numbered("CM", cm);
  const aeDataset = numbered("AE", ae);
  const mhDataset = numbered("MH", mh);
  const ieDataset = numbered("IE", ie);
  const vsDataset = numbered("VS", findings("VS"));
  const lbDataset = numbered("LB", findings("LB"));
  const egDataset = numbered("EG", findings("EG"));
  const dsDataset = numbered("DS", ds);
  // The clinical events committee's adjudicated events, in a study that
  // collects them.
  const ce = get("CE").map((record) => {
    const exposure = exBySubject.get(text(record.USUBJID));
    return item(
      {
        ...common(record.USUBJID, "CE"),
        CETERM: record.CETERM,
        CEDECOD: record.CEDECOD,
        CECAT: "CLINICAL EVENTS COMMITTEE ADJUDICATED",
        CESTDTC: record.CESTDTC,
        CESTDY: day(record.CESTDTC, exposure?.EXSTDTC ?? null),
        EPOCH: epochAt(record.CESTDTC, exposure),
      },
      record,
      exposure
    );
  });
  return [
    table("DM", dm),
    svDataset,
    exDataset,
    cmDataset,
    aeDataset,
    mhDataset,
    ieDataset,
    vsDataset,
    lbDataset,
    egDataset,
    dsDataset,
    table("SUPPDM", suppdm),
    table(
      "RELREC",
      deriveRelrec(definition.studyId, get("CM"), aeDataset, cmDataset)
    ),
    numbered("SE", se),
    numbered(
      "CO",
      deriveComments(definition.studyId, get("CO"), [
        svDataset,
        exDataset,
        cmDataset,
        aeDataset,
        mhDataset,
        ieDataset,
        vsDataset,
        lbDataset,
        egDataset,
        dsDataset,
      ])
    ),
    ...(source.has("CE") ? [numbered("CE", ce)] : []),
  ];
}
