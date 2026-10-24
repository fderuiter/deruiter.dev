[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-platform/types](../README.md) / Scd2Change

# Interface: Scd2Change

A dated change to some tracked attributes of a dimension member.

## Properties

### attributes

> `readonly` **attributes**: `Readonly`\<`Record`\<`string`, [`WarehouseValue`](../type-aliases/WarehouseValue.md)\>\>

Attributes that change; the others keep their value.

***

### effectiveOn

> `readonly` **effectiveOn**: `string`

ISO 8601 day the change takes effect.
