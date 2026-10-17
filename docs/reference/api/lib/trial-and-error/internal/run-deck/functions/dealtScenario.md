[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/trial-and-error/internal/run-deck](../README.md) / dealtScenario

# Function: dealtScenario()

> **dealtScenario**(`scenario`, `deck`, `bonusChips?`): `object`

A Blind as the run deals it: its deck under the run deck, and the shells
of any bought cards beside its own. A deck that changes nothing gives the
Blind back unchanged, so a run without changes deals exactly as before.

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

\{ `kind`: `"DMC_DEFENSE"`; `rewards`: `object`[]; `stages`: \[\{ `hands`: (`"HIGH_TABLE"` \| `"TLF_PAIR"` \| `"TLF_TWO_PAIR"` \| `"POPULATION_FLUSH"` \| `"CSR_STRAIGHT"` \| `"EFFICACY_FULL_HOUSE"` \| `"MEDDRA_FIVE_OF_A_KIND"`)[]; `name`: `string`; `quota`: `number`; `session`: `"OPEN"` \| `"CLOSED"`; \}, \{ `hands`: (`"HIGH_TABLE"` \| `"TLF_PAIR"` \| `"TLF_TWO_PAIR"` \| `"POPULATION_FLUSH"` \| `"CSR_STRAIGHT"` \| `"EFFICACY_FULL_HOUSE"` \| `"MEDDRA_FIVE_OF_A_KIND"`)[]; `name`: `string`; `quota`: `number`; `session`: `"OPEN"` \| `"CLOSED"`; \}\]; \} \| \{ `clockHours`: `number`; `hands`: (`"HIGH_TABLE"` \| `"TLF_PAIR"` \| `"TLF_TWO_PAIR"` \| `"POPULATION_FLUSH"` \| `"CSR_STRAIGHT"` \| `"EFFICACY_FULL_HOUSE"` \| `"MEDDRA_FIVE_OF_A_KIND"`)[]; `hours`: `Record`\<`"TRACE"` \| `"PLAY_HAND"` \| `"DISCARD"` \| `"INSPECT"`, `number`\>; `kind`: `"FDA_IR"`; `letter?`: \{ `consequence`: `string`; `request`: `string`; \}; `questions`: `object`[]; \} \| \{ `kind`: `"CSR_LOCK"`; `packageName`: `string`; \} = `...`

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

#### pinned?

`string`[] = `...`

The deck's scripted setup (#2055): card ids a run always deals first,
in deck order, so the setup the Blind is written around is in the
opening hand. A run shuffles the rest of the deck from its seed.
Absent means none.

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

### deck

[`RunDeck`](../interfaces/RunDeck.md) \| `undefined`

### bonusChips?

(`card`) => `number`

## Returns

### blind

> **blind**: `object` = `BlindSchema`

#### blind.name

> **name**: `string`

#### blind.quota

> **quota**: `number`

#### blind.tier

> **tier**: `"SMALL_BLIND"` \| `"BIG_BLIND"` \| `"BOSS_BLIND"` = `BlindTierSchema`

### boss?

> `optional` **boss?**: `object`

Present only on a Boss Blind.

#### boss.debuffType

> **debuffType**: `"DISABLE_POPULATION"` \| `"HAND_LIMIT"` \| `"DISCARD_PENALTY"` \| `"BLIND_FIREWALL"` = `BossDebuffTypeSchema`

#### boss.description

> **description**: `string`

#### boss.disabledPopulations?

> `optional` **disabledPopulations?**: (`"SCREENED"` \| `"ITT"` \| `"SAFETY"` \| `"PER_PROTOCOL"` \| `"FAS"`)[]

#### boss.discardCpuPenalty?

> `optional` **discardCpuPenalty?**: `number`

#### boss.id

> **id**: `string` = `identifier`

#### boss.maxHandsAllowed?

> `optional` **maxHandsAllowed?**: `number`

#### boss.name

> **name**: `string`

### consumables?

> `optional` **consumables?**: `object`[]

Footnote seals granted to the consumable tray when the Blind starts.

### deck

> **deck**: `object`[]

### dmc?

> `optional` **dmc?**: `object`

The Data Monitoring Committee chartered for this Blind. Outputs whose
shell `isBlinded` stay face down in the open session; only this
charter's governance can convene the closed session that reveals them.

#### dmc.charter

> **charter**: `string`

The documented control the closed session is convened under.

### drawPile

> **drawPile**: `object`[]

### encounter?

