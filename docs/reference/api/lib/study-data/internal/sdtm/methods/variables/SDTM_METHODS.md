[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/sdtm/methods](../README.md) / SDTM\_METHODS

# Variable: SDTM\_METHODS

> `const` **SDTM\_METHODS**: `object`

Derivation methods of the SDTM tabulation specs. Each Derived SDTM
variable names one of these ids, and Define-XML writes the text as its
MethodDef, so the method a reviewer reads is the one the spec names.

## Type Declaration

### ACTUAL\_ELEMENT\_FROM\_TA\_TE

> `readonly` **ACTUAL\_ELEMENT\_FROM\_TA\_TE**: `"The epoch on the record date, in USDM epoch order: before first exposure the first epoch, from first through last exposure the second, after that the third, kept only when TA lists it. Records of subjects never dosed are in the first epoch; a missing or partial date gives no epoch."` = `"The epoch on the record date, in USDM epoch order: before first exposure the first epoch, from first through last exposure the second, after that the third, kept only when TA lists it. Records of subjects never dosed are in the first epoch; a missing or partial date gives no epoch."`

### AE\_DICTIONARY\_CODING

> `readonly` **AE\_DICTIONARY\_CODING**: `"Looked up from the preferred term (AEDECOD) in the study's fictional adverse event dictionary, which has MedDRA's five levels but is not MedDRA: its lower and group level names are invented and its codes are synthetic, from 99000000. Each lowest level term is its preferred term. Missing when the preferred term is not in the dictionary."` = `"Looked up from the preferred term (AEDECOD) in the study's fictional adverse event dictionary, which has MedDRA's five levels but is not MedDRA: its lower and group level names are invented and its codes are synthetic, from 99000000. Each lowest level term is its preferred term. Missing when the preferred term is not in the dictionary."`

### ARM\_NULL\_REASON

> `readonly` **ARM\_NULL\_REASON**: `"SCREEN FAILURE (Arm Null Reason, C142179) for a subject never randomized, since the pipeline leaves a subject unrandomized only when screening fails; missing for every randomized subject."` = `"SCREEN FAILURE (Arm Null Reason, C142179) for a subject never randomized, since the pipeline leaves a subject unrandomized only when screening fails; missing for every randomized subject."`

### CT\_RELATIONSHIP\_MAPPING

> `readonly` **CT\_RELATIONSHIP\_MAPPING**: `"Collected causality mapped to the submission value: RELATED is written as POSSIBLY RELATED; other values are kept."` = `"Collected causality mapped to the submission value: RELATED is written as POSSIBLY RELATED; other values are kept."`

### CT\_UNIT\_MAPPING

> `readonly` **CT\_UNIT\_MAPPING**: `"Collected dose unit, which is already the UNIT submission value (TABLET, C48542)."` = `"Collected dose unit, which is already the UNIT submission value (TABLET, C48542)."`

### DEATH\_DATE

> `readonly` **DEATH\_DATE**: `"Date of the subject's DEATH disposition event (DSSTDTC); missing for subjects with no recorded death."` = `"Date of the subject's DEATH disposition event (DSSTDTC); missing for subjects with no recorded death."`

### DEATH\_FLAG

> `readonly` **DEATH\_FLAG**: `"Y when the subject has a DEATH disposition event; missing otherwise."` = `"Y when the subject has a DEATH disposition event; missing otherwise."`

### EXPOSURE\_ARM

> `readonly` **EXPOSURE\_ARM**: `"The randomized arm code and arm, for every randomized subject, each of whom is dosed with that arm's treatment; missing for subjects never randomized, whose reason is in ARMNRS."` = `"The randomized arm code and arm, for every randomized subject, each of whom is dosed with that arm's treatment; missing for subjects never randomized, whose reason is in ARMNRS."`

### FIRST\_EXPOSURE

> `readonly` **FIRST\_EXPOSURE**: `"Start date of the subject's exposure record (EXSTDTC); missing for subjects never dosed."` = `"Start date of the subject's exposure record (EXSTDTC); missing for subjects never dosed."`

### LAB\_CATEGORY

> `readonly` **LAB\_CATEGORY**: `"The laboratory panel of the test at the study's fictional central laboratory: CHEMISTRY for ALT, AST, BILI, CREAT and GLUC; HEMATOLOGY for HGB, WBC and PLAT."` = `"The laboratory panel of the test at the study's fictional central laboratory: CHEMISTRY for ALT, AST, BILI, CREAT and GLUC; HEMATOLOGY for HGB, WBC and PLAT."`

