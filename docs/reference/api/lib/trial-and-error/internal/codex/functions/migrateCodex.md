[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/trial-and-error/internal/codex](../README.md) / migrateCodex

# Function: migrateCodex()

> **migrateCodex**(`doc`): \{ `discovered`: \{ `BOSS`: `Record`\<`string`, \{ `firstSeen`: \{ `actId`: `string`; `origin?`: \{ `kind`: `"RANDOM"`; \} \| \{ `kind`: `"SEEDED"`; \} \| \{ `date`: `string`; `kind`: `"DAILY"`; \}; `seed`: `string`; \}; `via`: `"BOSS"` \| `"CRISIS"` \| `"SPONSOR"` \| `"SHOP"` \| `"PACK"` \| `"TRAY"` \| `"RACK"` \| `"REWARD"` \| `"PLAYED"`; \}\>; `CRISIS`: `Record`\<`string`, \{ `firstSeen`: \{ `actId`: `string`; `origin?`: \{ `kind`: `"RANDOM"`; \} \| \{ `kind`: `"SEEDED"`; \} \| \{ `date`: `string`; `kind`: `"DAILY"`; \}; `seed`: `string`; \}; `via`: `"BOSS"` \| `"CRISIS"` \| `"SPONSOR"` \| `"SHOP"` \| `"PACK"` \| `"TRAY"` \| `"RACK"` \| `"REWARD"` \| `"PLAYED"`; \}\>; `GUIDANCE`: `Record`\<`string`, \{ `firstSeen`: \{ `actId`: `string`; `origin?`: \{ `kind`: `"RANDOM"`; \} \| \{ `kind`: `"SEEDED"`; \} \| \{ `date`: `string`; `kind`: `"DAILY"`; \}; `seed`: `string`; \}; `via`: `"BOSS"` \| `"CRISIS"` \| `"SPONSOR"` \| `"SHOP"` \| `"PACK"` \| `"TRAY"` \| `"RACK"` \| `"REWARD"` \| `"PLAYED"`; \}\>; `HAND`: `Record`\<`string`, \{ `firstSeen`: \{ `actId`: `string`; `origin?`: \{ `kind`: `"RANDOM"`; \} \| \{ `kind`: `"SEEDED"`; \} \| \{ `date`: `string`; `kind`: `"DAILY"`; \}; `seed`: `string`; \}; `via`: `"BOSS"` \| `"CRISIS"` \| `"SPONSOR"` \| `"SHOP"` \| `"PACK"` \| `"TRAY"` \| `"RACK"` \| `"REWARD"` \| `"PLAYED"`; \}\>; `RELIC`: `Record`\<`string`, \{ `firstSeen`: \{ `actId`: `string`; `origin?`: \{ `kind`: `"RANDOM"`; \} \| \{ `kind`: `"SEEDED"`; \} \| \{ `date`: `string`; `kind`: `"DAILY"`; \}; `seed`: `string`; \}; `via`: `"BOSS"` \| `"CRISIS"` \| `"SPONSOR"` \| `"SHOP"` \| `"PACK"` \| `"TRAY"` \| `"RACK"` \| `"REWARD"` \| `"PLAYED"`; \}\>; `SEAL`: `Record`\<`string`, \{ `firstSeen`: \{ `actId`: `string`; `origin?`: \{ `kind`: `"RANDOM"`; \} \| \{ `kind`: `"SEEDED"`; \} \| \{ `date`: `string`; `kind`: `"DAILY"`; \}; `seed`: `string`; \}; `via`: `"BOSS"` \| `"CRISIS"` \| `"SPONSOR"` \| `"SHOP"` \| `"PACK"` \| `"TRAY"` \| `"RACK"` \| `"REWARD"` \| `"PLAYED"`; \}\>; `SPONSOR`: `Record`\<`string`, \{ `firstSeen`: \{ `actId`: `string`; `origin?`: \{ `kind`: `"RANDOM"`; \} \| \{ `kind`: `"SEEDED"`; \} \| \{ `date`: `string`; `kind`: `"DAILY"`; \}; `seed`: `string`; \}; `via`: `"BOSS"` \| `"CRISIS"` \| `"SPONSOR"` \| `"SHOP"` \| `"PACK"` \| `"TRAY"` \| `"RACK"` \| `"REWARD"` \| `"PLAYED"`; \}\>; \}; `history`: `object`[]; `unlocks`: `Partial`\<`Record`\<`"VIRTUAL_BIOTECH"` \| `"ONCOLOGY_PHARMA"` \| `"CARDIO_MEGA_TRIAL"` \| `"RARE_DISEASE_BIOTECH"`, `number`\>\>; `version`: `2`; \} \| `null`

Brings a parsed Codex document of any known version up to the current one
and checks it, or returns null when it is not a Codex this build can read.
Never throws.

