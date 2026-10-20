[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-data/types](../README.md) / ActivityDefinition

# Interface: ActivityDefinition

One activity in the schedule of activities.

## Properties

### assessments

> `readonly` **assessments**: readonly [`AssessmentDefinition`](AssessmentDefinition.md)[]

Measurements the activity collects, empty for event and intervention domains.

***

### domain

> `readonly` **domain**: `string`

SDTM domain the activity's data is tabulated in, for example `VS`.

***

### id

> `readonly` **id**: `string`

USDM activity id.

***

### name

> `readonly` **name**: `string`

Activity name.
