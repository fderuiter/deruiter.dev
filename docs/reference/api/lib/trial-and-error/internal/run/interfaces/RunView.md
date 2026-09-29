[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/trial-and-error/internal/run](../README.md) / RunView

# Interface: RunView

Everything a run renders, derived purely from act and state.

## Properties

### act

> **act**: [`RunActView`](RunActView.md)

***

### actIndex

> **actIndex**: `number`

The act being played, from 0; post-marketing rounds follow the campaign.

***

### actIntro

> **actIntro**: [`ActIntroView`](ActIntroView.md) \| `null`

The act card, while a new study's first Blind has not started.

***

### blind

> **blind**: `object`

#### blind

> **blind**: `object` = `BlindSchema`

##### blind.name

> **name**: `string`

##### blind.quota

> **quota**: `number`

##### blind.tier

> **tier**: `"SMALL_BLIND"` \| `"BIG_BLIND"` \| `"BOSS_BLIND"` = `BlindTierSchema`

#### boss?

> `optional` **boss?**: `object`

Present only on a Boss Blind.

##### boss.debuffType

> **debuffType**: `"DISABLE_POPULATION"` \| `"HAND_LIMIT"` \| `"DISCARD_PENALTY"` \| `"BLIND_FIREWALL"` = `BossDebuffTypeSchema`

##### boss.description

> **description**: `string`

##### boss.disabledPopulations?

> `optional` **disabledPopulations?**: (`"SCREENED"` \| `"ITT"` \| `"SAFETY"` \| `"PER_PROTOCOL"` \| `"FAS"`)[]

##### boss.discardCpuPenalty?

> `optional` **discardCpuPenalty?**: `number`

##### boss.id

> **id**: `string` = `identifier`

##### boss.maxHandsAllowed?

> `optional` **maxHandsAllowed?**: `number`

##### boss.name

> **name**: `string`

#### consumables?

> `optional` **consumables?**: `object`[]

Footnote seals granted to the consumable tray when the Blind starts.

#### deck

> **deck**: `object`[]

#### dmc?

> `optional` **dmc?**: `object`

The Data Monitoring Committee chartered for this Blind. Outputs whose
shell `isBlinded` stay face down in the open session; only this
charter's governance can convene the closed session that reveals them.

##### dmc.charter

> **charter**: `string`

The documented control the closed session is convened under.

#### drawPile

> **drawPile**: `object`[]

#### encounter?

> `optional` **encounter?**: \{ `kind`: `"DMC_DEFENSE"`; `rewards`: `object`[]; `stages`: \[\{ `hands`: (`"HIGH_TABLE"` \| `"TLF_PAIR"` \| `"TLF_TWO_PAIR"` \| `"POPULATION_FLUSH"` \| `"CSR_STRAIGHT"` \| `"EFFICACY_FULL_HOUSE"` \| `"MEDDRA_FIVE_OF_A_KIND"`)[]; `name`: `string`; `quota`: `number`; `session`: `"OPEN"` \| `"CLOSED"`; \}, \{ `hands`: (`"HIGH_TABLE"` \| `"TLF_PAIR"` \| `"TLF_TWO_PAIR"` \| `"POPULATION_FLUSH"` \| `"CSR_STRAIGHT"` \| `"EFFICACY_FULL_HOUSE"` \| `"MEDDRA_FIVE_OF_A_KIND"`)[]; `name`: `string`; `quota`: `number`; `session`: `"OPEN"` \| `"CLOSED"`; \}\]; \} \| \{ `clockHours`: `number`; `hands`: (`"HIGH_TABLE"` \| `"TLF_PAIR"` \| `"TLF_TWO_PAIR"` \| `"POPULATION_FLUSH"` \| `"CSR_STRAIGHT"` \| `"EFFICACY_FULL_HOUSE"` \| `"MEDDRA_FIVE_OF_A_KIND"`)[]; `hours`: `Record`\<`"PLAY_HAND"` \| `"DISCARD"` \| `"INSPECT"` \| `"TRACE"`, `number`\>; `kind`: `"FDA_IR"`; `questions`: `object`[]; \} \| \{ `kind`: `"CSR_LOCK"`; `packageName`: `string`; \}

A staged Boss encounter: this Blind is cleared stage by stage.

