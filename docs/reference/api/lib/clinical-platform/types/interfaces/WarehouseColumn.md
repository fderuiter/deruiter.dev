[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-platform/types](../README.md) / WarehouseColumn

# Interface: WarehouseColumn

One column of a warehouse table: the single source for DDL, exports and the ERD.

## Properties

### classification

> `readonly` **classification**: [`DataClassification`](../type-aliases/DataClassification.md)

Data classification of the values the column holds.

***

### description

> `readonly` **description**: `string`

Business description.

***

### length

> `readonly` **length**: `number` \| `null`

Maximum length of a `string` value, in characters; `null` for other types.

***

### lineage

> `readonly` **lineage**: readonly `string`[]

Source columns, each as `layer.product.column`, for example
`bronze.edc.subjects.subjectId` or `silver.edc_visit.visit_date`.
Empty for generated columns such as surrogate keys.

***

### name

> `readonly` **name**: `string`

Column name, in snake case.

***

### nullable

> `readonly` **nullable**: `boolean`

Whether the column may hold `null`.

***

### precision

> `readonly` **precision**: `number` \| `null`

Total digits of a `decimal` value; `null` for other types.

***

### references

> `readonly` **references**: [`WarehouseReference`](WarehouseReference.md) \| `null`

Foreign key target, or `null` when the column is not a foreign key.

***

### scale

> `readonly` **scale**: `number` \| `null`

Digits after the decimal point of a `decimal` value; `null` for other types.

***

### transformation

> `readonly` **transformation**: `string`

How the value is derived from its sources, for example `identity` or `cast`.

***

### type

> `readonly` **type**: [`WarehouseColumnType`](../type-aliases/WarehouseColumnType.md)

Logical type.
