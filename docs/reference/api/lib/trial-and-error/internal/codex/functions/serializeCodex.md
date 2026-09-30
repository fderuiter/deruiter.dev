[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/trial-and-error/internal/codex](../README.md) / serializeCodex

# Function: serializeCodex()

> **serializeCodex**(`codex`): `string`

The Codex as the string the adapter stores.

## Parameters

### codex

#### discovered

\{ `BOSS`: `Record`\<`string`, \{ `firstSeen`: \{ `actId`: `string`; `origin?`: \{ `kind`: `"RANDOM"`; \} \| \{ `kind`: `"SEEDED"`; \} \| \{ `date`: `string`; `kind`: `"DAILY"`; \}; `seed`: `string`; \}; `via`: `"BOSS"` \| `"CRISIS"` \| `"SPONSOR"` \| `"SHOP"` \| `"PACK"` \| `"TRAY"` \| `"RACK"` \| `"REWARD"` \| `"PLAYED"`; \}\>; `CRISIS`: `Record`\<`string`, \{ `firstSeen`: \{ `actId`: `string`; `origin?`: \{ `kind`: `"RANDOM"`; \} \| \{ `kind`: `"SEEDED"`; \} \| \{ `date`: `string`; `kind`: `"DAILY"`; \}; `seed`: `string`; \}; `via`: `"BOSS"` \| `"CRISIS"` \| `"SPONSOR"` \| `"SHOP"` \| `"PACK"` \| `"TRAY"` \| `"RACK"` \| `"REWARD"` \| `"PLAYED"`; \}\>; `GUIDANCE`: `Record`\<`string`, \{ `firstSeen`: \{ `actId`: `string`; `origin?`: \{ `kind`: `"RANDOM"`; \} \| \{ `kind`: `"SEEDED"`; \} \| \{ `date`: `string`; `kind`: `"DAILY"`; \}; `seed`: `string`; \}; `via`: `"BOSS"` \| `"CRISIS"` \| `"SPONSOR"` \| `"SHOP"` \| `"PACK"` \| `"TRAY"` \| `"RACK"` \| `"REWARD"` \| `"PLAYED"`; \}\>; `HAND`: `Record`\<`string`, \{ `firstSeen`: \{ `actId`: `string`; `origin?`: \{ `kind`: `"RANDOM"`; \} \| \{ `kind`: `"SEEDED"`; \} \| \{ `date`: `string`; `kind`: `"DAILY"`; \}; `seed`: `string`; \}; `via`: `"BOSS"` \| `"CRISIS"` \| `"SPONSOR"` \| `"SHOP"` \| `"PACK"` \| `"TRAY"` \| `"RACK"` \| `"REWARD"` \| `"PLAYED"`; \}\>; `RELIC`: `Record`\<`string`, \{ `firstSeen`: \{ `actId`: `string`; `origin?`: \{ `kind`: `"RANDOM"`; \} \| \{ `kind`: `"SEEDED"`; \} \| \{ `date`: `string`; `kind`: `"DAILY"`; \}; `seed`: `string`; \}; `via`: `"BOSS"` \| `"CRISIS"` \| `"SPONSOR"` \| `"SHOP"` \| `"PACK"` \| `"TRAY"` \| `"RACK"` \| `"REWARD"` \| `"PLAYED"`; \}\>; `SEAL`: `Record`\<`string`, \{ `firstSeen`: \{ `actId`: `string`; `origin?`: \{ `kind`: `"RANDOM"`; \} \| \{ `kind`: `"SEEDED"`; \} \| \{ `date`: `string`; `kind`: `"DAILY"`; \}; `seed`: `string`; \}; `via`: `"BOSS"` \| `"CRISIS"` \| `"SPONSOR"` \| `"SHOP"` \| `"PACK"` \| `"TRAY"` \| `"RACK"` \| `"REWARD"` \| `"PLAYED"`; \}\>; `SPONSOR`: `Record`\<`string`, \{ `firstSeen`: \{ `actId`: `string`; `origin?`: \{ `kind`: `"RANDOM"`; \} \| \{ `kind`: `"SEEDED"`; \} \| \{ `date`: `string`; `kind`: `"DAILY"`; \}; `seed`: `string`; \}; `via`: `"BOSS"` \| `"CRISIS"` \| `"SPONSOR"` \| `"SHOP"` \| `"PACK"` \| `"TRAY"` \| `"RACK"` \| `"REWARD"` \| `"PLAYED"`; \}\>; \} = `...`

