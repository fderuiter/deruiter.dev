[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/trial-and-error/types](../README.md) / shopEntryId

# Function: shopEntryId()

> **shopEntryId**(`entry`): `string`

A shop entry's id: the id of the relic, Guidance card or seal it sells.

## Parameters

### entry

\{ `kind`: `"RELIC"`; `price`: `number`; `relic`: \{ `description`: `string`; `id`: `string`; `modifier`: \{ `chips`: `number`; `label`: `string`; `plusMult`: `number`; `sourceId`: `string`; `xMult`: `number`; \}; `name`: `string`; `rarity?`: `"COMMON"` \| `"UNCOMMON"` \| `"RARE"`; `trigger?`: \{ `phase`: `"ON_HAND_PLAYED"`; `requires?`: `"FIGURE_IN_HAND"` \| `"NO_REDLINES"`; `scale?`: `"STALE_IN_HAND"` \| `"REDLINES_FIXED"` \| `"HANDS_PLAYED"`; \} \| \{ `cardType?`: `"TABLE"` \| `"LISTING"` \| `"FIGURE"` \| `"SUBJECT_TOKEN"`; `phase`: `"ON_CARD_SCORED"`; `population?`: `"SCREENED"` \| `"ITT"` \| `"SAFETY"` \| `"PER_PROTOCOL"` \| `"FAS"`; `qcPassedOnly?`: `boolean`; `retrigger?`: `boolean`; \} \| \{ `freeDiscards?`: `number`; `phase`: `"ON_DISCARD"`; `stacks?`: `boolean`; \} \| \{ `cpu`: `number`; `cpuPerAct?`: `number`; `phase`: `"ON_BLIND_START"`; \}; \}; \} \| \{ `guidance`: \{ `document`: `string`; `flavor`: `string`; `handType`: `"HIGH_TABLE"` \| `"TLF_PAIR"` \| `"TLF_TWO_PAIR"` \| `"POPULATION_FLUSH"` \| `"CSR_STRAIGHT"` \| `"EFFICACY_FULL_HOUSE"` \| `"MEDDRA_FIVE_OF_A_KIND"`; `id`: `string`; `name`: `string`; `sellValue`: `number`; \}; `kind`: `"GUIDANCE"`; `price`: `number`; \} \| \{ `kind`: `"SEAL"`; `price`: `number`; `seal`: \{ `effect`: \{ `kind`: `"PLUS_CHIPS"`; `value`: `number`; \} \| \{ `kind`: `"PLUS_MULT"`; `value`: `number`; \} \| \{ `kind`: `"WAIVE"`; \}; `eligible`: \{ `cardTypes?`: (`"TABLE"` \| `"LISTING"` \| `"FIGURE"` \| `"SUBJECT_TOKEN"`)[]; `populations?`: (`"SCREENED"` \| `"ITT"` \| `"SAFETY"` \| `"PER_PROTOCOL"` \| `"FAS"`)[]; `topics?`: `string`[]; \}; `footnote`: `string`; `id`: `string`; `name`: `string`; `sellValue`: `number`; \}; \} \| \{ `amendment`: \{ `bonusDelta`: `number`; `category`: `"PRECISION"` \| `"ROUNDING"` \| `"VALUE"`; `code`: `string`; `description`: `string`; `id`: `string`; `name`: `string`; `penaltyDelta`: `number`; `sellValue`: `number`; \}; `kind`: `"AMENDMENT"`; `price`: `number`; \} \| \{ `card`: \{ `csrStage?`: `"BASELINE"` \| `"DISPOSITION"` \| `"EFFICACY"` \| `"SAFETY_AE"` \| `"PATIENT_LISTING"`; `soc?`: `string`; `title`: `string`; `topic`: `string`; \}; `kind`: `"SHELL"`; `price`: `number`; `shell`: \{ `allowedFootnoteSlots`: `number`; `cardType`: `"TABLE"` \| `"LISTING"` \| `"FIGURE"` \| `"SUBJECT_TOKEN"`; `chips`: `number`; `compatiblePopulations?`: (`"SCREENED"` \| `"ITT"` \| `"SAFETY"` \| `"PER_PROTOCOL"` \| `"FAS"`)[]; `id`: `string`; `isBlinded?`: `boolean`; `layout?`: \{ `columns`: `object`[]; `rows`: `object`[]; \}; `mult`: `number`; `requiredRulebookId`: `string`; `tableNumber`: `string`; `targetPopulation`: `"SCREENED"` \| `"ITT"` \| `"SAFETY"` \| `"PER_PROTOCOL"` \| `"FAS"`; `title`: `string`; \}; \}