> `optional` **encounter?**: \{ `kind`: `"DMC_DEFENSE"`; `rewards`: `object`[]; `stages`: \[\{ `hands`: (`"HIGH_TABLE"` \| `"TLF_PAIR"` \| `"TLF_TWO_PAIR"` \| `"POPULATION_FLUSH"` \| `"CSR_STRAIGHT"` \| `"EFFICACY_FULL_HOUSE"` \| `"MEDDRA_FIVE_OF_A_KIND"`)[]; `name`: `string`; `quota`: `number`; `session`: `"OPEN"` \| `"CLOSED"`; \}, \{ `hands`: (`"HIGH_TABLE"` \| `"TLF_PAIR"` \| `"TLF_TWO_PAIR"` \| `"POPULATION_FLUSH"` \| `"CSR_STRAIGHT"` \| `"EFFICACY_FULL_HOUSE"` \| `"MEDDRA_FIVE_OF_A_KIND"`)[]; `name`: `string`; `quota`: `number`; `session`: `"OPEN"` \| `"CLOSED"`; \}\]; \} \| \{ `clockHours`: `number`; `hands`: (`"HIGH_TABLE"` \| `"TLF_PAIR"` \| `"TLF_TWO_PAIR"` \| `"POPULATION_FLUSH"` \| `"CSR_STRAIGHT"` \| `"EFFICACY_FULL_HOUSE"` \| `"MEDDRA_FIVE_OF_A_KIND"`)[]; `hours`: `Record`\<`"TRACE"` \| `"PLAY_HAND"` \| `"DISCARD"` \| `"INSPECT"`, `number`\>; `kind`: `"FDA_IR"`; `letter?`: \{ `consequence`: `string`; `request`: `string`; \}; `questions`: `object`[]; \} \| \{ `kind`: `"CSR_LOCK"`; `packageName`: `string`; \}

A staged Boss encounter: this Blind is cleared stage by stage.

#### Union Members

##### Type Literal

\{ `kind`: `"DMC_DEFENSE"`; `rewards`: `object`[]; `stages`: \[\{ `hands`: (`"HIGH_TABLE"` \| `"TLF_PAIR"` \| `"TLF_TWO_PAIR"` \| `"POPULATION_FLUSH"` \| `"CSR_STRAIGHT"` \| `"EFFICACY_FULL_HOUSE"` \| `"MEDDRA_FIVE_OF_A_KIND"`)[]; `name`: `string`; `quota`: `number`; `session`: `"OPEN"` \| `"CLOSED"`; \}, \{ `hands`: (`"HIGH_TABLE"` \| `"TLF_PAIR"` \| `"TLF_TWO_PAIR"` \| `"POPULATION_FLUSH"` \| `"CSR_STRAIGHT"` \| `"EFFICACY_FULL_HOUSE"` \| `"MEDDRA_FIVE_OF_A_KIND"`)[]; `name`: `string`; `quota`: `number`; `session`: `"OPEN"` \| `"CLOSED"`; \}\]; \}

##### kind

> **kind**: `"DMC_DEFENSE"`

##### rewards

> **rewards**: `object`[]

The relics offered on victory; the player keeps one.

##### stages

> **stages**: \[\{ `hands`: (`"HIGH_TABLE"` \| `"TLF_PAIR"` \| `"TLF_TWO_PAIR"` \| `"POPULATION_FLUSH"` \| `"CSR_STRAIGHT"` \| `"EFFICACY_FULL_HOUSE"` \| `"MEDDRA_FIVE_OF_A_KIND"`)[]; `name`: `string`; `quota`: `number`; `session`: `"OPEN"` \| `"CLOSED"`; \}, \{ `hands`: (`"HIGH_TABLE"` \| `"TLF_PAIR"` \| `"TLF_TWO_PAIR"` \| `"POPULATION_FLUSH"` \| `"CSR_STRAIGHT"` \| `"EFFICACY_FULL_HOUSE"` \| `"MEDDRA_FIVE_OF_A_KIND"`)[]; `name`: `string`; `quota`: `number`; `session`: `"OPEN"` \| `"CLOSED"`; \}\]

***

##### Type Literal