#### discovered.BOSS

`Record`\<`string`, \{ `firstSeen`: \{ `actId`: `string`; `origin?`: \{ `kind`: `"RANDOM"`; \} \| \{ `kind`: `"SEEDED"`; \} \| \{ `date`: `string`; `kind`: `"DAILY"`; \}; `seed`: `string`; \}; `via`: `"BOSS"` \| `"CRISIS"` \| `"SPONSOR"` \| `"SHOP"` \| `"PACK"` \| `"TRAY"` \| `"RACK"` \| `"REWARD"` \| `"PLAYED"`; \}\> = `section`

#### discovered.CRISIS

`Record`\<`string`, \{ `firstSeen`: \{ `actId`: `string`; `origin?`: \{ `kind`: `"RANDOM"`; \} \| \{ `kind`: `"SEEDED"`; \} \| \{ `date`: `string`; `kind`: `"DAILY"`; \}; `seed`: `string`; \}; `via`: `"BOSS"` \| `"CRISIS"` \| `"SPONSOR"` \| `"SHOP"` \| `"PACK"` \| `"TRAY"` \| `"RACK"` \| `"REWARD"` \| `"PLAYED"`; \}\> = `section`

#### discovered.GUIDANCE

`Record`\<`string`, \{ `firstSeen`: \{ `actId`: `string`; `origin?`: \{ `kind`: `"RANDOM"`; \} \| \{ `kind`: `"SEEDED"`; \} \| \{ `date`: `string`; `kind`: `"DAILY"`; \}; `seed`: `string`; \}; `via`: `"BOSS"` \| `"CRISIS"` \| `"SPONSOR"` \| `"SHOP"` \| `"PACK"` \| `"TRAY"` \| `"RACK"` \| `"REWARD"` \| `"PLAYED"`; \}\> = `section`

#### discovered.HAND

`Record`\<`string`, \{ `firstSeen`: \{ `actId`: `string`; `origin?`: \{ `kind`: `"RANDOM"`; \} \| \{ `kind`: `"SEEDED"`; \} \| \{ `date`: `string`; `kind`: `"DAILY"`; \}; `seed`: `string`; \}; `via`: `"BOSS"` \| `"CRISIS"` \| `"SPONSOR"` \| `"SHOP"` \| `"PACK"` \| `"TRAY"` \| `"RACK"` \| `"REWARD"` \| `"PLAYED"`; \}\> = `section`

#### discovered.RELIC

`Record`\<`string`, \{ `firstSeen`: \{ `actId`: `string`; `origin?`: \{ `kind`: `"RANDOM"`; \} \| \{ `kind`: `"SEEDED"`; \} \| \{ `date`: `string`; `kind`: `"DAILY"`; \}; `seed`: `string`; \}; `via`: `"BOSS"` \| `"CRISIS"` \| `"SPONSOR"` \| `"SHOP"` \| `"PACK"` \| `"TRAY"` \| `"RACK"` \| `"REWARD"` \| `"PLAYED"`; \}\> = `section`

#### discovered.SEAL

`Record`\<`string`, \{ `firstSeen`: \{ `actId`: `string`; `origin?`: \{ `kind`: `"RANDOM"`; \} \| \{ `kind`: `"SEEDED"`; \} \| \{ `date`: `string`; `kind`: `"DAILY"`; \}; `seed`: `string`; \}; `via`: `"BOSS"` \| `"CRISIS"` \| `"SPONSOR"` \| `"SHOP"` \| `"PACK"` \| `"TRAY"` \| `"RACK"` \| `"REWARD"` \| `"PLAYED"`; \}\> = `section`

#### discovered.SPONSOR

`Record`\<`string`, \{ `firstSeen`: \{ `actId`: `string`; `origin?`: \{ `kind`: `"RANDOM"`; \} \| \{ `kind`: `"SEEDED"`; \} \| \{ `date`: `string`; `kind`: `"DAILY"`; \}; `seed`: `string`; \}; `via`: `"BOSS"` \| `"CRISIS"` \| `"SPONSOR"` \| `"SHOP"` \| `"PACK"` \| `"TRAY"` \| `"RACK"` \| `"REWARD"` \| `"PLAYED"`; \}\> = `section`

#### history

`object`[] = `...`

#### version

`1` = `...`

## Returns

`string`
