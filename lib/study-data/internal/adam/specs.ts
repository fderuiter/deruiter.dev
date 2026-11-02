/** Versioned analysis method text shared by derivations and future Define-XML. */
export const ADAM_METHODS = {
  ADSL_POP:
    "Safety: dosed; ITT: randomized and dosed; efficacy: ITT with baseline and postbaseline systolic blood pressure.",
  ADSL_TRT:
    "Planned treatment comes from DM. Actual treatment and dates come from first and last EX records.",
  ADSL_DISP:
    "End-of-study status and discontinuation reason come from the final DS disposition event.",
  ADSL_DEATH:
    "Date of death is DM.DTHDTC when that is a full date; missing for subjects with no recorded death. No death date is imputed.",
  BDS_WINDOW:
    "Assign observed assessments to USDM visit windows; closest target day wins, then earlier date, then lower source sequence.",
  BDS_BASE:
    "Select the latest nonmissing assessment on or before first dose; a designated baseline visit on first-dose day is eligible.",
  BDS_CHANGE:
    "CHG is AVAL minus BASE; PCHG is 100 times CHG divided by nonzero BASE.",
  BDS_ANALYSIS:
    "For each subject, parameter and analysis visit, select the observed row closest to target day, then earlier date, then lower source sequence.",
  BDS_LOCF:
    "For a missing postbaseline visit, carry the latest earlier postbaseline result as a flagged sensitivity row; exclude it from primary ANL01FL selection.",
  ADEG_QTCF:
    "QTcF is the QT interval corrected for heart rate by Fridericia's formula, QTcF = QT / (RR / 1000)^(1/3) with QT and RR in ms from the QTAG and RRAG results of the same ECG, rounded to 0.1 ms. It is not derived when either result is missing.",
  ADEG_CRIT:
    "QTcF records only: CRIT1FL is Y when AVAL exceeds 500 ms, and CRIT2FL is Y when CHG exceeds 60 ms, the ICH E14 categorical thresholds for a QTc outlier. CRIT2FL is blank when there is no baseline.",
  ADAE_IMPUTE:
    "Impute month-only AE starts to the first day, or first dose when it lies in that month; impute month-only ends to month end capped at last contact. Flag imputed days.",
  ADAE_TEAE:
    "A treatment-emergent AE starts from first dose through 14 days after last dose, capped at last known study contact.",
  ADAE_OCC:
    "Flag the first treatment-emergent occurrence overall, by body system and by preferred term, ordered by analysis start date and AE sequence.",
  ADCM_IMPUTE:
    "Impute month-only medication starts to the first day, or first dose when it lies in that month; impute month-only ends to month end capped at last contact. Flag imputed days. A medication marked ongoing has no analysis end date.",
  ADCM_DAY:
    "ASTDY and AENDY count from first dose (ADSL.TRTSDT) as day 1, with no day 0: the analysis date minus TRTSDT, plus 1 on or after first dose. Missing when either date is missing.",
  ADCM_TIMING:
    "For a dosed subject, PREFL is Y when the medication started before first dose, or has no analysis start date. ONTRTFL is Y when it started on or before the end of the on-treatment period (14 days after last dose, capped at last known contact) and ended on or after first dose, or has no analysis end date. A medication started before and continued after first dose has both flags. Both are blank for a subject never dosed.",
  ADCM_RESCUE:
    "RESCUEFL is Y when the medication was recorded as rescue medication (CM.CMCAT is RESCUE MEDICATION), and blank otherwise.",
  ADTTE_EVENT:
    "TTADISC: an event is the first treatment-emergent AE with drug withdrawal corroborated by an adverse-event DS disposition, dated at the AE start date. TTDTH: death, dated at ADSL.DTHDT. TTSAE: the first serious treatment-emergent AE, dated at its analysis start date. TTRESC: the first rescue medication (ADCM.RESCUEFL = Y) started on or after first dose, dated at its analysis start date. TTSAE and TTRESC count only events up to the end of the on-treatment period.",
  ADTTE_CENSOR:
    "AVAL counts first-dose day as day 1. TTADISC: a dosed subject without an event is censored at the earlier of last known contact and discontinuation for another reason. TTDTH: censored at last known contact. TTSAE and TTRESC: censored at the end of the on-treatment period, 14 days after last dose, or at last known contact when that is earlier.",
  ADTTE_EVENT_1Y:
    "TTADISC: an event is the first treatment-emergent AE with drug withdrawal corroborated by an adverse-event DS disposition, dated at the AE start date. TTDTH: death, dated at ADSL.DTHDT. TTSTROKE: the first clinical events committee adjudicated disabling stroke (SDTM CE, CEDECOD = DISABLING STROKE) on or after first exposure, dated at CE.CESTDTC. TTREHOSP: the first adjudicated valve-related or heart-failure rehospitalisation (CEDECOD = REHOSPITALISATION) on or after first exposure, dated at CE.CESTDTC.",
  ADTTE_CENSOR_1Y:
    "AVAL counts the day of first exposure, the index procedure (ADSL.TRTSDT), as day 1; this synthetic study performs the procedure on the day of randomisation. TTADISC: a dosed subject without an event is censored at the earlier of last known contact and discontinuation for another reason. TTDTH, TTSTROKE and TTREHOSP: censored at last known contact, and at day 365, the end of the 1-year follow-up the endpoints define, when the event or last known contact is later.",
  ADHCE_COMPONENT_1Y:
    "One record per ITT subject per component of the hierarchical composite, in priority order (PARAMN): 1 death (ADTTE TTDTH), 2 disabling stroke (ADTTE TTSTROKE), 3 valve-related or heart-failure rehospitalisation (ADTTE TTREHOSP), 4 change from baseline in the VSFS overall summary score at 1 year (ADQS PARAMCD = VSFSOS, AVISIT = 1-Year Primary Endpoint Visit, ANL01FL = Y). ADT and CNSR are copied from the source record; AVAL is derived as the value-level metadata of each parameter describes.",
  ADHCE_VSFS:
    "AVAL is ADQS.CHG of the 1-year primary analysis record, rounded to 0.1 point, so that floating-point residue cannot decide a comparison against the 5-point margin.",
  ADHCE_COMPONENT:
    "One record per ITT subject per component of the hierarchical composite, in priority order (PARAMN): 1 death (ADTTE TTDTH), 2 first serious TEAE (ADTTE TTSAE), 3 first rescue medication (ADTTE TTRESC), 4 change from baseline in systolic blood pressure at Week 12 (ADVS PARAMCD = SYSBP, AVISIT = WEEK 12, ANL01FL = Y). ADT and CNSR are copied from the source record; AVAL is derived as the value-level metadata of each parameter describes.",
  ADHCE_TTE:
    "AVAL and CNSR are the ADTTE values for the same subject and parameter: days from first dose, with CNSR = 1 when the subject was censored.",
  ADHCE_SBP:
    "AVAL is ADVS.CHG of the Week 12 primary analysis record, rounded to 0.1 mmHg, the precision of the collected result, so that floating-point residue cannot decide a comparison against the 5 mmHg margin.",
  ADHCE_ANL:
    "ANL01FL is Y when AVAL is not missing. A component with a missing AVAL is a tie for every pair that reaches it.",
} as const;

export type AdamMethodId = keyof typeof ADAM_METHODS;
