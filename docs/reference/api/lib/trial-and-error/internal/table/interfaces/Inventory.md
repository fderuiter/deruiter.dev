[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/trial-and-error/internal/table](../README.md) / Inventory

# Interface: Inventory

What the player carries between Blinds besides the study: the consumable
tray, the study budget and the run's hand levels. The Procurement Shop
spends and fills it. Absent hand levels mean a fresh run's.

## Properties

### budget

> **budget**: `number`

***

### campaign?

> `optional` **campaign?**: [`CampaignRecord`](../../package/interfaces/CampaignRecord.md)[]

The Blinds the campaign has cleared so far, oldest first.

***

### consumables

> **consumables**: [`Consumable`](../type-aliases/Consumable.md)[]

***

### enrollments?

> `optional` **enrollments?**: `object`[]

Site enrollments waiting for the next Blind's first hand.

#### change

> **change**: `"JOIN"` \| `"LEAVE"` \| `"ENROLL"`

ENROLL adds `subject`, a subject the snapshot does not hold yet.

#### description

> **description**: `string`

What happened, in the study's words.

#### effectiveAt

> **effectiveAt**: `string`

#### id

> **id**: `string` = `identifier`

#### populations

> **populations**: (`"SCREENED"` \| `"ITT"` \| `"SAFETY"` \| `"PER_PROTOCOL"` \| `"FAS"`)[]

#### reason

> **reason**: `"DROPOUT"` \| `"PROTOCOL_AMENDMENT"` \| `"SCREEN_FAILURE"` \| `"PROTOCOL_DEVIATION"` \| `"SITE_ACTIVATION"` = `TransitionReasonSchema`

#### subject?

> `optional` **subject?**: `object`

The subject an ENROLL transition adds.

##### subject.adverseEvents?

> `optional` **adverseEvents?**: `object`[]

Treatment-emergent adverse events. Absent means none were reported.

##### subject.age

> **age**: `number`

##### subject.arm

> **arm**: `"PLACEBO"` \| `"ACTIVE"` = `ArmSchema`

##### subject.id

> **id**: `string` = `identifier`

##### subject.populations

> **populations**: (`"SCREENED"` \| `"ITT"` \| `"SAFETY"` \| `"PER_PROTOCOL"` \| `"FAS"`)[]

##### subject.sex

> **sex**: `"F"` \| `"M"`

#### subjectId

> **subjectId**: `string` = `identifier`

***

### handLevels?

> `optional` **handLevels?**: `Record`\<`"HIGH_TABLE"` \| `"TLF_PAIR"` \| `"TLF_TWO_PAIR"` \| `"POPULATION_FLUSH"` \| `"CSR_STRAIGHT"` \| `"EFFICACY_FULL_HOUSE"` \| `"MEDDRA_FIVE_OF_A_KIND"`, \{ `level`: `number`; `playedCount`: `number`; \}\>

***

### relics?

> `optional` **relics?**: `object`[]

SOP relics the run has earned.

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

***

### sites?

> `optional` **sites?**: `object`[]

Trial sites the run has activated; each adds its Chips to every hand.

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

#### subjects

> **subjects**: `object`[]

The subjects the site enrolls. Their ids must be new to the study.
