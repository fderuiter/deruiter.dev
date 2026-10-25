[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/clinical-platform/types/quality](../README.md) / DqRule

# Interface: DqRule

One data quality rule over a data product (#2636).

## Extended by

- [`PlatformDqRule`](../../../internal/quality/rules/interfaces/PlatformDqRule.md)

## Properties

### citation

> `readonly` **citation**: `string` \| `null`

Published rule or guide the rule models, for ingested rules; `null` otherwise.

***

### dataset

> `readonly` **dataset**: `string` \| `null`

Dataset within the product, for an ingested conformance rule; `null` otherwise.

***

### dimension

> `readonly` **dimension**: [`DqDimension`](../../platform/type-aliases/DqDimension.md)

***

### expression

> `readonly` **expression**: `string`

The check as a SQL-style predicate over the product's rows.

***

### id

> `readonly` **id**: `string`

Stable id: `DQ-` and a dimension letter for platform rules, the conformance rule id for ingested ones.

***

### name

> `readonly` **name**: `string`

What the rule asks, in a sentence.

***

### owner

> `readonly` **owner**: `string`

Data steward of the product, from its contract registration.

***

### productId

> `readonly` **productId**: `string`

Data product the rule checks: a warehouse table, or the Study Data Pipeline.

***

### rationale

> `readonly` **rationale**: `string`

Why the rule exists.

***

### severity

> `readonly` **severity**: [`DqSeverity`](../type-aliases/DqSeverity.md)

***

### source

> `readonly` **source**: `"platform"` \| `"conformance"`

`platform` for rules written here, `conformance` for Study Data Pipeline rules ingested as they are.

***

### threshold

> `readonly` **threshold**: `number`

Least share of checked rows that must pass, from 0 to 1.
