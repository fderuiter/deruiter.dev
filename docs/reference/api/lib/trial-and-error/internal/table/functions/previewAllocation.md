[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/trial-and-error/internal/table](../README.md) / previewAllocation

# Function: previewAllocation()

> **previewAllocation**(`scenario`, `state`, `cardId`): [`AllocationOption`](../interfaces/AllocationOption.md)[]

Previews every analysis set a blank shell in hand could be compiled on:
the snapshot it would read, its N, and the hand the selection would make
with it, scored from revealed findings only. The shell joins the selection
when there is room. Pure; nothing is committed. Empty for any other card.

## Parameters

### scenario

#### blind

\{ `name`: `string`; `quota`: `number`; `tier`: `"SMALL_BLIND"` \| `"BIG_BLIND"` \| `"BOSS_BLIND"`; \} = `BlindSchema`

#### blind.name

`string` = `...`

#### blind.quota

`number` = `...`

#### blind.tier

`"SMALL_BLIND"` \| `"BIG_BLIND"` \| `"BOSS_BLIND"` = `BlindTierSchema`

#### boss?

\{ `debuffType`: `"DISABLE_POPULATION"` \| `"HAND_LIMIT"` \| `"DISCARD_PENALTY"` \| `"BLIND_FIREWALL"`; `description`: `string`; `disabledPopulations?`: (`"SCREENED"` \| `"ITT"` \| `"SAFETY"` \| `"PER_PROTOCOL"` \| `"FAS"`)[]; `discardCpuPenalty?`: `number`; `id`: `string`; `maxHandsAllowed?`: `number`; `name`: `string`; \} = `...`

Present only on a Boss Blind.

#### boss.debuffType

`"DISABLE_POPULATION"` \| `"HAND_LIMIT"` \| `"DISCARD_PENALTY"` \| `"BLIND_FIREWALL"` = `BossDebuffTypeSchema`

#### boss.description

`string` = `...`

#### boss.disabledPopulations?

(`"SCREENED"` \| `"ITT"` \| `"SAFETY"` \| `"PER_PROTOCOL"` \| `"FAS"`)[] = `...`

#### boss.discardCpuPenalty?

`number` = `...`

#### boss.id

`string` = `identifier`

#### boss.maxHandsAllowed?

`number` = `...`

#### boss.name

`string` = `...`

#### consumables?

`object`[] = `...`

Footnote seals granted to the consumable tray when the Blind starts.

#### deck

`object`[] = `...`

#### dmc?

\{ `charter`: `string`; \} = `...`

The Data Monitoring Committee chartered for this Blind. Outputs whose
shell `isBlinded` stay face down in the open session; only this
charter's governance can convene the closed session that reveals them.

#### dmc.charter

`string` = `...`

The documented control the closed session is convened under.

#### drawPile

`object`[] = `...`

#### encounter?

\{ `kind`: `"DMC_DEFENSE"`; `rewards`: `object`[]; `stages`: \[\{ `hands`: (`"HIGH_TABLE"` \| `"TLF_PAIR"` \| `"TLF_TWO_PAIR"` \| `"POPULATION_FLUSH"` \| `"CSR_STRAIGHT"` \| `"EFFICACY_FULL_HOUSE"` \| `"MEDDRA_FIVE_OF_A_KIND"`)[]; `name`: `string`; `quota`: `number`; `session`: `"OPEN"` \| `"CLOSED"`; \}, \{ `hands`: (`"HIGH_TABLE"` \| `"TLF_PAIR"` \| `"TLF_TWO_PAIR"` \| `"POPULATION_FLUSH"` \| `"CSR_STRAIGHT"` \| `"EFFICACY_FULL_HOUSE"` \| `"MEDDRA_FIVE_OF_A_KIND"`)[]; `name`: `string`; `quota`: `number`; `session`: `"OPEN"` \| `"CLOSED"`; \}\]; \} \| \{ `clockHours`: `number`; `hands`: (`"HIGH_TABLE"` \| `"TLF_PAIR"` \| `"TLF_TWO_PAIR"` \| `"POPULATION_FLUSH"` \| `"CSR_STRAIGHT"` \| `"EFFICACY_FULL_HOUSE"` \| `"MEDDRA_FIVE_OF_A_KIND"`)[]; `hours`: `Record`\<`"PLAY_HAND"` \| `"DISCARD"` \| `"INSPECT"` \| `"TRACE"`, `number`\>; `kind`: `"FDA_IR"`; `questions`: `object`[]; \} \| \{ `kind`: `"CSR_LOCK"`; `packageName`: `string`; \} = `...`

A staged Boss encounter: this Blind is cleared stage by stage.

#### events?

`object`[] = `...`

Scripted population changes during this Blind, in hand order.

#### guidance?

`object`[] = `...`

Guidance cards granted to free tray slots, after the seals.

#### handType

`"HIGH_TABLE"` \| `"TLF_PAIR"` \| `"TLF_TWO_PAIR"` \| `"POPULATION_FLUSH"` \| `"CSR_STRAIGHT"` \| `"EFFICACY_FULL_HOUSE"` \| `"MEDDRA_FIVE_OF_A_KIND"` = `HandTypeSchema`

#### id

`string` = `identifier`

#### intro

`string` = `...`

The short intro card shown when the Blind starts.

#### populationSnapshot

\{ `capturedAt`: `string`; `id`: `string`; `subjects`: `object`[]; `version`: `number`; \} = `PopulationSnapshotSchema`

#### populationSnapshot.capturedAt

`string` = `...`

#### populationSnapshot.id

`string` = `identifier`

#### populationSnapshot.subjects

`object`[] = `...`

#### populationSnapshot.version

`number` = `...`

#### rulebook

\{ `id`: `string`; `meanPrecision`: `number`; `percentPrecision`: `number`; `populationAliases`: `object`[]; `populationSuit`: `"SCREENED"` \| `"ITT"` \| `"SAFETY"` \| `"PER_PROTOCOL"` \| `"FAS"`; `roundingMode`: `"HALF_EVEN"` \| `"HALF_AWAY_FROM_ZERO"` \| `"TRUNCATE"`; `rules`: `object`[]; `title`: `string`; \} = `SapRulebookSchema`

#### rulebook.id

`string` = `identifier`

#### rulebook.meanPrecision

`number` = `...`

#### rulebook.percentPrecision

`number` = `...`

#### rulebook.populationAliases

`object`[] = `...`

#### rulebook.populationSuit

`"SCREENED"` \| `"ITT"` \| `"SAFETY"` \| `"PER_PROTOCOL"` \| `"FAS"` = `PopulationTypeSchema`

#### rulebook.roundingMode

`"HALF_EVEN"` \| `"HALF_AWAY_FROM_ZERO"` \| `"TRUNCATE"` = `RoundingModeSchema`

#### rulebook.rules

`object`[] = `...`

#### rulebook.title

`string` = `...`

#### shells

`object`[] = `...`

#### startingCpu

`number` = `nonNegativeInt`

#### summary

`string` = `...`

#### table

\{ `handSize`: `number`; `maxSelection`: `number`; `startingCpu`: `number`; \} = `TableRulesSchema`

#### table.handSize

`number` = `...`

#### table.maxSelection

`number` = `...`

#### table.startingCpu

`number` = `nonNegativeInt`

#### title

`string` = `...`

### state

[`TableState`](../interfaces/TableState.md)

### cardId

`string`

## Returns

[`AllocationOption`](../interfaces/AllocationOption.md)[]
