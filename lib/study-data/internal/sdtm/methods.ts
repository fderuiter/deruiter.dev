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
    "The code and name of the planned arm whose treatment the subject received (EXTRT on their exposure record). Missing, with the reason in ARMNRS, for a subject never dosed or dosed with a treatment no arm plans.",
  ARM_NULL_REASON:
    "Why ARMCD or ACTARMCD is missing, as an Arm Null Reason (C142179) term: SCREEN FAILURE for a subject never randomized or dosed, NOT ASSIGNED for one dosed without being randomized, ASSIGNED, NOT TREATED for one randomized and never dosed, and UNPLANNED TREATMENT for one dosed with a treatment no arm plans. Missing when both arms are known.",
  UNPLANNED_ARM:
    "The treatment a subject received (EXTRT) when no planned arm names it, so ACTARMCD is missing with ARMNRS = UNPLANNED TREATMENT; missing for every other subject.",
  ACTUAL_ELEMENT_FROM_TA_TE:
    "The epoch on the record date, in USDM epoch order: before first exposure the first epoch, from first through last exposure the second, after that the third, kept only when TA lists it. Records of subjects never dosed are in the first epoch; a missing or partial date gives no epoch, and so does a medication started before informed consent.",
  PLANNED_VISIT:
    "Y when the visit is one of the planned visits in TV; missing for an unscheduled visit.",
  VISIT_OCCURRED:
    "For a planned visit, Y when the visit has a date and N when it was missed; missing for an unscheduled visit.",
  CT_UNIT_MAPPING:
    "Collected dose unit, which is already the UNIT submission value (TABLET, C48542).",
  USDM_DOSE_FORM:
    "Dose form of the investigational product in the USDM administrable product, written as its Dosage Form (C66726) submission value: TABLET for C42998. Missing when the study names no investigational product or its dose form is not in the codelist.",
  LAB_CATEGORY:
    "The laboratory panel of the test at the study's fictional central laboratory: CHEMISTRY for ALT, AST, BILI, CREAT and GLUC; HEMATOLOGY for HGB, WBC and PLAT.",
  LAB_REFERENCE_RANGE:
    "Lower and upper limits of the test's reference range at the study's fictional central laboratory, in standard units for --STNRLO and --STNRHI (numbers) and, when the result was collected in the standard unit, in original units for --ORNRLO and --ORNRHI (text). The original-unit limits are missing when the collected unit differs.",
  AE_DICTIONARY_CODING:
    "Looked up from the preferred term (AEDECOD) in the study's fictional adverse event dictionary, which has MedDRA's five levels but is not MedDRA: its lower and group level names are invented and its codes are synthetic, from 99000000. Each lowest level term is its preferred term. Missing when the preferred term is not in the dictionary.",
  CM_DICTIONARY_CODING:
    "Looked up from the reported name (CMTRT) in the study's fictional drug dictionary, which has WHODrug's shape but is not WHODrug: standardized names are generic drug names, class names are plain descriptions and class codes are synthetic, starting with Z, a letter the ATC classification does not use. Missing when the reported name is not in the dictionary.",
  CM_ONGOING:
    "When the medication was marked ongoing at the end of the subject's participation, CMENRTPT is ONGOING (Relation to Reference Period, C66728) and CMENTPT is END OF STUDY; both are missing otherwise.",
  MH_DICTIONARY_CODING:
    "Looked up from the reported term (MHTERM) in the study's fictional event dictionary, the one adverse events are coded with, which has MedDRA's shape but is not MedDRA: MHDECOD is the preferred term and MHBODSYS its primary system organ class, and the codes are synthetic, from 99000000. Missing when the reported term is not in the dictionary.",
  MH_ONGOING:
    "When the condition was marked ongoing at the screening visit, MHENRTPT is ONGOING (Relation to Reference Period, C66728) and MHENTPT is SCREENING; both are missing otherwise.",
  IE_CRITERION_FROM_TI:
    "The criterion text TI holds for the same IETESTCD, so IE and TI cannot disagree; missing when TI has no such criterion.",
  IE_RESULT:
    "IE records only the criteria a subject did not meet: N (No Yes Response, C66742) for an INCLUSION criterion and Y for an EXCLUSION criterion. IESTRESC repeats IEORRES.",
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
    "The latest complete date on any of the subject's collected records: consent, randomization, visits, exposure, concomitant medications, medical history, eligibility, adverse events, vital signs, ECGs, laboratory tests and disposition events. Partial dates are ignored.",
  DEATH_DATE:
    "Date of the subject's DEATH disposition event (DSSTDTC); missing for subjects with no recorded death.",
  DEATH_FLAG:
    "Y when the subject has a DEATH disposition event; missing otherwise.",
  RELATED_RECORDS:
    "Number each subject's AE and CM pairs from 1, in CM order. A pair is a medication whose collected related adverse event number (CMAENO) names one of the subject's tabulated adverse events; both records of the pair share the RELID.",
  SUBJECT_ELEMENT:
    "The TA elements of the subject's actual arm (ACTARMCD), one for each epoch the subject entered, with TA's ETCD, ELEMENT, TAETORD and EPOCH. Every subject entered the first epoch at informed consent, a dosed subject the second at first exposure, and the third only when they have a record dated after last exposure. A subject never randomized has only the first element, which every arm shares. A subject dosed with a treatment no arm plans has an unplanned element for the second epoch (ETCD = UNPLAN, with no ELEMENT or TAETORD), and the elements every arm shares for the others.",
  UNPLANNED_ELEMENT:
    "For an unplanned element (ETCD = UNPLAN), the treatment the subject received in it, as DM.ACTARMUD records it; missing for every planned element.",
  ELEMENT_START:
    "The date the subject entered the element: informed consent (RFICDTC) for the first epoch's element, first exposure (EXSTDTC) for the second and last exposure (EXENDTC) for the third.",
  ELEMENT_END:
    "The start of the subject's next element, so that elements leave no gap; for the subject's last element, the end of participation (RFPENDTC).",
  COMMENT_TARGET:
    "The record the site attached the comment to, named on the comments form by its collected source ID: RDOMAIN is that record's domain, IDVAR its --SEQ, or VISITNUM for a visit in SV, and IDVARVAL the value. A comment whose record was not tabulated is not written.",
} as const;

/** The id of an SDTM derivation method. */
export type SdtmMethodId = keyof typeof SDTM_METHODS;
