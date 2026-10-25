[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-platform/types](../README.md) / CriticalToQualityFactor

# Interface: CriticalToQualityFactor

A critical-to-quality factor (ICH E8(R1)) and how the plan watches it.

## Properties

### gap

> `readonly` **gap**: \{ `issue`: `number`; `reason`: `string`; \} \| `null`

What the platform cannot watch yet, with the issue that adds it; `null` when nothing is missing.

***

### id

> `readonly` **id**: `string`

***

### kriIds

> `readonly` **kriIds**: readonly `string`[]

KRIs that watch the factor.

***

### name

> `readonly` **name**: `string`

***

### qtlIds

> `readonly` **qtlIds**: readonly `string`[]

QTLs that bound the factor.

***

### risk

> `readonly` **risk**: `string`

What could go wrong and what it would do to subjects or results.
