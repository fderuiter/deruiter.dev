[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-platform/types](../README.md) / DqRule

# Interface: DqRule

One data quality rule.

## Properties

### column

> `readonly` **column**: `string` \| `null`

Column the rule checks, or `null` for a table-level rule.

***

### description

> `readonly` **description**: `string`

What the rule checks, in one sentence.

***

### dimension

> `readonly` **dimension**: [`DqDimension`](../type-aliases/DqDimension.md)

Quality dimension.

***

### id

> `readonly` **id**: `string`

Stable rule id, for example `DQ-SITE-001`.

***

### owner

> `readonly` **owner**: `string`

Accountable owner (a role).

***

### productId

> `readonly` **productId**: `string`

Id of the product the rule checks.

***

### severity

> `readonly` **severity**: [`DqSeverity`](../type-aliases/DqSeverity.md)

Severity of a breach.

***

### threshold

> `readonly` **threshold**: `number`

Minimum pass rate, from 0 to 1.