##### Union Members

###### Type Literal

\{ `kind`: `"DMC_DEFENSE"`; `rewards`: `object`[]; `stages`: \[\{ `hands`: (`"HIGH_TABLE"` \| `"TLF_PAIR"` \| `"TLF_TWO_PAIR"` \| `"POPULATION_FLUSH"` \| `"CSR_STRAIGHT"` \| `"EFFICACY_FULL_HOUSE"` \| `"MEDDRA_FIVE_OF_A_KIND"`)[]; `name`: `string`; `quota`: `number`; `session`: `"OPEN"` \| `"CLOSED"`; \}, \{ `hands`: (`"HIGH_TABLE"` \| `"TLF_PAIR"` \| `"TLF_TWO_PAIR"` \| `"POPULATION_FLUSH"` \| `"CSR_STRAIGHT"` \| `"EFFICACY_FULL_HOUSE"` \| `"MEDDRA_FIVE_OF_A_KIND"`)[]; `name`: `string`; `quota`: `number`; `session`: `"OPEN"` \| `"CLOSED"`; \}\]; \}

###### kind

> **kind**: `"DMC_DEFENSE"`

###### rewards

> **rewards**: `object`[]

The relics offered on victory; the player keeps one.

###### stages

> **stages**: \[\{ `hands`: (`"HIGH_TABLE"` \| `"TLF_PAIR"` \| `"TLF_TWO_PAIR"` \| `"POPULATION_FLUSH"` \| `"CSR_STRAIGHT"` \| `"EFFICACY_FULL_HOUSE"` \| `"MEDDRA_FIVE_OF_A_KIND"`)[]; `name`: `string`; `quota`: `number`; `session`: `"OPEN"` \| `"CLOSED"`; \}, \{ `hands`: (`"HIGH_TABLE"` \| `"TLF_PAIR"` \| `"TLF_TWO_PAIR"` \| `"POPULATION_FLUSH"` \| `"CSR_STRAIGHT"` \| `"EFFICACY_FULL_HOUSE"` \| `"MEDDRA_FIVE_OF_A_KIND"`)[]; `name`: `string`; `quota`: `number`; `session`: `"OPEN"` \| `"CLOSED"`; \}\]

***

###### Type Literal

\{ `clockHours`: `number`; `hands`: (`"HIGH_TABLE"` \| `"TLF_PAIR"` \| `"TLF_TWO_PAIR"` \| `"POPULATION_FLUSH"` \| `"CSR_STRAIGHT"` \| `"EFFICACY_FULL_HOUSE"` \| `"MEDDRA_FIVE_OF_A_KIND"`)[]; `hours`: `Record`\<`"PLAY_HAND"` \| `"DISCARD"` \| `"INSPECT"` \| `"TRACE"`, `number`\>; `kind`: `"FDA_IR"`; `questions`: `object`[]; \}

###### clockHours

> **clockHours**: `number`

Hours from the request to the response being due.

###### hands

> **hands**: (`"HIGH_TABLE"` \| `"TLF_PAIR"` \| `"TLF_TWO_PAIR"` \| `"POPULATION_FLUSH"` \| `"CSR_STRAIGHT"` \| `"EFFICACY_FULL_HOUSE"` \| `"MEDDRA_FIVE_OF_A_KIND"`)[]

The hands the FDA accepts as a response.

###### hours

> **hours**: `Record`\<`"PLAY_HAND"` \| `"DISCARD"` \| `"INSPECT"` \| `"TRACE"`, `number`\>

What each move costs in hours.

###### kind

> **kind**: `"FDA_IR"`

###### questions

> **questions**: `object`[]

***

###### Type Literal

\{ `kind`: `"CSR_LOCK"`; `packageName`: `string`; \}

###### kind

> **kind**: `"CSR_LOCK"`

###### packageName

> **packageName**: `string`

The package's name on the lock stamp and audit summary.

#### events?

> `optional` **events?**: `object`[]

Scripted population changes during this Blind, in hand order.

#### guidance?

> `optional` **guidance?**: `object`[]

Guidance cards granted to free tray slots, after the seals.

#### handType

