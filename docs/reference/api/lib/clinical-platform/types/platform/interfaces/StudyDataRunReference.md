[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/clinical-platform/types/platform](../README.md) / StudyDataRunReference

# Interface: StudyDataRunReference

The Study Data Pipeline run a study's bronze records were taken from
(ADR 0065, ADR 0066). Rerunning `runPipeline` from `@/lib/study-data` with
the study's definition, `seed` and `nSubjects` reproduces the source
datasets; adding `dateShiftDays` to their dates gives the portfolio's.

## Extends

- [`SyntheticRecord`](SyntheticRecord.md)

## Properties

### dateShiftDays

> `readonly` **dateShiftDays**: `number`

Whole days added to every pipeline date to place the study on the
portfolio's calendar. Study days and visit order are unchanged.

***

### nSubjects

> `readonly` **nSubjects**: `number`

Number of subjects the pipeline generated, screen failures included.

***

### productId

> `readonly` **productId**: `string`

Id of the gold data product the run publishes (`STUDY_DATA_PRODUCT_ID`).

***

### seed

> `readonly` **seed**: `number`

Seed the pipeline ran with.

***

### sourceDatasets

> `readonly` **sourceDatasets**: readonly `string`[]

Collected-layer datasets the bronze feeds were read from.

***

### standards

> `readonly` **standards**: [`StandardVersions`](../../../../study-data/types/type-aliases/StandardVersions.md)

Standard versions the run declares, from its manifest.

***

### studyId

> `readonly` **studyId**: `string`

Study id, for example `DEMO-301`.

***

### synthetic

> `readonly` **synthetic**: `true`

Always `true`: the record is synthetic and describes nothing real.

#### Inherited from

[`SyntheticRecord`](SyntheticRecord.md).[`synthetic`](SyntheticRecord.md#synthetic)
