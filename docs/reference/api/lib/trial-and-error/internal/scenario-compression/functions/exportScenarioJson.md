[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/trial-and-error/internal/scenario-compression](../README.md) / exportScenarioJson

# Function: exportScenarioJson()

> **exportScenarioJson**(`spec`): `string`

Serializes a CustomScenarioSpec as a JSON string for export.

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
