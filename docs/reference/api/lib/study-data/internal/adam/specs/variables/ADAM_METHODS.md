[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/adam/specs](../README.md) / ADAM\_METHODS

# Variable: ADAM\_METHODS

> `const` **ADAM\_METHODS**: `object`

Versioned analysis method text shared by derivations and future Define-XML.

## Type Declaration

### ADAE\_IMPUTE

> `readonly` **ADAE\_IMPUTE**: `"Impute month-only AE starts to the first day, or first dose when it lies in that month; impute month-only ends to month end capped at last contact. Flag imputed days."` = `"Impute month-only AE starts to the first day, or first dose when it lies in that month; impute month-only ends to month end capped at last contact. Flag imputed days."`

### ADAE\_OCC

> `readonly` **ADAE\_OCC**: `"Flag the first treatment-emergent occurrence overall, by body system and by preferred term, ordered by analysis start date and AE sequence."` = `"Flag the first treatment-emergent occurrence overall, by body system and by preferred term, ordered by analysis start date and AE sequence."`

### ADAE\_TEAE

> `readonly` **ADAE\_TEAE**: `"A treatment-emergent AE starts from first dose through 14 days after last dose, capped at last known study contact."` = `"A treatment-emergent AE starts from first dose through 14 days after last dose, capped at last known study contact."`

### ADCM\_DAY

> `readonly` **ADCM\_DAY**: `"ASTDY and AENDY count from first dose (ADSL.TRTSDT) as day 1, with no day 0: the analysis date minus TRTSDT, plus 1 on or after first dose. Missing when either date is missing."` = `"ASTDY and AENDY count from first dose (ADSL.TRTSDT) as day 1, with no day 0: the analysis date minus TRTSDT, plus 1 on or after first dose. Missing when either date is missing."`

### ADCM\_IMPUTE

> `readonly` **ADCM\_IMPUTE**: `"Impute month-only medication starts to the first day, or first dose when it lies in that month; impute month-only ends to month end capped at last contact. Flag imputed days. A medication marked ongoing has no analysis end date."` = `"Impute month-only medication starts to the first day, or first dose when it lies in that month; impute month-only ends to month end capped at last contact. Flag imputed days. A medication marked ongoing has no analysis end date."`

### ADCM\_RESCUE

> `readonly` **ADCM\_RESCUE**: `"RESCUEFL is Y when the medication was recorded as rescue medication (CM.CMCAT is RESCUE MEDICATION), and blank otherwise."` = `"RESCUEFL is Y when the medication was recorded as rescue medication (CM.CMCAT is RESCUE MEDICATION), and blank otherwise."`

### ADCM\_TIMING

> `readonly` **ADCM\_TIMING**: `"For a dosed subject, PREFL is Y when the medication started before first dose, or has no analysis start date. ONTRTFL is Y when it started on or before the end of the on-treatment period (14 days after last dose, capped at last known contact) and ended on or after first dose, or has no analysis end date. A medication started before and continued after first dose has both flags. Both are blank for a subject never dosed."` = `"For a dosed subject, PREFL is Y when the medication started before first dose, or has no analysis start date. ONTRTFL is Y when it started on or before the end of the on-treatment period (14 days after last dose, capped at last known contact) and ended on or after first dose, or has no analysis end date. A medication started before and continued after first dose has both flags. Both are blank for a subject never dosed."`

### ADEG\_CRIT

> `readonly` **ADEG\_CRIT**: `"QTcF records only: CRIT1FL is Y when AVAL exceeds 500 ms, and CRIT2FL is Y when CHG exceeds 60 ms, the ICH E14 categorical thresholds for a QTc outlier. CRIT2FL is blank when there is no baseline."` = `"QTcF records only: CRIT1FL is Y when AVAL exceeds 500 ms, and CRIT2FL is Y when CHG exceeds 60 ms, the ICH E14 categorical thresholds for a QTc outlier. CRIT2FL is blank when there is no baseline."`

### ADEG\_QTCF

> `readonly` **ADEG\_QTCF**: `"QTcF is the QT interval corrected for heart rate by Fridericia's formula, QTcF = QT / (RR / 1000)^(1/3) with QT and RR in ms from the QTAG and RRAG results of the same ECG, rounded to 0.1 ms. It is not derived when either result is missing."` = `"QTcF is the QT interval corrected for heart rate by Fridericia's formula, QTcF = QT / (RR / 1000)^(1/3) with QT and RR in ms from the QTAG and RRAG results of the same ECG, rounded to 0.1 ms. It is not derived when either result is missing."`

### ADHCE\_ANL

> `readonly` **ADHCE\_ANL**: `"ANL01FL is Y when AVAL is not missing. A component with a missing AVAL is a tie for every pair that reaches it."` = `"ANL01FL is Y when AVAL is not missing. A component with a missing AVAL is a tie for every pair that reaches it."`

### ADHCE\_COMPONENT

> `readonly` **ADHCE\_COMPONENT**: `"One record per ITT subject per component of the hierarchical composite, in priority order (PARAMN): 1 death (ADTTE TTDTH), 2 first serious TEAE (ADTTE TTSAE), 3 first rescue medication (ADTTE TTRESC), 4 change from baseline in systolic blood pressure at Week 12 (ADVS PARAMCD = SYSBP, AVISIT = WEEK 12, ANL01FL = Y). ADT and CNSR are copied from the source record; AVAL is derived as the value-level metadata of each parameter describes."` = `"One record per ITT subject per component of the hierarchical composite, in priority order (PARAMN): 1 death (ADTTE TTDTH), 2 first serious TEAE (ADTTE TTSAE), 3 first rescue medication (ADTTE TTRESC), 4 change from baseline in systolic blood pressure at Week 12 (ADVS PARAMCD = SYSBP, AVISIT = WEEK 12, ANL01FL = Y). ADT and CNSR are copied from the source record; AVAL is derived as the value-level metadata of each parameter describes."`