#### Type Literal

\{ `card`: \{ `csrStage?`: `"BASELINE"` \| `"DISPOSITION"` \| `"EFFICACY"` \| `"SAFETY_AE"` \| `"PATIENT_LISTING"`; `soc?`: `string`; `title`: `string`; `topic`: `string`; \}; `kind`: `"SHELL"`; `price`: `number`; `shell`: \{ `allowedFootnoteSlots`: `number`; `cardType`: `"TABLE"` \| `"LISTING"` \| `"FIGURE"` \| `"SUBJECT_TOKEN"`; `chips`: `number`; `compatiblePopulations?`: (`"SCREENED"` \| `"ITT"` \| `"SAFETY"` \| `"PER_PROTOCOL"` \| `"FAS"`)[]; `id`: `string`; `isBlinded?`: `boolean`; `layout?`: \{ `columns`: `object`[]; `rows`: `object`[]; \}; `mult`: `number`; `requiredRulebookId`: `string`; `tableNumber`: `string`; `targetPopulation`: `"SCREENED"` \| `"ITT"` \| `"SAFETY"` \| `"PER_PROTOCOL"` \| `"FAS"`; `title`: `string`; \}; \}

##### card

\{ `csrStage?`: `"BASELINE"` \| `"DISPOSITION"` \| `"EFFICACY"` \| `"SAFETY_AE"` \| `"PATIENT_LISTING"`; `soc?`: `string`; `title`: `string`; `topic`: `string`; \} = `...`

The card's printed title and the fields hands read.

##### card.csrStage?

`"BASELINE"` \| `"DISPOSITION"` \| `"EFFICACY"` \| `"SAFETY_AE"` \| `"PATIENT_LISTING"` = `...`

##### card.soc?

`string` = `...`

##### card.title

`string` = `...`

##### card.topic

`string` = `identifier`

##### kind

`"SHELL"` = `...`

##### price

`number` = `...`

##### shell

\{ `allowedFootnoteSlots`: `number`; `cardType`: `"TABLE"` \| `"LISTING"` \| `"FIGURE"` \| `"SUBJECT_TOKEN"`; `chips`: `number`; `compatiblePopulations?`: (`"SCREENED"` \| `"ITT"` \| `"SAFETY"` \| `"PER_PROTOCOL"` \| `"FAS"`)[]; `id`: `string`; `isBlinded?`: `boolean`; `layout?`: \{ `columns`: `object`[]; `rows`: `object`[]; \}; `mult`: `number`; `requiredRulebookId`: `string`; `tableNumber`: `string`; `targetPopulation`: `"SCREENED"` \| `"ITT"` \| `"SAFETY"` \| `"PER_PROTOCOL"` \| `"FAS"`; `title`: `string`; \} = `TableShellSpecSchema`

The shell the card compiles from: a Table with a layout.

##### shell.allowedFootnoteSlots

`number` = `nonNegativeInt`

##### shell.cardType

`"TABLE"` \| `"LISTING"` \| `"FIGURE"` \| `"SUBJECT_TOKEN"` = `CardTypeSchema`

##### shell.chips

`number` = `nonNegativeInt`

##### shell.compatiblePopulations?

(`"SCREENED"` \| `"ITT"` \| `"SAFETY"` \| `"PER_PROTOCOL"` \| `"FAS"`)[] = `...`

##### shell.id

`string` = `identifier`

##### shell.isBlinded?

`boolean` = `...`

A closed-session output: face down, and absent from the derived view,
until the scenario's DMC convenes the closed session.

##### shell.layout?

\{ `columns`: `object`[]; `rows`: `object`[]; \} = `...`

##### shell.layout.columns

`object`[] = `...`

##### shell.layout.rows

`object`[] = `...`

##### shell.mult

`number` = `nonNegativeInt`

##### shell.requiredRulebookId

`string` = `identifier`

##### shell.tableNumber

`string` = `...`

##### shell.targetPopulation

`"SCREENED"` \| `"ITT"` \| `"SAFETY"` \| `"PER_PROTOCOL"` \| `"FAS"` = `PopulationTypeSchema`

##### shell.title

`string` = `...`

## Returns

`string`
