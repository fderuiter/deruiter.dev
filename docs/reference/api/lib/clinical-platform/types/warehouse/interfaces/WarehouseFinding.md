[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/clinical-platform/types/warehouse](../README.md) / WarehouseFinding

# Interface: WarehouseFinding

A broken warehouse invariant, reported by `checkWarehouse`.

## Properties

### message

> `readonly` **message**: `string`

What is wrong, in one sentence.

***

### rule

> `readonly` **rule**: `"type"` \| `"length"` \| `"table"` \| `"column"` \| `"nullability"` \| `"grain"` \| `"unique"` \| `"foreign-key"` \| `"scd2"`

Invariant that failed.

***

### table

> `readonly` **table**: `string`

Qualified table name.