### ADHCE\_SBP

> `readonly` **ADHCE\_SBP**: `"AVAL is ADVS.CHG of the Week 12 primary analysis record, rounded to 0.1 mmHg, the precision of the collected result, so that floating-point residue cannot decide a comparison against the 5 mmHg margin."` = `"AVAL is ADVS.CHG of the Week 12 primary analysis record, rounded to 0.1 mmHg, the precision of the collected result, so that floating-point residue cannot decide a comparison against the 5 mmHg margin."`

### ADHCE\_TTE

> `readonly` **ADHCE\_TTE**: `"AVAL and CNSR are the ADTTE values for the same subject and parameter: days from first dose, with CNSR = 1 when the subject was censored."` = `"AVAL and CNSR are the ADTTE values for the same subject and parameter: days from first dose, with CNSR = 1 when the subject was censored."`

### ADSL\_DEATH

> `readonly` **ADSL\_DEATH**: `"Date of death is DM.DTHDTC when that is a full date; missing for subjects with no recorded death. No death date is imputed."` = `"Date of death is DM.DTHDTC when that is a full date; missing for subjects with no recorded death. No death date is imputed."`

### ADSL\_DISP

> `readonly` **ADSL\_DISP**: `"End-of-study status and discontinuation reason come from the final DS disposition event."` = `"End-of-study status and discontinuation reason come from the final DS disposition event."`

### ADSL\_POP

> `readonly` **ADSL\_POP**: `"Safety: dosed; ITT: randomized and dosed; efficacy: ITT with baseline and postbaseline systolic blood pressure."` = `"Safety: dosed; ITT: randomized and dosed; efficacy: ITT with baseline and postbaseline systolic blood pressure."`

### ADSL\_TRT

> `readonly` **ADSL\_TRT**: `"Planned treatment comes from DM. Actual treatment and dates come from first and last EX records."` = `"Planned treatment comes from DM. Actual treatment and dates come from first and last EX records."`

### ADTTE\_CENSOR

> `readonly` **ADTTE\_CENSOR**: `"AVAL counts first-dose day as day 1. TTADISC: a dosed subject without an event is censored at the earlier of last known contact and discontinuation for another reason. TTDTH: censored at last known contact. TTSAE and TTRESC: censored at the end of the on-treatment period, 14 days after last dose, or at last known contact when that is earlier."` = `"AVAL counts first-dose day as day 1. TTADISC: a dosed subject without an event is censored at the earlier of last known contact and discontinuation for another reason. TTDTH: censored at last known contact. TTSAE and TTRESC: censored at the end of the on-treatment period, 14 days after last dose, or at last known contact when that is earlier."`

### ADTTE\_EVENT

> `readonly` **ADTTE\_EVENT**: `"TTADISC: an event is the first treatment-emergent AE with drug withdrawal corroborated by an adverse-event DS disposition, dated at the AE start date. TTDTH: death, dated at ADSL.DTHDT. TTSAE: the first serious treatment-emergent AE, dated at its analysis start date. TTRESC: the first rescue medication (ADCM.RESCUEFL = Y) started on or after first dose, dated at its analysis start date. TTSAE and TTRESC count only events up to the end of the on-treatment period."` = `"TTADISC: an event is the first treatment-emergent AE with drug withdrawal corroborated by an adverse-event DS disposition, dated at the AE start date. TTDTH: death, dated at ADSL.DTHDT. TTSAE: the first serious treatment-emergent AE, dated at its analysis start date. TTRESC: the first rescue medication (ADCM.RESCUEFL = Y) started on or after first dose, dated at its analysis start date. TTSAE and TTRESC count only events up to the end of the on-treatment period."`

### BDS\_ANALYSIS

> `readonly` **BDS\_ANALYSIS**: `"For each subject, parameter and analysis visit, select the observed row closest to target day, then earlier date, then lower source sequence."` = `"For each subject, parameter and analysis visit, select the observed row closest to target day, then earlier date, then lower source sequence."`

### BDS\_BASE

> `readonly` **BDS\_BASE**: `"Select the latest nonmissing assessment on or before first dose; a designated baseline visit on first-dose day is eligible."` = `"Select the latest nonmissing assessment on or before first dose; a designated baseline visit on first-dose day is eligible."`

### BDS\_CHANGE

> `readonly` **BDS\_CHANGE**: `"CHG is AVAL minus BASE; PCHG is 100 times CHG divided by nonzero BASE."` = `"CHG is AVAL minus BASE; PCHG is 100 times CHG divided by nonzero BASE."`

### BDS\_LOCF

> `readonly` **BDS\_LOCF**: `"For a missing postbaseline visit, carry the latest earlier postbaseline result as a flagged sensitivity row; exclude it from primary ANL01FL selection."` = `"For a missing postbaseline visit, carry the latest earlier postbaseline result as a flagged sensitivity row; exclude it from primary ANL01FL selection."`

### BDS\_WINDOW

> `readonly` **BDS\_WINDOW**: `"Assign observed assessments to USDM visit windows; closest target day wins, then earlier date, then lower source sequence."` = `"Assign observed assessments to USDM visit windows; closest target day wins, then earlier date, then lower source sequence."`
