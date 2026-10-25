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
  ADAE_IMPUTE:
    "Impute month-only AE starts to the first day, or first dose when it lies in that month; impute month-only ends to month end capped at last contact. Flag imputed days.",
  ADAE_TEAE:
    "A treatment-emergent AE starts from first dose through 14 days after last dose, capped at last known study contact.",
  ADAE_OCC:
    "Flag the first treatment-emergent occurrence overall, by body system and by preferred term, ordered by analysis start date and AE sequence.",
  ADTTE_EVENT:
    "An event is the first treatment-emergent AE with drug withdrawal corroborated by an adverse-event DS disposition; event date is AE start date.",
  ADTTE_CENSOR:
    "For a dosed subject without an event, censor at the earlier of last known contact and discontinuation for another reason; count first-dose day as day 1.",
} as const;

export type AdamMethodId = keyof typeof ADAM_METHODS;
