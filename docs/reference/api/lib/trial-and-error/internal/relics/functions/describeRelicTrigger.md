[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/trial-and-error/internal/relics](../README.md) / describeRelicTrigger

# Function: describeRelicTrigger()

> **describeRelicTrigger**(`relic`): `string`

A relic's trigger in one plain sentence, for the Codex (#2083): when it
fires, on what, and what it scales with.

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

#### rarity?

`"COMMON"` \| `"UNCOMMON"` \| `"RARE"` = `...`

#### trigger?

\{ `phase`: `"ON_HAND_PLAYED"`; `requires?`: `"FIGURE_IN_HAND"` \| `"NO_REDLINES"`; `scale?`: `"STALE_IN_HAND"` \| `"REDLINES_FIXED"` \| `"HANDS_PLAYED"`; \} \| \{ `cardType?`: `"TABLE"` \| `"LISTING"` \| `"FIGURE"` \| `"SUBJECT_TOKEN"`; `phase`: `"ON_CARD_SCORED"`; `population?`: `"SCREENED"` \| `"ITT"` \| `"SAFETY"` \| `"PER_PROTOCOL"` \| `"FAS"`; `qcPassedOnly?`: `boolean`; `retrigger?`: `boolean`; \} \| \{ `freeDiscards?`: `number`; `phase`: `"ON_DISCARD"`; `stacks?`: `boolean`; \} \| \{ `cpu`: `number`; `cpuPerAct?`: `number`; `phase`: `"ON_BLIND_START"`; \} = `...`

## Returns

`string`