\{ `clockHours`: `number`; `hands`: (`"HIGH_TABLE"` \| `"TLF_PAIR"` \| `"TLF_TWO_PAIR"` \| `"POPULATION_FLUSH"` \| `"CSR_STRAIGHT"` \| `"EFFICACY_FULL_HOUSE"` \| `"MEDDRA_FIVE_OF_A_KIND"`)[]; `hours`: `Record`\<`"TRACE"` \| `"PLAY_HAND"` \| `"DISCARD"` \| `"INSPECT"`, `number`\>; `kind`: `"FDA_IR"`; `letter?`: \{ `consequence`: `string`; `request`: `string`; \}; `questions`: `object`[]; \}

##### clockHours

> **clockHours**: `number`

Hours from the request to the response being due.

##### hands

> **hands**: (`"HIGH_TABLE"` \| `"TLF_PAIR"` \| `"TLF_TWO_PAIR"` \| `"POPULATION_FLUSH"` \| `"CSR_STRAIGHT"` \| `"EFFICACY_FULL_HOUSE"` \| `"MEDDRA_FIVE_OF_A_KIND"`)[]

The hands the FDA accepts as a response.

##### hours

> **hours**: `Record`\<`"TRACE"` \| `"PLAY_HAND"` \| `"DISCARD"` \| `"INSPECT"`, `number`\>

What each move costs in hours.

##### kind

> **kind**: `"FDA_IR"`

##### letter?

> `optional` **letter?**: `object`

How a Clinical Hold names the request and what the hold stops (#2331).
Absent means the End-of-Phase-2 request, which stops the move to Phase
III; a post-marketing round gives its post-approval wording.

###### letter.consequence

> **consequence**: `string`

What the program may not do on hold, e.g. "proceed to Phase III".

###### letter.request

> **request**: `string`

The request's name, e.g. "End-of-Phase-2 Information Request".

##### questions

> **questions**: `object`[]

***

##### Type Literal

\{ `kind`: `"CSR_LOCK"`; `packageName`: `string`; \}

##### kind

> **kind**: `"CSR_LOCK"`

##### packageName

> **packageName**: `string`

The package's name on the lock stamp and audit summary.

### events?

> `optional` **events?**: `object`[]

Scripted population changes during this Blind, in hand order.

### guidance?

> `optional` **guidance?**: `object`[]

Guidance cards granted to free tray slots, after the seals.

### handType

> **handType**: `"HIGH_TABLE"` \| `"TLF_PAIR"` \| `"TLF_TWO_PAIR"` \| `"POPULATION_FLUSH"` \| `"CSR_STRAIGHT"` \| `"EFFICACY_FULL_HOUSE"` \| `"MEDDRA_FIVE_OF_A_KIND"` = `HandTypeSchema`

### id

> **id**: `string` = `identifier`

### intro

> **intro**: `string`

The short intro card shown when the Blind starts.

### pinned?

> `optional` **pinned?**: `string`[]

The deck's scripted setup (#2055): card ids a run always deals first,
in deck order, so the setup the Blind is written around is in the
opening hand. A run shuffles the rest of the deck from its seed.
Absent means none.

### populationSnapshot

> **populationSnapshot**: `object` = `PopulationSnapshotSchema`

#### populationSnapshot.capturedAt

> **capturedAt**: `string`

#### populationSnapshot.id

> **id**: `string` = `identifier`

#### populationSnapshot.subjects

> **subjects**: `object`[]

#### populationSnapshot.version

> **version**: `number`

### rulebook

> **rulebook**: `object` = `SapRulebookSchema`

#### rulebook.id

> **id**: `string` = `identifier`

#### rulebook.meanPrecision

> **meanPrecision**: `number`

#### rulebook.percentPrecision

> **percentPrecision**: `number`

#### rulebook.populationAliases

> **populationAliases**: `object`[]

#### rulebook.populationSuit

> **populationSuit**: `"SCREENED"` \| `"ITT"` \| `"SAFETY"` \| `"PER_PROTOCOL"` \| `"FAS"` = `PopulationTypeSchema`

#### rulebook.roundingMode

> **roundingMode**: `"HALF_EVEN"` \| `"HALF_AWAY_FROM_ZERO"` \| `"TRUNCATE"` = `RoundingModeSchema`

#### rulebook.rules

> **rules**: `object`[]

#### rulebook.title

> **title**: `string`

### shells

> **shells**: `object`[]

### startingCpu

> **startingCpu**: `number` = `nonNegativeInt`

### summary

> **summary**: `string`

### table

> **table**: `object` = `TableRulesSchema`

#### table.handSize

> **handSize**: `number`

#### table.maxSelection

> **maxSelection**: `number`

#### table.startingCpu

> **startingCpu**: `number` = `nonNegativeInt`

### title

> **title**: `string`
