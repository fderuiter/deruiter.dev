[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/trial-and-error/internal/run](../README.md) / endlessAct

# Function: endlessAct()

> **endlessAct**(`endless`, `bossId`, `round`): `object`

Round `round`'s post-marketing study: the study whose pool holds the
drawn Boss, with every quota raised by quotaGrowth ^ round.

## Parameters

### endless

#### id

`string` = `identifier`

#### quotaGrowth

`number` = `...`

Each round's quotas: authored quota × quotaGrowth ^ round.

#### studies

`object`[] = `...`

The post-marketing studies a round can be; each has a boss pool.

#### title

`string` = `...`

### bossId

`string` \| `null`

### round

`number`

## Returns

### blinds

> **blinds**: `object`[]

### bossPool?

> `optional` **bossPool?**: `object`[]

### crisisDeck?

> `optional` **crisisDeck?**: `object`[]

### deviations?

> `optional` **deviations?**: `object`

Protocol deviations (#1087): as each Small or Big Blind starts, the
run's draw fires one with `chancePercent` odds, drawn from `deck`
without replacement across the run.

#### deviations.chancePercent

> **chancePercent**: `number`

#### deviations.deck

> **deck**: `object`[]

### id

> **id**: `string` = `identifier`

### shop?

> `optional` **shop?**: `object`

The Procurement Shop between Blinds. Without it there is no shop.

#### shop.entries

> **entries**: (\{ `kind`: `"RELIC"`; `price`: `number`; `relic`: \{ `description`: `string`; `id`: `string`; `modifier`: \{ `chips`: `number`; `label`: `string`; `plusMult`: `number`; `sourceId`: `string`; `xMult`: `number`; \}; `name`: `string`; `trigger?`: \{ `phase`: `"ON_HAND_PLAYED"`; `requires?`: `"FIGURE_IN_HAND"` \| `"NO_REDLINES"`; \} \| \{ `cardType?`: `"TABLE"` \| `"LISTING"` \| `"FIGURE"` \| `"SUBJECT_TOKEN"`; `phase`: `"ON_CARD_SCORED"`; `population?`: `"SCREENED"` \| `"ITT"` \| `"SAFETY"` \| `"PER_PROTOCOL"` \| `"FAS"`; `qcPassedOnly?`: `boolean`; `retrigger?`: `boolean`; \} \| \{ `freeDiscards`: `number`; `phase`: `"ON_DISCARD"`; \} \| \{ `cpu`: `number`; `phase`: `"ON_BLIND_START"`; \}; \}; \} \| \{ `guidance`: \{ `document`: `string`; `flavor`: `string`; `handType`: `"HIGH_TABLE"` \| `"TLF_PAIR"` \| `"TLF_TWO_PAIR"` \| `"POPULATION_FLUSH"` \| `"CSR_STRAIGHT"` \| `"EFFICACY_FULL_HOUSE"` \| `"MEDDRA_FIVE_OF_A_KIND"`; `id`: `string`; `name`: `string`; `sellValue`: `number`; \}; `kind`: `"GUIDANCE"`; `price`: `number`; \} \| \{ `kind`: `"SEAL"`; `price`: `number`; `seal`: \{ `effect`: \{ `kind`: `"PLUS_CHIPS"`; `value`: `number`; \} \| \{ `kind`: `"PLUS_MULT"`; `value`: `number`; \} \| \{ `kind`: `"WAIVE"`; \}; `eligible`: \{ `cardTypes?`: (... \| ... \| ... \| ...)[]; `populations?`: (... \| ... \| ... \| ... \| ...)[]; `topics?`: `string`[]; \}; `footnote`: `string`; `id`: `string`; `name`: `string`; `sellValue`: `number`; \}; \} \| \{ `amendment`: \{ `bonusDelta`: `number`; `category`: `"PRECISION"` \| `"ROUNDING"` \| `"VALUE"`; `code`: `string`; `description`: `string`; `id`: `string`; `name`: `string`; `penaltyDelta`: `number`; `sellValue`: `number`; \}; `kind`: `"AMENDMENT"`; `price`: `number`; \})[]

#### shop.packs

> **packs**: `object`[]

#### shop.sites

> **sites**: `object`[]

### title

> **title**: `string`
