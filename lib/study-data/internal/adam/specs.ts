/** Versioned analysis method text shared by derivations and future Define-XML. */
export const ADAM_METHODS = {
  ADSL_POP:
    "Safety: dosed; ITT: randomized and dosed; efficacy: ITT with baseline and postbaseline systolic blood pressure.",
  ADSL_TRT:
    "Planned treatment comes from DM. Actual treatment and dates come from first and last EX records.",
  ADSL_DISP:
    "End-of-study status and discontinuation reason come from the final DS disposition event.",
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
} as const;

export type AdamMethodId = keyof typeof ADAM_METHODS;