> **handType**: `"HIGH_TABLE"` \| `"TLF_PAIR"` \| `"TLF_TWO_PAIR"` \| `"POPULATION_FLUSH"` \| `"CSR_STRAIGHT"` \| `"EFFICACY_FULL_HOUSE"` \| `"MEDDRA_FIVE_OF_A_KIND"` = `HandTypeSchema`

#### id

> **id**: `string` = `identifier`

#### intro

> **intro**: `string`

The short intro card shown when the Blind starts.

#### populationSnapshot

> **populationSnapshot**: `object` = `PopulationSnapshotSchema`

##### populationSnapshot.capturedAt

> **capturedAt**: `string`

##### populationSnapshot.id

> **id**: `string` = `identifier`

##### populationSnapshot.subjects

> **subjects**: `object`[]

##### populationSnapshot.version

> **version**: `number`

#### rulebook

> **rulebook**: `object` = `SapRulebookSchema`

##### rulebook.id

> **id**: `string` = `identifier`

##### rulebook.meanPrecision

> **meanPrecision**: `number`

##### rulebook.percentPrecision

> **percentPrecision**: `number`

##### rulebook.populationAliases

> **populationAliases**: `object`[]

##### rulebook.populationSuit

> **populationSuit**: `"SCREENED"` \| `"ITT"` \| `"SAFETY"` \| `"PER_PROTOCOL"` \| `"FAS"` = `PopulationTypeSchema`

##### rulebook.roundingMode

> **roundingMode**: `"HALF_EVEN"` \| `"HALF_AWAY_FROM_ZERO"` \| `"TRUNCATE"` = `RoundingModeSchema`

##### rulebook.rules

> **rules**: `object`[]

##### rulebook.title

> **title**: `string`

#### shells

> **shells**: `object`[]

#### startingCpu

> **startingCpu**: `number` = `nonNegativeInt`

#### summary

> **summary**: `string`

#### table

> **table**: `object` = `TableRulesSchema`

##### table.handSize

> **handSize**: `number`

##### table.maxSelection

> **maxSelection**: `number`

##### table.startingCpu

> **startingCpu**: `number` = `nonNegativeInt`

#### title

> **title**: `string`

***

### blindCount

> **blindCount**: `number`

***

### blindIndex

> **blindIndex**: `number`

***

### cashOut

> **cashOut**: [`CashOutReport`](../../shop/interfaces/CashOutReport.md) \| `null`

The cash-out paid for this Blind, once paid.

***

### draws

> **draws**: [`RunDraw`](RunDraw.md)[]

***

### endless

> **endless**: [`EndlessView`](EndlessView.md) \| `null`

Endless post-marketing mode, when the plan offers it.

***

### isFinalBlind

> **isFinalBlind**: `boolean`

***

### nextAct

> **nextAct**: [`RunActView`](RunActView.md) \| `null`

The act that follows, when the next Blind starts a new study.

***

### nextBlind

