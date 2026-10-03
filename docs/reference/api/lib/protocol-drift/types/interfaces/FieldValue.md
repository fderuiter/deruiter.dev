[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/protocol-drift/types](../README.md) / FieldValue

# Interface: FieldValue

A single collected value travelling on a field, text or date port.

## Properties

### iso?

> `optional` **iso?**: `string`

ISO date or partial date, set by a date normalizer.

***

### name

> **name**: `string`

***

### orres

> **orres**: `string`

Original result exactly as collected.

***

### orresu

> **orresu**: `string`

Original unit as collected or as declared by the site profile.

***

### precision?

> `optional` **precision?**: `number`

Decimal places used for display of the standardized value.

***

### standardized

> **standardized**: `boolean`

True once a UnitStandardizer handled the value.

***

### stresn?

> `optional` **stresn?**: `number`

Standardized numeric result, unrounded.

***

### stresu?

> `optional` **stresu?**: `string`
