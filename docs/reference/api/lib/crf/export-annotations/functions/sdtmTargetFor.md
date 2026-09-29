[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/export-annotations](../README.md) / sdtmTargetFor

# Function: sdtmTargetFor()

> **sdtmTargetFor**(`field`, `domain`): `string`

The SDTM target annotated for a field.

The CDASH metadata's `acrfAnnotation` carries the submission target (for
example `DS.DSSTDTC [DSDECOD=INFORMED CONSENT OBTAINED]`), whereas
`sdtmVariable` holds the CDASH collection name (`ICDAT`), which is not an
SDTM annotation. Falls back to `DOMAIN.VARIABLE`.

## Parameters

### field

[`CRFField`](../../types/interfaces/CRFField.md)

The CRF field being annotated.

### domain

`string`

The owning form's SDTM domain code.

## Returns

`string`

The annotation text shown in the aCRF and mapping tables.