> **nextBlind**: \{ `blind`: \{ `name`: `string`; `quota`: `number`; `tier`: `"SMALL_BLIND"` \| `"BIG_BLIND"` \| `"BOSS_BLIND"`; \}; `boss?`: \{ `debuffType`: `"DISABLE_POPULATION"` \| `"HAND_LIMIT"` \| `"DISCARD_PENALTY"` \| `"BLIND_FIREWALL"`; `description`: `string`; `disabledPopulations?`: (`"SCREENED"` \| `"ITT"` \| `"SAFETY"` \| `"PER_PROTOCOL"` \| `"FAS"`)[]; `discardCpuPenalty?`: `number`; `id`: `string`; `maxHandsAllowed?`: `number`; `name`: `string`; \}; `consumables?`: `object`[]; `deck`: `object`[]; `dmc?`: \{ `charter`: `string`; \}; `drawPile`: `object`[]; `encounter?`: \{ `kind`: `"DMC_DEFENSE"`; `rewards`: `object`[]; `stages`: \[\{ `hands`: (`"HIGH_TABLE"` \| `"TLF_PAIR"` \| `"TLF_TWO_PAIR"` \| `"POPULATION_FLUSH"` \| `"CSR_STRAIGHT"` \| `"EFFICACY_FULL_HOUSE"` \| `"MEDDRA_FIVE_OF_A_KIND"`)[]; `name`: `string`; `quota`: `number`; `session`: `"OPEN"` \| `"CLOSED"`; \}, \{ `hands`: (`"HIGH_TABLE"` \| `"TLF_PAIR"` \| `"TLF_TWO_PAIR"` \| `"POPULATION_FLUSH"` \| `"CSR_STRAIGHT"` \| `"EFFICACY_FULL_HOUSE"` \| `"MEDDRA_FIVE_OF_A_KIND"`)[]; `name`: `string`; `quota`: `number`; `session`: `"OPEN"` \| `"CLOSED"`; \}\]; \} \| \{ `clockHours`: `number`; `hands`: (`"HIGH_TABLE"` \| `"TLF_PAIR"` \| `"TLF_TWO_PAIR"` \| `"POPULATION_FLUSH"` \| `"CSR_STRAIGHT"` \| `"EFFICACY_FULL_HOUSE"` \| `"MEDDRA_FIVE_OF_A_KIND"`)[]; `hours`: `Record`\<`"PLAY_HAND"` \| `"DISCARD"` \| `"INSPECT"` \| `"TRACE"`, `number`\>; `kind`: `"FDA_IR"`; `questions`: `object`[]; \} \| \{ `kind`: `"CSR_LOCK"`; `packageName`: `string`; \}; `events?`: `object`[]; `guidance?`: `object`[]; `handType`: `"HIGH_TABLE"` \| `"TLF_PAIR"` \| `"TLF_TWO_PAIR"` \| `"POPULATION_FLUSH"` \| `"CSR_STRAIGHT"` \| `"EFFICACY_FULL_HOUSE"` \| `"MEDDRA_FIVE_OF_A_KIND"`; `id`: `string`; `intro`: `string`; `populationSnapshot`: \{ `capturedAt`: `string`; `id`: `string`; `subjects`: `object`[]; `version`: `number`; \}; `rulebook`: \{ `id`: `string`; `meanPrecision`: `number`; `percentPrecision`: `number`; `populationAliases`: `object`[]; `populationSuit`: `"SCREENED"` \| `"ITT"` \| `"SAFETY"` \| `"PER_PROTOCOL"` \| `"FAS"`; `roundingMode`: `"HALF_EVEN"` \| `"HALF_AWAY_FROM_ZERO"` \| `"TRUNCATE"`; `rules`: `object`[]; `title`: `string`; \}; `shells`: `object`[]; `startingCpu`: `number`; `summary`: `string`; `table`: \{ `handSize`: `number`; `maxSelection`: `number`; `startingCpu`: `number`; \}; `title`: `string`; \} \| `null`

The Blind that follows this one, if any.

#### Union Members

##### Type Literal

