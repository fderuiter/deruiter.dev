[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-data/types](../README.md) / AssessmentDefinition

# Interface: AssessmentDefinition

One measurement an activity collects, from a USDM biomedical concept.

## Properties

### conceptId

> `readonly` **conceptId**: `string`

USDM biomedical concept id.

***

### nciCode

> `readonly` **nciCode**: `string`

NCI EVS code of the concept, for example `C25298`.

***

### testCode

> `readonly` **testCode**: `string`

Test short name (`--TESTCD`), for example `SYSBP`.

***

### testName

> `readonly` **testName**: `string`

Test name (`--TEST`), for example `Systolic Blood Pressure`.

***

### unit?

> `readonly` `optional` **unit?**: `string`

Standard result unit (`--STRESU`), when the test has one.
