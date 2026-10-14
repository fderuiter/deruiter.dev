[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-trial-chaos/observation-generators](../README.md) / ProceduralObservationRequest

# Interface: ProceduralObservationRequest

What to generate, and where the result is filed.

## Properties

### field

> **field**: `string`

Field name; see [getProceduralFields](../functions/getProceduralFields.md).

***

### id

> **id**: `string`

Observation id.

***

### kind?

> `optional` **kind?**: [`ProceduralErrorKind`](../type-aliases/ProceduralErrorKind.md)

Error kind to apply; drawn from the field's kinds when omitted.

***

### random

> **random**: () => `number`

Random source returning values in [0, 1).

#### Returns

`number`

***

### ruleId?

> `optional` **ruleId?**: `string`

Rule id; defaults to `ast_rule_<id>`.
