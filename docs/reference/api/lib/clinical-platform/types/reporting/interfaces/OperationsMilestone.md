[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/clinical-platform/types/reporting](../README.md) / OperationsMilestone

# Interface: OperationsMilestone

A study milestone, planned and actual, in the study's own vocabulary (drug or device).

## Properties

### actual

> `readonly` **actual**: `string` \| `null`

ISO 8601 actual date, or `null` when not yet reached.

***

### kind

> `readonly` **kind**: `string`

Milestone kind, for example `regulatory-approval`.

***

### label

> `readonly` **label**: `string`

Label, for example `IDE approval` for a device study.

***

### planned

> `readonly` **planned**: `string`

ISO 8601 planned date.

***

### varianceDays

> `readonly` **varianceDays**: `number` \| `null`

Actual minus planned, in days; negative is early. `null` when not yet reached.
