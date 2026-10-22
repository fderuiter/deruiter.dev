[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-data/types](../README.md) / StudyDefinition

# Interface: StudyDefinition

The study the pipeline runs: an identifier, a title, the USDM v4.0
document that defines it, and the design read from that document.

## Properties

### design

> `readonly` **design**: [`StudyDesignDefinition`](StudyDesignDefinition.md)

Arms, visits, schedule of activities and endpoints, read from `usdm`.

***

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

The USDM v4.0 study document the definition was read from.
