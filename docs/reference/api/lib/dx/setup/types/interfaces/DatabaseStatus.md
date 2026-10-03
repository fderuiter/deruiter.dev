[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/dx/setup/types](../README.md) / DatabaseStatus

# Interface: DatabaseStatus

Database stage record.

## Properties

### generate

> **generate**: [`DatabaseStepRecord`](DatabaseStepRecord.md)

***

### productionReasons

> **productionReasons**: `string`[]

***

### productionTarget

> **productionTarget**: `boolean`

Whether the target looked like production, and why.

***

### schema

> **schema**: [`DatabaseStepRecord`](DatabaseStepRecord.md)

***

### seed

> **seed**: [`DatabaseStepRecord`](DatabaseStepRecord.md)

***

### target

> **target**: `string` \| `null`

Redacted identity such as `localhost:5432/portfolio_dev`, or null.