\{ `blind`: \{ `name`: `string`; `quota`: `number`; `tier`: `"SMALL_BLIND"` \| `"BIG_BLIND"` \| `"BOSS_BLIND"`; \}; `boss?`: \{ `debuffType`: `"DISABLE_POPULATION"` \| `"HAND_LIMIT"` \| `"DISCARD_PENALTY"` \| `"BLIND_FIREWALL"`; `description`: `string`; `disabledPopulations?`: (`"SCREENED"` \| `"ITT"` \| `"SAFETY"` \| `"PER_PROTOCOL"` \| `"FAS"`)[]; `discardCpuPenalty?`: `number`; `id`: `string`; `maxHandsAllowed?`: `number`; `name`: `string`; \}; `consumables?`: `object`[]; `deck`: `object`[]; `dmc?`: \{ `charter`: `string`; \}; `drawPile`: `object`[]; `encounter?`: \{ `kind`: `"DMC_DEFENSE"`; `rewards`: `object`[]; `stages`: \[\{ `hands`: (`"HIGH_TABLE"` \| `"TLF_PAIR"` \| `"TLF_TWO_PAIR"` \| `"POPULATION_FLUSH"` \| `"CSR_STRAIGHT"` \| `"EFFICACY_FULL_HOUSE"` \| `"MEDDRA_FIVE_OF_A_KIND"`)[]; `name`: `string`; `quota`: `number`; `session`: `"OPEN"` \| `"CLOSED"`; \}, \{ `hands`: (`"HIGH_TABLE"` \| `"TLF_PAIR"` \| `"TLF_TWO_PAIR"` \| `"POPULATION_FLUSH"` \| `"CSR_STRAIGHT"` \| `"EFFICACY_FULL_HOUSE"` \| `"MEDDRA_FIVE_OF_A_KIND"`)[]; `name`: `string`; `quota`: `number`; `session`: `"OPEN"` \| `"CLOSED"`; \}\]; \} \| \{ `clockHours`: `number`; `hands`: (`"HIGH_TABLE"` \| `"TLF_PAIR"` \| `"TLF_TWO_PAIR"` \| `"POPULATION_FLUSH"` \| `"CSR_STRAIGHT"` \| `"EFFICACY_FULL_HOUSE"` \| `"MEDDRA_FIVE_OF_A_KIND"`)[]; `hours`: `Record`\<`"PLAY_HAND"` \| `"DISCARD"` \| `"INSPECT"` \| `"TRACE"`, `number`\>; `kind`: `"FDA_IR"`; `questions`: `object`[]; \} \| \{ `kind`: `"CSR_LOCK"`; `packageName`: `string`; \}; `events?`: `object`[]; `guidance?`: `object`[]; `handType`: `"HIGH_TABLE"` \| `"TLF_PAIR"` \| `"TLF_TWO_PAIR"` \| `"POPULATION_FLUSH"` \| `"CSR_STRAIGHT"` \| `"EFFICACY_FULL_HOUSE"` \| `"MEDDRA_FIVE_OF_A_KIND"`; `id`: `string`; `intro`: `string`; `populationSnapshot`: \{ `capturedAt`: `string`; `id`: `string`; `subjects`: `object`[]; `version`: `number`; \}; `rulebook`: \{ `id`: `string`; `meanPrecision`: `number`; `percentPrecision`: `number`; `populationAliases`: `object`[]; `populationSuit`: `"SCREENED"` \| `"ITT"` \| `"SAFETY"` \| `"PER_PROTOCOL"` \| `"FAS"`; `roundingMode`: `"HALF_EVEN"` \| `"HALF_AWAY_FROM_ZERO"` \| `"TRUNCATE"`; `rules`: `object`[]; `title`: `string`; \}; `shells`: `object`[]; `startingCpu`: `number`; `summary`: `string`; `table`: \{ `handSize`: `number`; `maxSelection`: `number`; `startingCpu`: `number`; \}; `title`: `string`; \}

##### blind

> **blind**: `object` = `BlindSchema`

###### blind.name

> **name**: `string`

###### blind.quota

> **quota**: `number`

###### blind.tier

> **tier**: `"SMALL_BLIND"` \| `"BIG_BLIND"` \| `"BOSS_BLIND"` = `BlindTierSchema`

##### boss?

> `optional` **boss?**: `object`

Present only on a Boss Blind.

###### boss.debuffType

> **debuffType**: `"DISABLE_POPULATION"` \| `"HAND_LIMIT"` \| `"DISCARD_PENALTY"` \| `"BLIND_FIREWALL"` = `BossDebuffTypeSchema`

###### boss.description

> **description**: `string`

###### boss.disabledPopulations?

> `optional` **disabledPopulations?**: (`"SCREENED"` \| `"ITT"` \| `"SAFETY"` \| `"PER_PROTOCOL"` \| `"FAS"`)[]

###### boss.discardCpuPenalty?

> `optional` **discardCpuPenalty?**: `number`

###### boss.id

> **id**: `string` = `identifier`

###### boss.maxHandsAllowed?

> `optional` **maxHandsAllowed?**: `number`

###### boss.name

> **name**: `string`

##### consumables?

> `optional` **consumables?**: `object`[]

Footnote seals granted to the consumable tray when the Blind starts.

##### deck

> **deck**: `object`[]

##### dmc?

> `optional` **dmc?**: `object`

The Data Monitoring Committee chartered for this Blind. Outputs whose
shell `isBlinded` stay face down in the open session; only this
charter's governance can convene the closed session that reveals them.

###### dmc.charter

> **charter**: `string`

The documented control the closed session is convened under.

##### drawPile

> **drawPile**: `object`[]

##### encounter?

