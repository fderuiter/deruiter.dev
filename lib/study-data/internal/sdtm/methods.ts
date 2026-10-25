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
    "Arm code and arm from the subject's randomization record; SCRNFAIL and Screen Failure for subjects never randomized.",
  EXPOSURE_ARM:
    "The randomized arm code and arm, for every randomized subject; SCRNFAIL and Screen Failure for subjects never randomized.",
  ACTUAL_ELEMENT_FROM_TA_TE:
    "The epoch on the record date, in USDM epoch order: before first exposure the first epoch, from first through last exposure the second, after that the third, kept only when TA lists it. Records of subjects never dosed are in the first epoch; a missing or partial date gives no epoch.",
  CT_UNIT_MAPPING:
    "Collected dose unit, which is already the UNIT submission value (TABLET, C48542).",
  CT_RELATIONSHIP_MAPPING:
    "Collected causality mapped to the submission value: RELATED is written as POSSIBLY RELATED; other values are kept.",
  USDM_ASSESSMENT:
    "Test name and standard unit of the USDM biomedical concept for the test code.",
  TEXT_RESULT: "The collected numeric result written as text.",
  STANDARD_RESULT:
    "The collected result in the test's standard unit, as text in --STRESC and as a number in --STRESN: as collected when the collected unit is the standard unit, otherwise converted by a fixed factor and rounded to two decimals. The one conversion defined is glucose from mg/dL to mmol/L (divide by 18.016); with any other unit the standard result is missing.",
  LAST_PRE_DOSE:
    "Y on the subject's latest record for the test dated on or before first exposure; missing otherwise.",
} as const;

/** The id of an SDTM derivation method. */
export type SdtmMethodId = keyof typeof SDTM_METHODS;
