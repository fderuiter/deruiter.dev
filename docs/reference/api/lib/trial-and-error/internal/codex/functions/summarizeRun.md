[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/trial-and-error/internal/codex](../README.md) / summarizeRun

# Function: summarizeRun()

> **summarizeRun**(`plan`, `log`, `endedOn?`): \{ `actId`: `string`; `bestHand`: \{ `handType`: `"HIGH_TABLE"` \| `"TLF_PAIR"` \| `"TLF_TWO_PAIR"` \| `"POPULATION_FLUSH"` \| `"CSR_STRAIGHT"` \| `"EFFICACY_FULL_HOUSE"` \| `"MEDDRA_FIVE_OF_A_KIND"`; `score`: `number`; \} \| `null`; `campaignWon`: `boolean`; `endedOn?`: `string`; `moves`: `number`; `origin?`: \{ `kind`: `"RANDOM"`; \} \| \{ `kind`: `"SEEDED"`; \} \| \{ `date`: `string`; `kind`: `"DAILY"`; \}; `reached`: \{ `actIndex`: `number`; `actTitle`: `string`; `blindIndex`: `number`; `blindTitle`: `string`; `round`: `number` \| `null`; \}; `result`: `"FAILED"` \| `"WON"`; `seed`: `string`; `sponsorId?`: `"VIRTUAL_BIOTECH"` \| `"ONCOLOGY_PHARMA"` \| `"CARDIO_MEGA_TRIAL"` \| `"RARE_DISEASE_BIOTECH"`; `stake?`: `number`; \} \| `null`

The history entry for a finished run, replayed from its log, or null when
the run has not ended: a won campaign still offering post-marketing waits
on the player. `endedOn` is the UTC date, which the adapter supplies.

## Parameters

### plan

[`RunPlan`](../../run/type-aliases/RunPlan.md)

### log

[`RunLog`](../../save/interfaces/RunLog.md)

### endedOn?

`string`

## Returns

### Type Literal

\{ `actId`: `string`; `bestHand`: \{ `handType`: `"HIGH_TABLE"` \| `"TLF_PAIR"` \| `"TLF_TWO_PAIR"` \| `"POPULATION_FLUSH"` \| `"CSR_STRAIGHT"` \| `"EFFICACY_FULL_HOUSE"` \| `"MEDDRA_FIVE_OF_A_KIND"`; `score`: `number`; \} \| `null`; `campaignWon`: `boolean`; `endedOn?`: `string`; `moves`: `number`; `origin?`: \{ `kind`: `"RANDOM"`; \} \| \{ `kind`: `"SEEDED"`; \} \| \{ `date`: `string`; `kind`: `"DAILY"`; \}; `reached`: \{ `actIndex`: `number`; `actTitle`: `string`; `blindIndex`: `number`; `blindTitle`: `string`; `round`: `number` \| `null`; \}; `result`: `"FAILED"` \| `"WON"`; `seed`: `string`; `sponsorId?`: `"VIRTUAL_BIOTECH"` \| `"ONCOLOGY_PHARMA"` \| `"CARDIO_MEGA_TRIAL"` \| `"RARE_DISEASE_BIOTECH"`; `stake?`: `number`; \}

#### actId

> **actId**: `string` = `codexId`

#### bestHand

> **bestHand**: \{ `handType`: `"HIGH_TABLE"` \| `"TLF_PAIR"` \| `"TLF_TWO_PAIR"` \| `"POPULATION_FLUSH"` \| `"CSR_STRAIGHT"` \| `"EFFICACY_FULL_HOUSE"` \| `"MEDDRA_FIVE_OF_A_KIND"`; `score`: `number`; \} \| `null`

The run's highest-scoring hand, or null when none was played.

#### campaignWon

> **campaignWon**: `boolean`

The campaign was won, even if post-marketing rounds then failed.

#### endedOn?

> `optional` **endedOn?**: `string`

The UTC date the run ended, when the adapter knows it.

#### moves

> **moves**: `number` = `count`

Moves the run took.

#### origin?

> `optional` **origin?**: \{ `kind`: `"RANDOM"`; \} \| \{ `kind`: `"SEEDED"`; \} \| \{ `date`: `string`; `kind`: `"DAILY"`; \}

#### reached

> **reached**: `object`

How far the run got: the act and Blind it ended on.

##### reached.actIndex

> **actIndex**: `number` = `count`

##### reached.actTitle

> **actTitle**: `string`

##### reached.blindIndex

> **blindIndex**: `number` = `count`

##### reached.blindTitle

> **blindTitle**: `string`

##### reached.round

> **round**: `number` \| `null`

The post-marketing round it ended in, or null for a campaign act.

#### result

> **result**: `"FAILED"` \| `"WON"`

WON: the plan's last Blind cleared and the run submitted.

#### seed

> **seed**: `string` = `runSeed`

#### sponsorId?

> `optional` **sponsorId?**: `"VIRTUAL_BIOTECH"` \| `"ONCOLOGY_PHARMA"` \| `"CARDIO_MEGA_TRIAL"` \| `"RARE_DISEASE_BIOTECH"`

#### stake?

> `optional` **stake?**: `number`

***

`null`
