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

### ADEG\_CRIT

> `readonly` **ADEG\_CRIT**: `"QTcF records only: CRIT1FL is Y when AVAL exceeds 500 ms, and CRIT2FL is Y when CHG exceeds 60 ms, the ICH E14 categorical thresholds for a QTc outlier. CRIT2FL is blank when there is no baseline."` = `"QTcF records only: CRIT1FL is Y when AVAL exceeds 500 ms, and CRIT2FL is Y when CHG exceeds 60 ms, the ICH E14 categorical thresholds for a QTc outlier. CRIT2FL is blank when there is no baseline."`

### ADEG\_QTCF

> `readonly` **ADEG\_QTCF**: `"QTcF is the QT interval corrected for heart rate by Fridericia's formula, QTcF = QT / (RR / 1000)^(1/3) with QT and RR in ms from the QTAG and RRAG results of the same ECG, rounded to 0.1 ms. It is not derived when either result is missing."` = `"QTcF is the QT interval corrected for heart rate by Fridericia's formula, QTcF = QT / (RR / 1000)^(1/3) with QT and RR in ms from the QTAG and RRAG results of the same ECG, rounded to 0.1 ms. It is not derived when either result is missing."`

### ADSL\_DEATH

> `readonly` **ADSL\_DEATH**: `"Date of death is DM.DTHDTC when that is a full date; missing for subjects with no recorded death. No death date is imputed."` = `"Date of death is DM.DTHDTC when that is a full date; missing for subjects with no recorded death. No death date is imputed."`

### ADSL\_DISP

> `readonly` **ADSL\_DISP**: `"End-of-study status and discontinuation reason come from the final DS disposition event."` = `"End-of-study status and discontinuation reason come from the final DS disposition event."`

### ADSL\_POP

> `readonly` **ADSL\_POP**: `"Safety: dosed; ITT: randomized and dosed; efficacy: ITT with baseline and postbaseline systolic blood pressure."` = `"Safety: dosed; ITT: randomized and dosed; efficacy: ITT with baseline and postbaseline systolic blood pressure."`

### ADSL\_TRT

> `readonly` **ADSL\_TRT**: `"Planned treatment comes from DM. Actual treatment and dates come from first and last EX records."` = `"Planned treatment comes from DM. Actual treatment and dates come from first and last EX records."`

### ADTTE\_CENSOR

> `readonly` **ADTTE\_CENSOR**: `"For a dosed subject without an event, censor at the earlier of last known contact and discontinuation for another reason; count first-dose day as day 1."` = `"For a dosed subject without an event, censor at the earlier of last known contact and discontinuation for another reason; count first-dose day as day 1."`

### ADTTE\_EVENT

> `readonly` **ADTTE\_EVENT**: `"An event is the first treatment-emergent AE with drug withdrawal corroborated by an adverse-event DS disposition; event date is AE start date."` = `"An event is the first treatment-emergent AE with drug withdrawal corroborated by an adverse-event DS disposition; event date is AE start date."`

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
