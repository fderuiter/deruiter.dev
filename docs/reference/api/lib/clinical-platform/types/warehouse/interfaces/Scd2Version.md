[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/clinical-platform/types/warehouse](../README.md) / Scd2Version

# Interface: Scd2Version

One version of a slowly changing dimension member.

## Properties

### attributes

> `readonly` **attributes**: `Readonly`\<`Record`\<`string`, [`WarehouseValue`](../../platform/type-aliases/WarehouseValue.md)\>\>

Tracked attribute values in force during the version.

***

### isCurrent

> `readonly` **isCurrent**: `boolean`

Whether this is the latest version.

***

### validFrom

> `readonly` **validFrom**: `string`

ISO 8601 first day in force (inclusive).

***

### validTo

> `readonly` **validTo**: `string`

ISO 8601 day the next version takes over (exclusive), or `SCD2_OPEN_END`.

***

### version

> `readonly` **version**: `number`

Version number, from 1.
