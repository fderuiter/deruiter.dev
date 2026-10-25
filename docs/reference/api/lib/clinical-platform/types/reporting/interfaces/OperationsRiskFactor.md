[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/clinical-platform/types/reporting](../README.md) / OperationsRiskFactor

# Interface: OperationsRiskFactor

A critical-to-quality factor, with the KRIs and QTLs that watch it by name.

## Properties

### gap

> `readonly` **gap**: \{ `issue`: `number`; `reason`: `string`; \} \| `null`

What the platform cannot watch yet, with the issue that adds it; `null` when nothing is missing.

***

### id

> `readonly` **id**: `string`

***

### kris

> `readonly` **kris**: readonly `string`[]

***

### name

> `readonly` **name**: `string`

***

### qtls

> `readonly` **qtls**: readonly `string`[]

***

### risk

> `readonly` **risk**: `string`
