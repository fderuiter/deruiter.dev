[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/trial-and-error/internal/amendments](../README.md) / amendRulebook

# Function: amendRulebook()

> **amendRulebook**(`rulebook`, `amendments`): `object`

The rulebook with `amendments` applied in order. Each adds its code to the
rulebook's id, so outputs compiled under the old id can be told apart.
With none, the rulebook comes back unchanged.

## Parameters

### rulebook

#### id

`string` = `identifier`

#### meanPrecision

`number` = `...`

#### percentPrecision

`number` = `...`

#### populationAliases

`object`[] = `...`

#### populationSuit

`"SCREENED"` \| `"ITT"` \| `"SAFETY"` \| `"PER_PROTOCOL"` \| `"FAS"` = `PopulationTypeSchema`

#### roundingMode

`"HALF_EVEN"` \| `"HALF_AWAY_FROM_ZERO"` \| `"TRUNCATE"` = `RoundingModeSchema`

#### rules

`object`[] = `...`

#### title

`string` = `...`

### amendments

readonly `object`[]

## Returns

`object`

### id

> **id**: `string` = `identifier`

### meanPrecision

> **meanPrecision**: `number`

### percentPrecision

> **percentPrecision**: `number`

### populationAliases

> **populationAliases**: `object`[]

### populationSuit

> **populationSuit**: `"SCREENED"` \| `"ITT"` \| `"SAFETY"` \| `"PER_PROTOCOL"` \| `"FAS"` = `PopulationTypeSchema`

### roundingMode

> **roundingMode**: `"HALF_EVEN"` \| `"HALF_AWAY_FROM_ZERO"` \| `"TRUNCATE"` = `RoundingModeSchema`

### rules

> **rules**: `object`[]

### title

> **title**: `string`