## Parameters

### doc

`unknown`

## Returns

### Type Literal

\{ `discovered`: \{ `BOSS`: `Record`\<`string`, \{ `firstSeen`: \{ `actId`: `string`; `origin?`: \{ `kind`: `"RANDOM"`; \} \| \{ `kind`: `"SEEDED"`; \} \| \{ `date`: `string`; `kind`: `"DAILY"`; \}; `seed`: `string`; \}; `via`: `"BOSS"` \| `"CRISIS"` \| `"SPONSOR"` \| `"SHOP"` \| `"PACK"` \| `"TRAY"` \| `"RACK"` \| `"REWARD"` \| `"PLAYED"`; \}\>; `CRISIS`: `Record`\<`string`, \{ `firstSeen`: \{ `actId`: `string`; `origin?`: \{ `kind`: `"RANDOM"`; \} \| \{ `kind`: `"SEEDED"`; \} \| \{ `date`: `string`; `kind`: `"DAILY"`; \}; `seed`: `string`; \}; `via`: `"BOSS"` \| `"CRISIS"` \| `"SPONSOR"` \| `"SHOP"` \| `"PACK"` \| `"TRAY"` \| `"RACK"` \| `"REWARD"` \| `"PLAYED"`; \}\>; `GUIDANCE`: `Record`\<`string`, \{ `firstSeen`: \{ `actId`: `string`; `origin?`: \{ `kind`: `"RANDOM"`; \} \| \{ `kind`: `"SEEDED"`; \} \| \{ `date`: `string`; `kind`: `"DAILY"`; \}; `seed`: `string`; \}; `via`: `"BOSS"` \| `"CRISIS"` \| `"SPONSOR"` \| `"SHOP"` \| `"PACK"` \| `"TRAY"` \| `"RACK"` \| `"REWARD"` \| `"PLAYED"`; \}\>; `HAND`: `Record`\<`string`, \{ `firstSeen`: \{ `actId`: `string`; `origin?`: \{ `kind`: `"RANDOM"`; \} \| \{ `kind`: `"SEEDED"`; \} \| \{ `date`: `string`; `kind`: `"DAILY"`; \}; `seed`: `string`; \}; `via`: `"BOSS"` \| `"CRISIS"` \| `"SPONSOR"` \| `"SHOP"` \| `"PACK"` \| `"TRAY"` \| `"RACK"` \| `"REWARD"` \| `"PLAYED"`; \}\>; `RELIC`: `Record`\<`string`, \{ `firstSeen`: \{ `actId`: `string`; `origin?`: \{ `kind`: `"RANDOM"`; \} \| \{ `kind`: `"SEEDED"`; \} \| \{ `date`: `string`; `kind`: `"DAILY"`; \}; `seed`: `string`; \}; `via`: `"BOSS"` \| `"CRISIS"` \| `"SPONSOR"` \| `"SHOP"` \| `"PACK"` \| `"TRAY"` \| `"RACK"` \| `"REWARD"` \| `"PLAYED"`; \}\>; `SEAL`: `Record`\<`string`, \{ `firstSeen`: \{ `actId`: `string`; `origin?`: \{ `kind`: `"RANDOM"`; \} \| \{ `kind`: `"SEEDED"`; \} \| \{ `date`: `string`; `kind`: `"DAILY"`; \}; `seed`: `string`; \}; `via`: `"BOSS"` \| `"CRISIS"` \| `"SPONSOR"` \| `"SHOP"` \| `"PACK"` \| `"TRAY"` \| `"RACK"` \| `"REWARD"` \| `"PLAYED"`; \}\>; `SPONSOR`: `Record`\<`string`, \{ `firstSeen`: \{ `actId`: `string`; `origin?`: \{ `kind`: `"RANDOM"`; \} \| \{ `kind`: `"SEEDED"`; \} \| \{ `date`: `string`; `kind`: `"DAILY"`; \}; `seed`: `string`; \}; `via`: `"BOSS"` \| `"CRISIS"` \| `"SPONSOR"` \| `"SHOP"` \| `"PACK"` \| `"TRAY"` \| `"RACK"` \| `"REWARD"` \| `"PLAYED"`; \}\>; \}; `history`: `object`[]; `unlocks`: `Partial`\<`Record`\<`"VIRTUAL_BIOTECH"` \| `"ONCOLOGY_PHARMA"` \| `"CARDIO_MEGA_TRIAL"` \| `"RARE_DISEASE_BIOTECH"`, `number`\>\>; `version`: `2`; \}

#### discovered

> **discovered**: `object`

##### discovered.BOSS

