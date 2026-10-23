[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-platform/types](../README.md) / PlannedVisit

# Interface: PlannedVisit

One planned encounter in a study's schedule, shaped after a USDM
encounter with its timing and window.

## Properties

### day

> `readonly` **day**: `number`

Planned day relative to the enrollment visit, which is day 0.

***

### dispensesProduct

> `readonly` **dispensesProduct**: `boolean`

Whether investigational product is dispensed at the visit.

***

### id

> `readonly` **id**: `string`

Stable visit id within the study, for example `W12`.

***

### name

> `readonly` **name**: `string`

Display name, for example `Week 12`.

***

### windowDays

> `readonly` **windowDays**: `number`

Allowed deviation from the planned day, in days either side.