### LAB\_REFERENCE\_RANGE

> `readonly` **LAB\_REFERENCE\_RANGE**: `"Lower and upper limits of the test's reference range at the study's fictional central laboratory, in standard units for --STNRLO and --STNRHI (numbers) and, when the result was collected in the standard unit, in original units for --ORNRLO and --ORNRHI (text). The original-unit limits are missing when the collected unit differs."` = `"Lower and upper limits of the test's reference range at the study's fictional central laboratory, in standard units for --STNRLO and --STNRHI (numbers) and, when the result was collected in the standard unit, in original units for --ORNRLO and --ORNRHI (text). The original-unit limits are missing when the collected unit differs."`

### LAST\_EXPOSURE

> `readonly` **LAST\_EXPOSURE**: `"End date of the subject's exposure record (EXENDTC); missing for subjects never dosed or with no exposure end date."` = `"End date of the subject's exposure record (EXENDTC); missing for subjects never dosed or with no exposure end date."`

### LAST\_PARTICIPATION

> `readonly` **LAST\_PARTICIPATION**: `"The latest complete date on any of the subject's collected records: consent, randomization, visits, exposure, adverse events, vital signs, laboratory tests and disposition events. Partial dates are ignored."` = `"The latest complete date on any of the subject's collected records: consent, randomization, visits, exposure, adverse events, vital signs, laboratory tests and disposition events. Partial dates are ignored."`

### LAST\_PRE\_DOSE

> `readonly` **LAST\_PRE\_DOSE**: `"Y on the subject's latest record for the test dated on or before first exposure; missing otherwise."` = `"Y on the subject's latest record for the test dated on or before first exposure; missing otherwise."`

### RANDOMIZATION

> `readonly` **RANDOMIZATION**: `"Arm code and arm from the subject's randomization record; missing for subjects never randomized, whose reason is in ARMNRS."` = `"Arm code and arm from the subject's randomization record; missing for subjects never randomized, whose reason is in ARMNRS."`

### SOURCE\_ORDER

> `readonly` **SOURCE\_ORDER**: `"Number each subject's records from 1 in the order they are tabulated."` = `"Number each subject's records from 1 in the order they are tabulated."`

### STANDARD\_RESULT

> `readonly` **STANDARD\_RESULT**: `"The collected result in the test's standard unit, as text in --STRESC and as a number in --STRESN: as collected when the collected unit is the standard unit, otherwise converted by a fixed factor and rounded to two decimals. The one conversion defined is glucose from mg/dL to mmol/L (divide by 18.016); with any other unit the standard result is missing."` = `"The collected result in the test's standard unit, as text in --STRESC and as a number in --STRESN: as collected when the collected unit is the standard unit, otherwise converted by a fixed factor and rounded to two decimals. The one conversion defined is glucose from mg/dL to mmol/L (divide by 18.016); with any other unit the standard result is missing."`

### STUDY\_DAY

> `readonly` **STUDY\_DAY**: `"Days from RFSTDTC (first exposure) to the record date, plus one when the date is on or after RFSTDTC; there is no Day 0. Missing when either date is missing or partial."` = `"Days from RFSTDTC (first exposure) to the record date, plus one when the date is on or after RFSTDTC; there is no Day 0. Missing when either date is missing or partial."`

### TEXT\_RESULT

> `readonly` **TEXT\_RESULT**: `"The collected numeric result written as text."` = `"The collected numeric result written as text."`

### UNPLANNED\_ARM

> `readonly` **UNPLANNED\_ARM**: `"Missing for every subject: each dosed subject receives the treatment of the arm they were randomized to, so no actual arm is unplanned."` = `"Missing for every subject: each dosed subject receives the treatment of the arm they were randomized to, so no actual arm is unplanned."`

### USDM\_ASSESSMENT

> `readonly` **USDM\_ASSESSMENT**: `"Test name and standard unit of the USDM biomedical concept for the test code."` = `"Test name and standard unit of the USDM biomedical concept for the test code."`

### USDM\_DOSE\_FORM

> `readonly` **USDM\_DOSE\_FORM**: `"Dose form of the investigational product in the USDM administrable product, written as its Dosage Form (C66726) submission value: TABLET for C42998. Missing when the study names no investigational product or its dose form is not in the codelist."` = `"Dose form of the investigational product in the USDM administrable product, written as its Dosage Form (C66726) submission value: TABLET for C42998. Missing when the study names no investigational product or its dose form is not in the codelist."`