> **BOSS**: `Record`\<`string`, \{ `firstSeen`: \{ `actId`: `string`; `origin?`: \{ `kind`: `"RANDOM"`; \} \| \{ `kind`: `"SEEDED"`; \} \| \{ `date`: `string`; `kind`: `"DAILY"`; \}; `seed`: `string`; \}; `via`: `"BOSS"` \| `"CRISIS"` \| `"SPONSOR"` \| `"SHOP"` \| `"PACK"` \| `"TRAY"` \| `"RACK"` \| `"REWARD"` \| `"PLAYED"`; \}\> = `section`

##### discovered.CRISIS

> **CRISIS**: `Record`\<`string`, \{ `firstSeen`: \{ `actId`: `string`; `origin?`: \{ `kind`: `"RANDOM"`; \} \| \{ `kind`: `"SEEDED"`; \} \| \{ `date`: `string`; `kind`: `"DAILY"`; \}; `seed`: `string`; \}; `via`: `"BOSS"` \| `"CRISIS"` \| `"SPONSOR"` \| `"SHOP"` \| `"PACK"` \| `"TRAY"` \| `"RACK"` \| `"REWARD"` \| `"PLAYED"`; \}\> = `section`

##### discovered.GUIDANCE

> **GUIDANCE**: `Record`\<`string`, \{ `firstSeen`: \{ `actId`: `string`; `origin?`: \{ `kind`: `"RANDOM"`; \} \| \{ `kind`: `"SEEDED"`; \} \| \{ `date`: `string`; `kind`: `"DAILY"`; \}; `seed`: `string`; \}; `via`: `"BOSS"` \| `"CRISIS"` \| `"SPONSOR"` \| `"SHOP"` \| `"PACK"` \| `"TRAY"` \| `"RACK"` \| `"REWARD"` \| `"PLAYED"`; \}\> = `section`

##### discovered.HAND

> **HAND**: `Record`\<`string`, \{ `firstSeen`: \{ `actId`: `string`; `origin?`: \{ `kind`: `"RANDOM"`; \} \| \{ `kind`: `"SEEDED"`; \} \| \{ `date`: `string`; `kind`: `"DAILY"`; \}; `seed`: `string`; \}; `via`: `"BOSS"` \| `"CRISIS"` \| `"SPONSOR"` \| `"SHOP"` \| `"PACK"` \| `"TRAY"` \| `"RACK"` \| `"REWARD"` \| `"PLAYED"`; \}\> = `section`

##### discovered.RELIC

> **RELIC**: `Record`\<`string`, \{ `firstSeen`: \{ `actId`: `string`; `origin?`: \{ `kind`: `"RANDOM"`; \} \| \{ `kind`: `"SEEDED"`; \} \| \{ `date`: `string`; `kind`: `"DAILY"`; \}; `seed`: `string`; \}; `via`: `"BOSS"` \| `"CRISIS"` \| `"SPONSOR"` \| `"SHOP"` \| `"PACK"` \| `"TRAY"` \| `"RACK"` \| `"REWARD"` \| `"PLAYED"`; \}\> = `section`

##### discovered.SEAL

> **SEAL**: `Record`\<`string`, \{ `firstSeen`: \{ `actId`: `string`; `origin?`: \{ `kind`: `"RANDOM"`; \} \| \{ `kind`: `"SEEDED"`; \} \| \{ `date`: `string`; `kind`: `"DAILY"`; \}; `seed`: `string`; \}; `via`: `"BOSS"` \| `"CRISIS"` \| `"SPONSOR"` \| `"SHOP"` \| `"PACK"` \| `"TRAY"` \| `"RACK"` \| `"REWARD"` \| `"PLAYED"`; \}\> = `section`

##### discovered.SPONSOR

> **SPONSOR**: `Record`\<`string`, \{ `firstSeen`: \{ `actId`: `string`; `origin?`: \{ `kind`: `"RANDOM"`; \} \| \{ `kind`: `"SEEDED"`; \} \| \{ `date`: `string`; `kind`: `"DAILY"`; \}; `seed`: `string`; \}; `via`: `"BOSS"` \| `"CRISIS"` \| `"SPONSOR"` \| `"SHOP"` \| `"PACK"` \| `"TRAY"` \| `"RACK"` \| `"REWARD"` \| `"PLAYED"`; \}\> = `section`

#### history

> **history**: `object`[]

#### unlocks

> **unlocks**: `Partial`\<`Record`\<`"VIRTUAL_BIOTECH"` \| `"ONCOLOGY_PHARMA"` \| `"CARDIO_MEGA_TRIAL"` \| `"RARE_DISEASE_BIOTECH"`, `number`\>\> = `UnlocksSchema`

Each unlocked sponsor and the highest stake unlocked for it (#950).
Virtual Biotech at stake 1 is always open, recorded or not.

#### version

> **version**: `2`

***

`null`
