[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/trial-and-error/internal/run-deck](../README.md) / shellCard

# Function: shellCard()

> **shellCard**(`entry`, `id`): `object`

The card a shell entry deals as, under `id`.

## Parameters

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

### cardType

> **cardType**: `"TABLE"` \| `"LISTING"` \| `"FIGURE"` \| `"SUBJECT_TOKEN"` = `CardTypeSchema`

### chips

> **chips**: `number` = `nonNegativeInt`

### csrStage?

> `optional` **csrStage?**: `"BASELINE"` \| `"DISPOSITION"` \| `"EFFICACY"` \| `"SAFETY_AE"` \| `"PATIENT_LISTING"`

### draftId?

> `optional` **draftId?**: `string`

### face?

> `optional` **face?**: \{ `columns`: `string`[]; `kind`: `"TABLE"`; `rows`: `object`[]; \} \| \{ `columns`: `string`[]; `kind`: `"LISTING"`; `rows`: `string`[][]; \} \| \{ `atRisk?`: \{ `rows`: `object`[]; `times`: `number`[]; \}; `kind`: `"FIGURE"`; `plot`: \{ `series`: `object`[]; `type`: `"KM"`; \} \| \{ `series`: `object`[]; `type`: `"SPARKLINE"`; \} \| \{ `intervals`: `object`[]; `reference`: `number`; `type`: `"FOREST"`; \}; `source?`: `string`; \} \| \{ `cohort`: `string`; `count`: `number`; `kind`: `"TOKEN"`; \}

Face data. Draft cards derive their face from the draft table instead.

#### Union Members

##### Type Literal

\{ `columns`: `string`[]; `kind`: `"TABLE"`; `rows`: `object`[]; \}

##### columns

> **columns**: `string`[]

One column for a pooled table (Total only), else the arms.

##### kind

> **kind**: `"TABLE"`

##### rows

> **rows**: `object`[]

***

##### Type Literal

\{ `columns`: `string`[]; `kind`: `"LISTING"`; `rows`: `string`[][]; \}

***

##### Type Literal

\{ `atRisk?`: \{ `rows`: `object`[]; `times`: `number`[]; \}; `kind`: `"FIGURE"`; `plot`: \{ `series`: `object`[]; `type`: `"KM"`; \} \| \{ `series`: `object`[]; `type`: `"SPARKLINE"`; \} \| \{ `intervals`: `object`[]; `reference`: `number`; `type`: `"FOREST"`; \}; `source?`: `string`; \}

##### atRisk?

> `optional` **atRisk?**: `object`

The Number-at-Risk strip under a KM plot, one row per arm.

###### atRisk.rows

> **rows**: `object`[]

###### atRisk.times

> **times**: `number`[]

##### kind

> **kind**: `"FIGURE"`

##### plot

> **plot**: \{ `series`: `object`[]; `type`: `"KM"`; \} \| \{ `series`: `object`[]; `type`: `"SPARKLINE"`; \} \| \{ `intervals`: `object`[]; `reference`: `number`; `type`: `"FOREST"`; \} = `FigurePlotSchema`

##### source?

> `optional` **source?**: `string`

The parent Table's number, printed on a dependent Figure.

***

##### Type Literal

\{ `cohort`: `string`; `count`: `number`; `kind`: `"TOKEN"`; \}

### id

> **id**: `string` = `identifier`

### km?

> `optional` **km?**: `object`

A Kaplan–Meier figure: its face is drawn from this data.

#### km.displayed

> **displayed**: `object`[]

#### km.endpoint

> **endpoint**: `string`

#### km.milestones

> **milestones**: `number`[]

Number-at-Risk milestone times, strictly increasing, from 0.

#### km.parent

> **parent**: `object`

#### km.parent.atRiskRow

> **atRiskRow**: `string` = `faceText`

#### km.parent.cardId

> **cardId**: `string` = `identifier`

#### km.parent.eventsRow

> **eventsRow**: `string` = `faceText`

#### km.populationSnapshotId

> **populationSnapshotId**: `string` = `identifier`

#### km.records

> **records**: `object`[]

#### km.timeOrigin

> **timeOrigin**: `number`

The time origin the draft's axis starts at. The SAP fixes it at 0.

#### km.timeUnit

> **timeUnit**: `string`

### mult

> **mult**: `number` = `nonNegativeInt`

### number

> **number**: `string`

### population

> **population**: `"SCREENED"` \| `"ITT"` \| `"SAFETY"` \| `"PER_PROTOCOL"` \| `"FAS"` = `PopulationTypeSchema`

### shellId?

> `optional` **shellId?**: `string`

A blank shell: a planned output with no cohort data allocated yet. It
compiles only once the player allocates one of the shell's analysis sets.

### soc?

> `optional` **soc?**: `string`

### title

> **title**: `string`

### topic

> **topic**: `string` = `identifier`
