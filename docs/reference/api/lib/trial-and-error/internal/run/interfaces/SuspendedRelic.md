[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/trial-and-error/internal/run](../README.md) / SuspendedRelic

# Interface: SuspendedRelic

A relic Form 483 took out of play with its slot (#950), until the act ends.

## Properties

### relic

> **relic**: `object`

#### description

> **description**: `string`

#### id

> **id**: `string` = `identifier`

#### modifier

> **modifier**: `object` = `ScoreModifierSchema`

##### modifier.chips

> **chips**: `number`

##### modifier.label

> **label**: `string`

##### modifier.plusMult

> **plusMult**: `number`

##### modifier.sourceId

> **sourceId**: `string` = `identifier`

##### modifier.xMult

> **xMult**: `number`

#### name

> **name**: `string`

#### trigger?

> `optional` **trigger?**: \{ `phase`: `"ON_HAND_PLAYED"`; `requires?`: `"FIGURE_IN_HAND"` \| `"NO_REDLINES"`; \} \| \{ `cardType?`: `"TABLE"` \| `"LISTING"` \| `"FIGURE"` \| `"SUBJECT_TOKEN"`; `phase`: `"ON_CARD_SCORED"`; `population?`: `"SCREENED"` \| `"ITT"` \| `"SAFETY"` \| `"PER_PROTOCOL"` \| `"FAS"`; `qcPassedOnly?`: `boolean`; `retrigger?`: `boolean`; \} \| \{ `freeDiscards`: `number`; `phase`: `"ON_DISCARD"`; \} \| \{ `cpu`: `number`; `phase`: `"ON_BLIND_START"`; \}

##### Union Members

###### Type Literal

\{ `phase`: `"ON_HAND_PLAYED"`; `requires?`: `"FIGURE_IN_HAND"` \| `"NO_REDLINES"`; \}

***

###### Type Literal

\{ `cardType?`: `"TABLE"` \| `"LISTING"` \| `"FIGURE"` \| `"SUBJECT_TOKEN"`; `phase`: `"ON_CARD_SCORED"`; `population?`: `"SCREENED"` \| `"ITT"` \| `"SAFETY"` \| `"PER_PROTOCOL"` \| `"FAS"`; `qcPassedOnly?`: `boolean`; `retrigger?`: `boolean`; \}

###### cardType?

> `optional` **cardType?**: `"TABLE"` \| `"LISTING"` \| `"FIGURE"` \| `"SUBJECT_TOKEN"`

###### phase

> **phase**: `"ON_CARD_SCORED"`

###### population?

> `optional` **population?**: `"SCREENED"` \| `"ITT"` \| `"SAFETY"` \| `"PER_PROTOCOL"` \| `"FAS"`

###### qcPassedOnly?

> `optional` **qcPassedOnly?**: `boolean`

Only cards stamped QC ✓: every cell reviewed, no open redline.

###### retrigger?

> `optional` **retrigger?**: `boolean`

***

###### Type Literal

\{ `freeDiscards`: `number`; `phase`: `"ON_DISCARD"`; \}

***

###### Type Literal

\{ `cpu`: `number`; `phase`: `"ON_BLIND_START"`; \}

***

### slot

> **slot**: `number`

The locked slot it held, from 0; it returns there.
