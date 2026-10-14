[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/trial-and-error/internal/shop](../README.md) / stockPool

# Function: stockPool()

> **stockPool**(`catalog`, `rulebook`, `ownedRelicIds`, `ownedAmendmentIds?`): (\{ `kind`: `"RELIC"`; `price`: `number`; `relic`: \{ `description`: `string`; `id`: `string`; `modifier`: \{ `chips`: `number`; `label`: `string`; `plusMult`: `number`; `sourceId`: `string`; `xMult`: `number`; \}; `name`: `string`; `rarity?`: `"COMMON"` \| `"UNCOMMON"` \| `"RARE"`; `trigger?`: \{ `phase`: `"ON_HAND_PLAYED"`; `requires?`: `"FIGURE_IN_HAND"` \| `"NO_REDLINES"`; `scale?`: `"STALE_IN_HAND"` \| `"REDLINES_FIXED"` \| `"HANDS_PLAYED"`; \} \| \{ `cardType?`: `"TABLE"` \| `"LISTING"` \| `"FIGURE"` \| `"SUBJECT_TOKEN"`; `phase`: `"ON_CARD_SCORED"`; `population?`: `"SCREENED"` \| `"ITT"` \| `"SAFETY"` \| `"PER_PROTOCOL"` \| `"FAS"`; `qcPassedOnly?`: `boolean`; `retrigger?`: `boolean`; \} \| \{ `freeDiscards?`: `number`; `phase`: `"ON_DISCARD"`; `stacks?`: `boolean`; \} \| \{ `cpu`: `number`; `cpuPerAct?`: `number`; `phase`: `"ON_BLIND_START"`; \}; \}; \} \| \{ `guidance`: \{ `document`: `string`; `flavor`: `string`; `handType`: `"HIGH_TABLE"` \| `"TLF_PAIR"` \| `"TLF_TWO_PAIR"` \| `"POPULATION_FLUSH"` \| `"CSR_STRAIGHT"` \| `"EFFICACY_FULL_HOUSE"` \| `"MEDDRA_FIVE_OF_A_KIND"`; `id`: `string`; `name`: `string`; `sellValue`: `number`; \}; `kind`: `"GUIDANCE"`; `price`: `number`; \} \| \{ `kind`: `"SEAL"`; `price`: `number`; `seal`: \{ `effect`: \{ `kind`: `"PLUS_CHIPS"`; `value`: `number`; \} \| \{ `kind`: `"PLUS_MULT"`; `value`: `number`; \} \| \{ `kind`: `"WAIVE"`; \}; `eligible`: \{ `cardTypes?`: (`"TABLE"` \| `"LISTING"` \| `"FIGURE"` \| `"SUBJECT_TOKEN"`)[]; `populations?`: (`"SCREENED"` \| `"ITT"` \| `"SAFETY"` \| `"PER_PROTOCOL"` \| `"FAS"`)[]; `topics?`: `string`[]; \}; `footnote`: `string`; `id`: `string`; `name`: `string`; `sellValue`: `number`; \}; \} \| \{ `amendment`: \{ `bonusDelta`: `number`; `category`: `"PRECISION"` \| `"ROUNDING"` \| `"VALUE"`; `code`: `string`; `description`: `string`; `id`: `string`; `name`: `string`; `penaltyDelta`: `number`; `sellValue`: `number`; \}; `kind`: `"AMENDMENT"`; `price`: `number`; \} \| \{ `card`: \{ `csrStage?`: `"BASELINE"` \| `"DISPOSITION"` \| `"EFFICACY"` \| `"SAFETY_AE"` \| `"PATIENT_LISTING"`; `soc?`: `string`; `title`: `string`; `topic`: `string`; \}; `kind`: `"SHELL"`; `price`: `number`; `shell`: \{ `allowedFootnoteSlots`: `number`; `cardType`: `"TABLE"` \| `"LISTING"` \| `"FIGURE"` \| `"SUBJECT_TOKEN"`; `chips`: `number`; `compatiblePopulations?`: (`"SCREENED"` \| `"ITT"` \| `"SAFETY"` \| `"PER_PROTOCOL"` \| `"FAS"`)[]; `id`: `string`; `isBlinded?`: `boolean`; `layout?`: \{ `columns`: `object`[]; `rows`: `object`[]; \}; `mult`: `number`; `requiredRulebookId`: `string`; `tableNumber`: `string`; `targetPopulation`: `"SCREENED"` \| `"ITT"` \| `"SAFETY"` \| `"PER_PROTOCOL"` \| `"FAS"`; `title`: `string`; \}; \})[]

The single-slot stock that fits the rulebook and is not already owned:
relics in the rack, and amendments in force or waiting in the tray.

