[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/trial-and-error/internal/relics](../README.md) / relicPhase

# Function: relicPhase()

> **relicPhase**(`relic`): `"ON_HAND_PLAYED"` \| `"ON_CARD_SCORED"` \| `"ON_DISCARD"` \| `"ON_BLIND_START"`

A relic's phase: its trigger's, or ON_HAND_PLAYED without one.

## Parameters

### relic

#### description

`string` = `...`

#### id

`string` = `identifier`

#### modifier

\{ `chips`: `number`; `label`: `string`; `plusMult`: `number`; `sourceId`: `string`; `xMult`: `number`; \} = `ScoreModifierSchema`

#### modifier.chips

`number` = `...`

#### modifier.label

`string` = `...`

#### modifier.plusMult

`number` = `...`

#### modifier.sourceId

`string` = `identifier`

#### modifier.xMult

`number` = `...`

#### name

`string` = `...`

#### trigger?

\{ `phase`: `"ON_HAND_PLAYED"`; `requires?`: `"FIGURE_IN_HAND"` \| `"NO_REDLINES"`; \} \| \{ `cardType?`: `"TABLE"` \| `"LISTING"` \| `"FIGURE"` \| `"SUBJECT_TOKEN"`; `phase`: `"ON_CARD_SCORED"`; `population?`: `"SCREENED"` \| `"ITT"` \| `"SAFETY"` \| `"PER_PROTOCOL"` \| `"FAS"`; `qcPassedOnly?`: `boolean`; `retrigger?`: `boolean`; \} \| \{ `freeDiscards`: `number`; `phase`: `"ON_DISCARD"`; \} \| \{ `cpu`: `number`; `phase`: `"ON_BLIND_START"`; \} = `...`

## Returns

`"ON_HAND_PLAYED"` \| `"ON_CARD_SCORED"` \| `"ON_DISCARD"` \| `"ON_BLIND_START"`
