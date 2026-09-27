[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/trial-and-error/internal/amendments](../README.md) / amendedRule

# Function: amendedRule()

> **amendedRule**(`rulebook`, `amendment`): \{ `category`: `"DENOMINATOR"` \| `"PRECISION"` \| `"ROUNDING"` \| `"VALUE"`; `consequence`: `string`; `correctionMultBonus`: `number`; `id`: `string`; `redlineMultPenalty`: `number`; `severity`: `"FATAL"` \| `"MAJOR"` \| `"MINOR"`; `statement`: `string`; `waivableBy?`: `string`[]; \} \| `null`

The rule an amendment changes in a rulebook: its category's, never a fatal one.

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

### amendment

#### bonusDelta

`number` = `...`

+Mult added to a correction against the amended rule.

#### category

`"PRECISION"` \| `"ROUNDING"` \| `"VALUE"` = `...`

The rule category it amends. Fatal rules are never amended.

#### code

`string` = `...`

The suffix the amended rulebook's id takes, e.g. "AR".

#### description

`string` = `...`

#### id

`string` = `identifier`

#### name

`string` = `...`

The short name printed on the card.

#### penaltyDelta

`number` = `...`

+Mult added to what a standing redline against it costs.

#### sellValue

`number` = `nonNegativeInt`

What selling it adds to the study budget.

## Returns

### Type Literal

\{ `category`: `"DENOMINATOR"` \| `"PRECISION"` \| `"ROUNDING"` \| `"VALUE"`; `consequence`: `string`; `correctionMultBonus`: `number`; `id`: `string`; `redlineMultPenalty`: `number`; `severity`: `"FATAL"` \| `"MAJOR"` \| `"MINOR"`; `statement`: `string`; `waivableBy?`: `string`[]; \}

#### category

> **category**: `"DENOMINATOR"` \| `"PRECISION"` \| `"ROUNDING"` \| `"VALUE"` = `QcCategorySchema`

#### consequence

> **consequence**: `string`

#### correctionMultBonus

> **correctionMultBonus**: `number` = `nonNegativeInt`

+Mult earned when a discrepancy against this rule is corrected.

#### id

> **id**: `string` = `identifier`

#### redlineMultPenalty

> **redlineMultPenalty**: `number` = `nonNegativeInt`

+Mult lost (as a positive number) while a non-fatal discrepancy stands.

#### severity

> **severity**: `"FATAL"` \| `"MAJOR"` \| `"MINOR"` = `QcSeveritySchema`

#### statement

> **statement**: `string`

#### waivableBy?

> `optional` **waivableBy?**: `string`[]

Footnote seals the SAP accepts as a documented exception to this rule.
Only a rule that names a seal here can be waived by it, and a fatal rule
never can.

***

`null`