> `optional` **encounter?**: \{ `kind`: `"DMC_DEFENSE"`; `rewards`: `object`[]; `stages`: \[\{ `hands`: (`"HIGH_TABLE"` \| `"TLF_PAIR"` \| `"TLF_TWO_PAIR"` \| `"POPULATION_FLUSH"` \| `"CSR_STRAIGHT"` \| `"EFFICACY_FULL_HOUSE"` \| `"MEDDRA_FIVE_OF_A_KIND"`)[]; `name`: `string`; `quota`: `number`; `session`: `"OPEN"` \| `"CLOSED"`; \}, \{ `hands`: (`"HIGH_TABLE"` \| `"TLF_PAIR"` \| `"TLF_TWO_PAIR"` \| `"POPULATION_FLUSH"` \| `"CSR_STRAIGHT"` \| `"EFFICACY_FULL_HOUSE"` \| `"MEDDRA_FIVE_OF_A_KIND"`)[]; `name`: `string`; `quota`: `number`; `session`: `"OPEN"` \| `"CLOSED"`; \}\]; \} \| \{ `clockHours`: `number`; `hands`: (`"HIGH_TABLE"` \| `"TLF_PAIR"` \| `"TLF_TWO_PAIR"` \| `"POPULATION_FLUSH"` \| `"CSR_STRAIGHT"` \| `"EFFICACY_FULL_HOUSE"` \| `"MEDDRA_FIVE_OF_A_KIND"`)[]; `hours`: `Record`\<`"PLAY_HAND"` \| `"DISCARD"` \| `"INSPECT"` \| `"TRACE"`, `number`\>; `kind`: `"FDA_IR"`; `questions`: `object`[]; \} \| \{ `kind`: `"CSR_LOCK"`; `packageName`: `string`; \}

A staged Boss encounter: this Blind is cleared stage by stage.

###### Union Members

###### Type Literal

\{ `kind`: `"DMC_DEFENSE"`; `rewards`: `object`[]; `stages`: \[\{ `hands`: (`"HIGH_TABLE"` \| `"TLF_PAIR"` \| `"TLF_TWO_PAIR"` \| `"POPULATION_FLUSH"` \| `"CSR_STRAIGHT"` \| `"EFFICACY_FULL_HOUSE"` \| `"MEDDRA_FIVE_OF_A_KIND"`)[]; `name`: `string`; `quota`: `number`; `session`: `"OPEN"` \| `"CLOSED"`; \}, \{ `hands`: (`"HIGH_TABLE"` \| `"TLF_PAIR"` \| `"TLF_TWO_PAIR"` \| `"POPULATION_FLUSH"` \| `"CSR_STRAIGHT"` \| `"EFFICACY_FULL_HOUSE"` \| `"MEDDRA_FIVE_OF_A_KIND"`)[]; `name`: `string`; `quota`: `number`; `session`: `"OPEN"` \| `"CLOSED"`; \}\]; \}

###### kind

> **kind**: `"DMC_DEFENSE"`

###### rewards

> **rewards**: `object`[]

The relics offered on victory; the player keeps one.

###### stages

> **stages**: \[\{ `hands`: (`"HIGH_TABLE"` \| `"TLF_PAIR"` \| `"TLF_TWO_PAIR"` \| `"POPULATION_FLUSH"` \| `"CSR_STRAIGHT"` \| `"EFFICACY_FULL_HOUSE"` \| `"MEDDRA_FIVE_OF_A_KIND"`)[]; `name`: `string`; `quota`: `number`; `session`: `"OPEN"` \| `"CLOSED"`; \}, \{ `hands`: (`"HIGH_TABLE"` \| `"TLF_PAIR"` \| `"TLF_TWO_PAIR"` \| `"POPULATION_FLUSH"` \| `"CSR_STRAIGHT"` \| `"EFFICACY_FULL_HOUSE"` \| `"MEDDRA_FIVE_OF_A_KIND"`)[]; `name`: `string`; `quota`: `number`; `session`: `"OPEN"` \| `"CLOSED"`; \}\]

***

###### Type Literal

\{ `clockHours`: `number`; `hands`: (`"HIGH_TABLE"` \| `"TLF_PAIR"` \| `"TLF_TWO_PAIR"` \| `"POPULATION_FLUSH"` \| `"CSR_STRAIGHT"` \| `"EFFICACY_FULL_HOUSE"` \| `"MEDDRA_FIVE_OF_A_KIND"`)[]; `hours`: `Record`\<`"PLAY_HAND"` \| `"DISCARD"` \| `"INSPECT"` \| `"TRACE"`, `number`\>; `kind`: `"FDA_IR"`; `questions`: `object`[]; \}

