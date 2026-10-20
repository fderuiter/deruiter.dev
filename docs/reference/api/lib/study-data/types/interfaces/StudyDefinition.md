[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-data/types](../README.md) / StudyDefinition

# Interface: StudyDefinition

The study the pipeline runs: an identifier, a title and the USDM v4.0
document that defines the schedule, arms, visits and endpoints.

## Properties

### studyId

> `readonly` **studyId**: `string`

Study identifier, for example `DEMO-301`.

***

### title

> `readonly` **title**: `string`

Protocol title.

***

### usdm

> `readonly` **usdm**: `unknown`

The USDM v4.0 study document, read through the USDM adapter.
