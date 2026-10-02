[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/trial-and-error/internal/scenario-compression](../README.md) / encodeCustomScenario

# Function: encodeCustomScenario()

> **encodeCustomScenario**(`spec`): `string`

Encodes a CustomScenarioSpec into a compressed URL-safe string.

## Parameters

### spec

#### cardIds

`string`[] = `...`

#### events?

`object`[] = `...`

#### id?

`string` = `...`

#### intro?

`string` = `...`

#### quota

`number` = `...`

#### rulebook

\{ `meanPrecision`: `number`; `percentPrecision`: `number`; `populationSuit?`: `"SCREENED"` \| `"ITT"` \| `"SAFETY"` \| `"PER_PROTOCOL"` \| `"FAS"`; `roundingMode`: `"HALF_EVEN"` \| `"HALF_AWAY_FROM_ZERO"` \| `"TRUNCATE"`; \} = `...`

#### rulebook.meanPrecision

`number` = `...`

#### rulebook.percentPrecision

`number` = `...`

#### rulebook.populationSuit?

`"SCREENED"` \| `"ITT"` \| `"SAFETY"` \| `"PER_PROTOCOL"` \| `"FAS"` = `...`

#### rulebook.roundingMode

`"HALF_EVEN"` \| `"HALF_AWAY_FROM_ZERO"` \| `"TRUNCATE"` = `RoundingModeSchema`

#### startingCpu

`number` = `...`

#### summary?

`string` = `...`

#### title

`string` = `...`

## Returns

`string`
