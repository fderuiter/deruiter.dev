[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/warehouse/scd2](../README.md) / versionOn

# Function: versionOn()

> **versionOn**\<`T`\>(`versions`, `day`): `T` \| `undefined`

Finds the version in force on a day.

## Type Parameters

### T

`T` *extends* `Pick`\<[`Scd2Version`](../../../../types/warehouse/interfaces/Scd2Version.md), `"validFrom"` \| `"validTo"`\>

## Parameters

### versions

readonly `T`[]

Versions from `buildScd2Versions`.

### day

`string`

ISO 8601 date.

## Returns

`T` \| `undefined`

The version whose range holds the day, or `undefined` before the first.
