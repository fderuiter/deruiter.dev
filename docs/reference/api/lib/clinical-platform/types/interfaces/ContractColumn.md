[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-platform/types](../README.md) / ContractColumn

# Interface: ContractColumn

One column a data contract guarantees.

## Properties

### classification

> `readonly` **classification**: [`DataClassification`](../type-aliases/DataClassification.md)

Data classification of the values.

***

### description

> `readonly` **description**: `string`

Business description.

***

### maxLength

> `readonly` **maxLength**: `number` \| `null`

Longest `string` value, in characters, or `null` for no limit.

***

### name

> `readonly` **name**: `string`

Column name.

***

### nullable

> `readonly` **nullable**: `boolean`

Whether the column may hold `null`. A required column counts towards completeness.

***

### pattern

> `readonly` **pattern**: `string` \| `null`

Regular expression every `string` value matches, or `null`. SDTM dates
and times are ISO 8601 text that may be partial, so they are strings
with a pattern rather than dates.

***

### precision

> `readonly` **precision**: `number` \| `null`

Total digits of a `decimal` value, or `null` for no limit.

***

### scale

> `readonly` **scale**: `number` \| `null`

Digits after the decimal point of a `decimal` value, or `null` for no limit.

***

### type

> `readonly` **type**: [`ContractColumnType`](../type-aliases/ContractColumnType.md)

Logical type.
