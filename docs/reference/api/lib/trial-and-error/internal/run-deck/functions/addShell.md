[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/trial-and-error/internal/run-deck](../README.md) / addShell

# Function: addShell()

> **addShell**(`deck`, `entry`, `id`): [`RunDeck`](../interfaces/RunDeck.md)

The deck with a bought shell added under `id`.

## Parameters

### deck

[`RunDeck`](../interfaces/RunDeck.md)

### entry

#### card

\{ `csrStage?`: `"BASELINE"` \| `"DISPOSITION"` \| `"EFFICACY"` \| `"SAFETY_AE"` \| `"PATIENT_LISTING"`; `soc?`: `string`; `title`: `string`; `topic`: `string`; \} = `...`

The card's printed title and the fields hands read.

#### card.csrStage?

`"BASELINE"` \| `"DISPOSITION"` \| `"EFFICACY"` \| `"SAFETY_AE"` \| `"PATIENT_LISTING"` = `...`

#### card.soc?

`string` = `...`

#### card.title

`string` = `...`

#### card.topic

`string` = `identifier`

#### kind

`"SHELL"` = `...`

#### price

`number` = `...`

#### shell

\{ `allowedFootnoteSlots`: `number`; `cardType`: `"TABLE"` \| `"LISTING"` \| `"FIGURE"` \| `"SUBJECT_TOKEN"`; `chips`: `number`; `compatiblePopulations?`: (`"SCREENED"` \| `"ITT"` \| `"SAFETY"` \| `"PER_PROTOCOL"` \| `"FAS"`)[]; `id`: `string`; `isBlinded?`: `boolean`; `layout?`: \{ `columns`: `object`[]; `rows`: `object`[]; \}; `mult`: `number`; `requiredRulebookId`: `string`; `tableNumber`: `string`; `targetPopulation`: `"SCREENED"` \| `"ITT"` \| `"SAFETY"` \| `"PER_PROTOCOL"` \| `"FAS"`; `title`: `string`; \} = `TableShellSpecSchema`

The shell the card compiles from: a Table with a layout.

#### shell.allowedFootnoteSlots

`number` = `nonNegativeInt`

#### shell.cardType

`"TABLE"` \| `"LISTING"` \| `"FIGURE"` \| `"SUBJECT_TOKEN"` = `CardTypeSchema`

#### shell.chips

`number` = `nonNegativeInt`

#### shell.compatiblePopulations?

(`"SCREENED"` \| `"ITT"` \| `"SAFETY"` \| `"PER_PROTOCOL"` \| `"FAS"`)[] = `...`

#### shell.id

`string` = `identifier`

#### shell.isBlinded?

`boolean` = `...`

A closed-session output: face down, and absent from the derived view,
until the scenario's DMC convenes the closed session.

#### shell.layout?

\{ `columns`: `object`[]; `rows`: `object`[]; \} = `...`

#### shell.layout.columns

`object`[] = `...`

#### shell.layout.rows

`object`[] = `...`

#### shell.mult

`number` = `nonNegativeInt`

#### shell.requiredRulebookId

`string` = `identifier`

#### shell.tableNumber

`string` = `...`

#### shell.targetPopulation

`"SCREENED"` \| `"ITT"` \| `"SAFETY"` \| `"PER_PROTOCOL"` \| `"FAS"` = `PopulationTypeSchema`

#### shell.title

`string` = `...`

### id

`string`

## Returns

[`RunDeck`](../interfaces/RunDeck.md)