## Parameters

### catalog

#### entries

(\{ `kind`: `"RELIC"`; `price`: `number`; `relic`: \{ `description`: `string`; `id`: `string`; `modifier`: \{ `chips`: `number`; `label`: `string`; `plusMult`: `number`; `sourceId`: `string`; `xMult`: `number`; \}; `name`: `string`; `rarity?`: `"COMMON"` \| `"UNCOMMON"` \| `"RARE"`; `trigger?`: \{ `phase`: `"ON_HAND_PLAYED"`; `requires?`: `"FIGURE_IN_HAND"` \| `"NO_REDLINES"`; `scale?`: `"STALE_IN_HAND"` \| `"REDLINES_FIXED"` \| `"HANDS_PLAYED"`; \} \| \{ `cardType?`: `"TABLE"` \| `"LISTING"` \| `"FIGURE"` \| `"SUBJECT_TOKEN"`; `phase`: `"ON_CARD_SCORED"`; `population?`: `"SCREENED"` \| `"ITT"` \| `"SAFETY"` \| `"PER_PROTOCOL"` \| `"FAS"`; `qcPassedOnly?`: `boolean`; `retrigger?`: `boolean`; \} \| \{ `freeDiscards?`: `number`; `phase`: `"ON_DISCARD"`; `stacks?`: `boolean`; \} \| \{ `cpu`: `number`; `cpuPerAct?`: `number`; `phase`: `"ON_BLIND_START"`; \}; \}; \} \| \{ `guidance`: \{ `document`: `string`; `flavor`: `string`; `handType`: `"HIGH_TABLE"` \| `"TLF_PAIR"` \| `"TLF_TWO_PAIR"` \| `"POPULATION_FLUSH"` \| `"CSR_STRAIGHT"` \| `"EFFICACY_FULL_HOUSE"` \| `"MEDDRA_FIVE_OF_A_KIND"`; `id`: `string`; `name`: `string`; `sellValue`: `number`; \}; `kind`: `"GUIDANCE"`; `price`: `number`; \} \| \{ `kind`: `"SEAL"`; `price`: `number`; `seal`: \{ `effect`: \{ `kind`: `"PLUS_CHIPS"`; `value`: `number`; \} \| \{ `kind`: `"PLUS_MULT"`; `value`: `number`; \} \| \{ `kind`: `"WAIVE"`; \}; `eligible`: \{ `cardTypes?`: (`"TABLE"` \| `"LISTING"` \| `"FIGURE"` \| `"SUBJECT_TOKEN"`)[]; `populations?`: (`"SCREENED"` \| `"ITT"` \| `"SAFETY"` \| `"PER_PROTOCOL"` \| `"FAS"`)[]; `topics?`: `string`[]; \}; `footnote`: `string`; `id`: `string`; `name`: `string`; `sellValue`: `number`; \}; \} \| \{ `amendment`: \{ `bonusDelta`: `number`; `category`: `"PRECISION"` \| `"ROUNDING"` \| `"VALUE"`; `code`: `string`; `description`: `string`; `id`: `string`; `name`: `string`; `penaltyDelta`: `number`; `sellValue`: `number`; \}; `kind`: `"AMENDMENT"`; `price`: `number`; \} \| \{ `card`: \{ `csrStage?`: `"BASELINE"` \| `"DISPOSITION"` \| `"EFFICACY"` \| `"SAFETY_AE"` \| `"PATIENT_LISTING"`; `soc?`: `string`; `title`: `string`; `topic`: `string`; \}; `kind`: `"SHELL"`; `price`: `number`; `shell`: \{ `allowedFootnoteSlots`: `number`; `cardType`: `"TABLE"` \| `"LISTING"` \| `"FIGURE"` \| `"SUBJECT_TOKEN"`; `chips`: `number`; `compatiblePopulations?`: (`"SCREENED"` \| `"ITT"` \| `"SAFETY"` \| `"PER_PROTOCOL"` \| `"FAS"`)[]; `id`: `string`; `isBlinded?`: `boolean`; `layout?`: \{ `columns`: `object`[]; `rows`: `object`[]; \}; `mult`: `number`; `requiredRulebookId`: `string`; `tableNumber`: `string`; `targetPopulation`: `"SCREENED"` \| `"ITT"` \| `"SAFETY"` \| `"PER_PROTOCOL"` \| `"FAS"`; `title`: `string`; \}; \})[] = `...`

#### packs

`object`[] = `...`

#### sites

`object`[] = `...`

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

### ownedRelicIds

readonly `string`[]

### ownedAmendmentIds?

readonly `string`[] = `[]`

## Returns
