[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/trial-and-error/internal/scenario-compression](../README.md) / decodeCustomScenario

# Function: decodeCustomScenario()

> **decodeCustomScenario**(`encoded`): \{ `cardIds`: `string`[]; `events?`: `object`[]; `id?`: `string`; `intro?`: `string`; `quota`: `number`; `rulebook`: \{ `meanPrecision`: `number`; `percentPrecision`: `number`; `populationSuit?`: `"SCREENED"` \| `"ITT"` \| `"SAFETY"` \| `"PER_PROTOCOL"` \| `"FAS"`; `roundingMode`: `"HALF_EVEN"` \| `"HALF_AWAY_FROM_ZERO"` \| `"TRUNCATE"`; \}; `startingCpu`: `number`; `summary?`: `string`; `title`: `string`; \} \| `null`

Decodes a compressed URL-safe string back into a CustomScenarioSpec,
returning null if malformed or invalid.

## Parameters

### encoded

`string`

## Returns

\{ `cardIds`: `string`[]; `events?`: `object`[]; `id?`: `string`; `intro?`: `string`; `quota`: `number`; `rulebook`: \{ `meanPrecision`: `number`; `percentPrecision`: `number`; `populationSuit?`: `"SCREENED"` \| `"ITT"` \| `"SAFETY"` \| `"PER_PROTOCOL"` \| `"FAS"`; `roundingMode`: `"HALF_EVEN"` \| `"HALF_AWAY_FROM_ZERO"` \| `"TRUNCATE"`; \}; `startingCpu`: `number`; `summary?`: `string`; `title`: `string`; \} \| `null`
