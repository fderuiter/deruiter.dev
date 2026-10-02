[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/trial-and-error/internal/scenario-compression](../README.md) / importScenarioJson

# Function: importScenarioJson()

> **importScenarioJson**(`jsonStr`): `object`

Parses and validates an imported scenario JSON payload string.

## Parameters

### jsonStr

`string`

## Returns

`object`

### cardIds

> **cardIds**: `string`[]

### events?

> `optional` **events?**: `object`[]

### id?

> `optional` **id?**: `string`

### intro?

> `optional` **intro?**: `string`

### quota

> **quota**: `number`

### rulebook

> **rulebook**: `object`

#### rulebook.meanPrecision

> **meanPrecision**: `number`

#### rulebook.percentPrecision

> **percentPrecision**: `number`

#### rulebook.populationSuit?

> `optional` **populationSuit?**: `"SCREENED"` \| `"ITT"` \| `"SAFETY"` \| `"PER_PROTOCOL"` \| `"FAS"`

#### rulebook.roundingMode

> **roundingMode**: `"HALF_EVEN"` \| `"HALF_AWAY_FROM_ZERO"` \| `"TRUNCATE"` = `RoundingModeSchema`

### startingCpu

> **startingCpu**: `number`

### summary?

> `optional` **summary?**: `string`

### title

> **title**: `string`