###### clockHours

> **clockHours**: `number`

Hours from the request to the response being due.

###### hands

> **hands**: (`"HIGH_TABLE"` \| `"TLF_PAIR"` \| `"TLF_TWO_PAIR"` \| `"POPULATION_FLUSH"` \| `"CSR_STRAIGHT"` \| `"EFFICACY_FULL_HOUSE"` \| `"MEDDRA_FIVE_OF_A_KIND"`)[]

The hands the FDA accepts as a response.

###### hours

> **hours**: `Record`\<`"PLAY_HAND"` \| `"DISCARD"` \| `"INSPECT"` \| `"TRACE"`, `number`\>

What each move costs in hours.

###### kind

> **kind**: `"FDA_IR"`

###### questions

> **questions**: `object`[]

***

###### Type Literal

\{ `kind`: `"CSR_LOCK"`; `packageName`: `string`; \}

###### kind

> **kind**: `"CSR_LOCK"`

###### packageName

> **packageName**: `string`

The package's name on the lock stamp and audit summary.

##### events?

> `optional` **events?**: `object`[]

Scripted population changes during this Blind, in hand order.

##### guidance?

> `optional` **guidance?**: `object`[]

Guidance cards granted to free tray slots, after the seals.

##### handType

> **handType**: `"HIGH_TABLE"` \| `"TLF_PAIR"` \| `"TLF_TWO_PAIR"` \| `"POPULATION_FLUSH"` \| `"CSR_STRAIGHT"` \| `"EFFICACY_FULL_HOUSE"` \| `"MEDDRA_FIVE_OF_A_KIND"` = `HandTypeSchema`

##### id

> **id**: `string` = `identifier`

##### intro

> **intro**: `string`

The short intro card shown when the Blind starts.

##### populationSnapshot

> **populationSnapshot**: `object` = `PopulationSnapshotSchema`

###### populationSnapshot.capturedAt

> **capturedAt**: `string`

###### populationSnapshot.id

> **id**: `string` = `identifier`

###### populationSnapshot.subjects

> **subjects**: `object`[]

###### populationSnapshot.version

> **version**: `number`

##### rulebook

> **rulebook**: `object` = `SapRulebookSchema`

###### rulebook.id

> **id**: `string` = `identifier`

###### rulebook.meanPrecision

> **meanPrecision**: `number`

###### rulebook.percentPrecision

> **percentPrecision**: `number`

###### rulebook.populationAliases

> **populationAliases**: `object`[]

###### rulebook.populationSuit

> **populationSuit**: `"SCREENED"` \| `"ITT"` \| `"SAFETY"` \| `"PER_PROTOCOL"` \| `"FAS"` = `PopulationTypeSchema`

###### rulebook.roundingMode

> **roundingMode**: `"HALF_EVEN"` \| `"HALF_AWAY_FROM_ZERO"` \| `"TRUNCATE"` = `RoundingModeSchema`

###### rulebook.rules

> **rules**: `object`[]

###### rulebook.title

> **title**: `string`

##### shells

> **shells**: `object`[]

##### startingCpu

> **startingCpu**: `number` = `nonNegativeInt`

##### summary

> **summary**: `string`

##### table

> **table**: `object` = `TableRulesSchema`

###### table.handSize

> **handSize**: `number`

###### table.maxSelection

> **maxSelection**: `number`

###### table.startingCpu

> **startingCpu**: `number` = `nonNegativeInt`

##### title

> **title**: `string`

***

`null`

***

### pendingCashOut

> **pendingCashOut**: [`CashOutReport`](../../shop/interfaces/CashOutReport.md) \| `null`

What the sponsor will pay at cash-out, until it has been paid.

***

### phase

> **phase**: [`RunPhase`](../type-aliases/RunPhase.md)

***

### seed

> **seed**: `string`

***

### shop

> **shop**: [`ShopView`](ShopView.md) \| `null`

The shop visit, while the run is in it.

***

### showIntro

> **showIntro**: `boolean`

The Blind has just started: nothing has been played or discarded.

***

### table

> **table**: [`TableView`](../../table/interfaces/TableView.md)
