/**
 * Derivation methods of the SDTM tabulation specs. Each Derived SDTM
 * variable names one of these ids, and Define-XML writes the text as its
 * MethodDef, so the method a reviewer reads is the one the spec names.
 */
export const SDTM_METHODS = {
  SOURCE_ORDER:
    "Number each subject's records from 1 in the order they are tabulated.",
  STUDY_DAY:
    "Days from RFSTDTC (first exposure) to the record date, plus one when the date is on or after RFSTDTC; there is no Day 0. Missing when either date is missing or partial.",
  FIRST_EXPOSURE:
    "Start date of the subject's exposure record (EXSTDTC); missing for subjects never dosed.",
  LAST_EXPOSURE:
    "End date of the subject's exposure record (EXENDTC); missing for subjects never dosed or with no exposure end date.",
  RANDOMIZATION:
    "Arm code and arm from the subject's randomization record; missing for subjects never randomized, whose reason is in ARMNRS.",
  EXPOSURE_ARM:
    "The randomized arm code and arm, for every randomized subject, each of whom is dosed with that arm's treatment; missing for subjects never randomized, whose reason is in ARMNRS.",
  ARM_NULL_REASON:
    "SCREEN FAILURE (Arm Null Reason, C142179) for a subject never randomized, since the pipeline leaves a subject unrandomized only when screening fails; missing for every randomized subject.",
  UNPLANNED_ARM:
    "Missing for every subject: each dosed subject receives the treatment of the arm they were randomized to, so no actual arm is unplanned.",
  ACTUAL_ELEMENT_FROM_TA_TE:
    "The epoch on the record date, in USDM epoch order: before first exposure the first epoch, from first through last exposure the second, after that the third, kept only when TA lists it. Records of subjects never dosed are in the first epoch; a missing or partial date gives no epoch.",
  PLANNED_VISIT:
    "Y when the visit is one of the planned visits in TV; missing for an unscheduled visit.",
  VISIT_OCCURRED:
    "For a planned visit, Y when the visit has a date and N when it was missed; missing for an unscheduled visit.",
  CT_UNIT_MAPPING:
    "Collected dose unit, which is already the UNIT submission value (TABLET, C48542).",
  AE_DICTIONARY_CODING:
    "Looked up from the preferred term (AEDECOD) in the study's fictional adverse event dictionary, which has MedDRA's five levels but is not MedDRA: its lower and group level names are invented and its codes are synthetic, from 99000000. Each lowest level term is its preferred term. Missing when the preferred term is not in the dictionary.",
  CT_RELATIONSHIP_MAPPING:
    "Collected causality mapped to the submission value: RELATED is written as POSSIBLY RELATED; other values are kept.",
  USDM_ASSESSMENT:
    "Test name and standard unit of the USDM biomedical concept for the test code.",
  TEXT_RESULT: "The collected numeric result written as text.",
  STANDARD_RESULT:
    "The collected result in the test's standard unit, as text in --STRESC and as a number in --STRESN: as collected when the collected unit is the standard unit, otherwise converted by a fixed factor and rounded to two decimals. The one conversion defined is glucose from mg/dL to mmol/L (divide by 18.016); with any other unit the standard result is missing.",
  LAST_PRE_DOSE:
    "Y on the subject's latest record for the test dated on or before first exposure; missing otherwise.",
  LAST_PARTICIPATION:
    "The latest complete date on any of the subject's collected records: consent, randomization, visits, exposure, adverse events, vital signs, laboratory tests and disposition events. Partial dates are ignored.",
  DEATH_DATE:
    "Date of the subject's DEATH disposition event (DSSTDTC); missing for subjects with no recorded death.",
  DEATH_FLAG:
    "Y when the subject has a DEATH disposition event; missing otherwise.",
} as const;

/** The id of an SDTM derivation method. */
export type SdtmMethodId = keyof typeof SDTM_METHODS;
