[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/protocol-drift/internal/chips](../README.md) / standardizeUnit

# Function: standardizeUnit()

> **standardizeUnit**(`orres`, `unit`): [`StandardizedValue`](../interfaces/StandardizedValue.md) \| `null`

UnitStandardizer: kPa x 7.50062 = mmHg, kept unrounded; mmHg and
beats/min pass through. The original value and unit are preserved.
Returns null for an unknown unit, which is quarantined, never guessed.

## Parameters

### orres

`string`

### unit

`string`

## Returns

[`StandardizedValue`](../interfaces/StandardizedValue.md) \| `null`
