[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/warehouse/scd2](../README.md) / buildScd2Versions

# Function: buildScd2Versions()

> **buildScd2Versions**(`initial`, `changes`): [`Scd2Version`](../../../../types/warehouse/interfaces/Scd2Version.md)[]

Builds the versions of one dimension member. The first version starts on
`initial.effectiveOn` with `initial.attributes`. Each change takes effect
on its own day and opens a new version; changes on the same day merge into
one version, and a change that alters no value opens none. Each version
is in force from `validFrom` up to, not including, `validTo`; the last one
ends at `SCD2_OPEN_END` and is current.

## Parameters

### initial

[`Scd2Change`](../../../../types/warehouse/interfaces/Scd2Change.md)

First day the member exists, and its attributes then.

### changes

readonly [`Scd2Change`](../../../../types/warehouse/interfaces/Scd2Change.md)[]

Dated changes, in any order.

## Returns

[`Scd2Version`](../../../../types/warehouse/interfaces/Scd2Version.md)[]

Versions in date order, numbered from 1.

## Throws

RangeError when a date is not ISO 8601 or a change precedes the first day.
