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

### CT\_RELATIONSHIP\_MAPPING

> `readonly` **CT\_RELATIONSHIP\_MAPPING**: `"Collected causality mapped to the submission value: RELATED is written as POSSIBLY RELATED; other values are kept."` = `"Collected causality mapped to the submission value: RELATED is written as POSSIBLY RELATED; other values are kept."`

### CT\_UNIT\_MAPPING

> `readonly` **CT\_UNIT\_MAPPING**: `"Collected dose unit mapped to the submission value: TABLET is written as TABLETS."` = `"Collected dose unit mapped to the submission value: TABLET is written as TABLETS."`

### EXPOSURE\_ARM

> `readonly` **EXPOSURE\_ARM**: `"The randomized arm code and arm, for every randomized subject; SCRNFAIL and Screen Failure for subjects never randomized."` = `"The randomized arm code and arm, for every randomized subject; SCRNFAIL and Screen Failure for subjects never randomized."`

### FIRST\_EXPOSURE

> `readonly` **FIRST\_EXPOSURE**: `"Start date of the subject's exposure record (EXSTDTC); missing for subjects never dosed."` = `"Start date of the subject's exposure record (EXSTDTC); missing for subjects never dosed."`

### LAST\_EXPOSURE

> `readonly` **LAST\_EXPOSURE**: `"End date of the subject's exposure record (EXENDTC); missing for subjects never dosed or with no exposure end date."` = `"End date of the subject's exposure record (EXENDTC); missing for subjects never dosed or with no exposure end date."`

### LAST\_PRE\_DOSE

> `readonly` **LAST\_PRE\_DOSE**: `"Y on the subject's latest record for the test dated on or before first exposure; missing otherwise."` = `"Y on the subject's latest record for the test dated on or before first exposure; missing otherwise."`

### RANDOMIZATION

> `readonly` **RANDOMIZATION**: `"Arm code and arm from the subject's randomization record; SCRNFAIL and Screen Failure for subjects never randomized."` = `"Arm code and arm from the subject's randomization record; SCRNFAIL and Screen Failure for subjects never randomized."`

### SOURCE\_ORDER

> `readonly` **SOURCE\_ORDER**: `"Number each subject's records from 1 in the order they are tabulated."` = `"Number each subject's records from 1 in the order they are tabulated."`

### STANDARD\_RESULT

> `readonly` **STANDARD\_RESULT**: `"The collected result, since results are collected in the standard unit: as text in --STRESC and as a number in --STRESN."` = `"The collected result, since results are collected in the standard unit: as text in --STRESC and as a number in --STRESN."`

### STUDY\_DAY

> `readonly` **STUDY\_DAY**: `"Days from RFSTDTC (first exposure) to the record date, plus one when the date is on or after RFSTDTC; there is no Day 0. Missing when either date is missing or partial."` = `"Days from RFSTDTC (first exposure) to the record date, plus one when the date is on or after RFSTDTC; there is no Day 0. Missing when either date is missing or partial."`

### TEXT\_RESULT

> `readonly` **TEXT\_RESULT**: `"The collected numeric result written as text."` = `"The collected numeric result written as text."`

### USDM\_ASSESSMENT

> `readonly` **USDM\_ASSESSMENT**: `"Test name and standard unit of the USDM biomedical concept for the test code."` = `"Test name and standard unit of the USDM biomedical concept for the test code."`
