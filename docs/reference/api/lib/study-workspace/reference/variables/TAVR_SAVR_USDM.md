[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-workspace/reference](../README.md) / TAVR\_SAVR\_USDM

# Variable: TAVR\_SAVR\_USDM

> `const` **TAVR\_SAVR\_USDM**: [`UsdmV4Document`](../../../clinical-standards/usdm-v4-types/interfaces/UsdmV4Document.md)

The randomised TAVR versus SAVR reference study as a USDM v4 document: a
fictional two-arm trial, randomised 1:1 in permuted blocks stratified by
surgical risk, whose primary endpoint is a hierarchical composite over one
year (all-cause death, disabling stroke, valve-related or heart-failure
rehospitalisation, then change in quality of life with a 5-point margin)
analysed by a stratified win ratio in all randomised participants.

It was derived on 2026-10-27 from [TAVR\_DEVICE\_USDM](TAVR_DEVICE_USDM.md) and shares its
forms, visits and valve. USDM v4 has no class for stratification, so the
design carries the randomisation characteristics as codes and the ratio
and strata in the shared `randomisation` extension. The quality-of-life
level uses the Valve Symptom and Function Score, a fictional instrument
standing in for a licensed questionnaire. This file is the source; edit it
directly.
