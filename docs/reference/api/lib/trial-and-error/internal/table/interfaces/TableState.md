[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/trial-and-error/internal/table](../README.md) / TableState

# Interface: TableState

Serializable Card Table state. Contains no derived or browser data.

## Properties

### accessLog

> **accessLog**: [`AccessRecord`](../../blinding/interfaces/AccessRecord.md)[]

Every DMC access this Blind: structural QC, unblinding, session changes.

***

### allocations

> **allocations**: `Record`\<`string`, [`PopulationType`](../../../types/type-aliases/PopulationType.md)\>

The analysis set allocated to each blank shell in hand. Final once set.

***

### amendments

> **amendments**: `number`

Protocol amendments filed against a locked package this Blind.

***

### answered

> **answered**: `string`[]

The FDA Information Request's questions answered so far, in order.

***

### auditLog

> **auditLog**: [`TraceRecord`](TraceRecord.md)[]

Every table cell traced to its Listing this Blind, in trace order.

***

### budget

> **budget**: `number`

The study budget: the shop's money.

***

### campaign

> **campaign**: [`CampaignRecord`](../../package/interfaces/CampaignRecord.md)[]

The Blinds the campaign has cleared, oldest first; this one once cleared.

***

### clock

> **clock**: `number` \| `null`

Hours left on an FDA Information Request's clock; null outside one.

***

### compiledUnder

> **compiledUnder**: `Record`\<`string`, `string`\>

Outputs in hand compiled under an earlier SAP rulebook than the one in
force, by the rulebook id they were compiled under. They are stale until
recompiled; an output with no entry was compiled under the one in force.

***

### consumables

> **consumables**: [`Consumable`](../type-aliases/Consumable.md)[]

The consumable tray, at most `CONSUMABLE_SLOTS`.

***

### cpu

> **cpu**: [`CpuLedger`](../../cpu/interfaces/CpuLedger.md)

***

### crisis

> **crisis**: \{ `choices`: `object`[]; `description`: `string`; `id`: `string`; `name`: `string`; \} \| `null`

The crisis drawn for this Blind, until the player answers it.

***

### crisisResolution

> **crisisResolution**: \{ `choiceId`: `string`; `crisisId`: `string`; \} \| `null`

How this Blind's crisis was answered, once it has been.

***

### deckIndex

> **deckIndex**: `number`

Index of the next undealt card in the scenario deck.

***

### discards

> **discards**: `number`

***

### drafts

> **drafts**: `Record`\<`string`, [`StagedTable`](../../../types/type-aliases/StagedTable.md)\>

Cards in hand whose draft was compiled against a later snapshot.

***

### enrollments

> **enrollments**: `object`[]

Site enrollments that land after this Blind's first hand.

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

### hand

> **hand**: `string`[]

Card ids in hand, in deal order.

***

### handLevels

> **handLevels**: [`HandLevels`](../../../types/type-aliases/HandLevels.md)

The run's hand levels, carried from Blind to Blind.

***

### handsPlayed

> **handsPlayed**: `number`

***

### inspecting

> **inspecting**: `string` \| `null`

The card whose Inspect drawer is open.

***

### inspections

> **inspections**: `Record`\<`string`, [`InspectionState`](../../inspection/interfaces/InspectionState.md)\>

Review progress per card, present once the card has been paid to inspect.

***

### invalidations

> **invalidations**: [`SnapshotInvalidation`](../../snapshots/interfaces/SnapshotInvalidation.md)[]

One record per population transition so far this study.

***

### lastEvent

> **lastEvent**: [`TableEvent`](TableEvent.md) \| `null`

***

### lastPlay

> **lastPlay**: [`PlayedHand`](PlayedHand.md) \| `null`

***

### lock

> **lock**: [`PackageLock`](PackageLock.md) \| `null`

The locked CSR package, once a CSR Lock Blind is won.

***

### modifiers

> **modifiers**: `object`[]

Modifiers crisis choices imposed on this Blind, besides its boss.

#### debuffType

> **debuffType**: `"DISABLE_POPULATION"` \| `"HAND_LIMIT"` \| `"DISCARD_PENALTY"` \| `"BLIND_FIREWALL"` = `BossDebuffTypeSchema`

#### description

> **description**: `string`

#### disabledPopulations?

> `optional` **disabledPopulations?**: (`"SCREENED"` \| `"ITT"` \| `"SAFETY"` \| `"PER_PROTOCOL"` \| `"FAS"`)[]

#### discardCpuPenalty?

> `optional` **discardCpuPenalty?**: `number`

#### id

> **id**: `string` = `identifier`

#### maxHandsAllowed?

> `optional` **maxHandsAllowed?**: `number`

#### name

> **name**: `string`

***

### opening

> **opening**: `object`

How much of `snapshots` and `invalidations` predates this Blind, the
inventory it started with, and its crisis, so a restart returns to
exactly that.

#### crisis

> **crisis**: \{ `choices`: `object`[]; `description`: `string`; `id`: `string`; `name`: `string`; \} \| `null`

#### invalidations

> **invalidations**: `number`

#### inventory

> **inventory**: [`Inventory`](Inventory.md)

#### snapshots

> **snapshots**: `number`

***

### pendingViolations

> **pendingViolations**: `string`[]

Unauthorized unblindings the next hand played will answer for with ×0.

***

### plays

> **plays**: [`PlayedHand`](PlayedHand.md)[]

Every hand played this Blind, oldest first. The last is `lastPlay`.

***

### provenance

> **provenance**: `Record`\<`string`, [`SnapshotRef`](../../../types/type-aliases/SnapshotRef.md)\>

The snapshot each card in hand was compiled against.

***

### relics

> **relics**: `object`[]

SOP relics the run has earned; each scores in every hand.

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

#### trigger?

> `optional` **trigger?**: \{ `phase`: `"ON_HAND_PLAYED"`; `requires?`: `"FIGURE_IN_HAND"` \| `"NO_REDLINES"`; \} \| \{ `cardType?`: `"TABLE"` \| `"LISTING"` \| `"FIGURE"` \| `"SUBJECT_TOKEN"`; `phase`: `"ON_CARD_SCORED"`; `population?`: `"SCREENED"` \| `"ITT"` \| `"SAFETY"` \| `"PER_PROTOCOL"` \| `"FAS"`; `qcPassedOnly?`: `boolean`; `retrigger?`: `boolean`; \} \| \{ `freeDiscards`: `number`; `phase`: `"ON_DISCARD"`; \} \| \{ `cpu`: `number`; `phase`: `"ON_BLIND_START"`; \}

##### Union Members

###### Type Literal

\{ `phase`: `"ON_HAND_PLAYED"`; `requires?`: `"FIGURE_IN_HAND"` \| `"NO_REDLINES"`; \}

***

###### Type Literal

\{ `cardType?`: `"TABLE"` \| `"LISTING"` \| `"FIGURE"` \| `"SUBJECT_TOKEN"`; `phase`: `"ON_CARD_SCORED"`; `population?`: `"SCREENED"` \| `"ITT"` \| `"SAFETY"` \| `"PER_PROTOCOL"` \| `"FAS"`; `qcPassedOnly?`: `boolean`; `retrigger?`: `boolean`; \}

###### cardType?

> `optional` **cardType?**: `"TABLE"` \| `"LISTING"` \| `"FIGURE"` \| `"SUBJECT_TOKEN"`

###### phase

> **phase**: `"ON_CARD_SCORED"`

###### population?

> `optional` **population?**: `"SCREENED"` \| `"ITT"` \| `"SAFETY"` \| `"PER_PROTOCOL"` \| `"FAS"`

###### qcPassedOnly?

> `optional` **qcPassedOnly?**: `boolean`

Only cards stamped QC ✓: every cell reviewed, no open redline.

###### retrigger?

> `optional` **retrigger?**: `boolean`

***

###### Type Literal

\{ `freeDiscards`: `number`; `phase`: `"ON_DISCARD"`; \}

***

###### Type Literal

\{ `cpu`: `number`; `phase`: `"ON_BLIND_START"`; \}

***

### rewardClaimed

> **rewardClaimed**: `string` \| `null`

The relic taken as this Blind's encounter reward, once taken.

***

### roundScore

> **roundScore**: `number`

***

### sapAmendments

> **sapAmendments**: `object`[]

SAP Amendments the run has used, in order (#1086).

#### bonusDelta

> **bonusDelta**: `number`

+Mult added to a correction against the amended rule.

#### category

> **category**: `"PRECISION"` \| `"ROUNDING"` \| `"VALUE"`

The rule category it amends. Fatal rules are never amended.

#### code

> **code**: `string`

The suffix the amended rulebook's id takes, e.g. "AR".

#### description

> **description**: `string`

#### id

> **id**: `string` = `identifier`

#### name

> **name**: `string`

The short name printed on the card.

#### penaltyDelta

> **penaltyDelta**: `number`

+Mult added to what a standing redline against it costs.

#### sellValue

> **sellValue**: `number` = `nonNegativeInt`

What selling it adds to the study budget.

***

### scenarioId

> **scenarioId**: `string`

***

### seals

> **seals**: `Record`\<`string`, [`FootnoteSeal`](../../../types/type-aliases/FootnoteSeal.md)[]\>

Footnote seals affixed to each card in hand, in the order applied.

***

### selected

> **selected**: `string`[]

Selected card ids, in selection order (at most `maxSelection`).

***

### session

> **session**: [`DmcSession`](../../blinding/type-aliases/DmcSession.md)

The DMC session in force. Blinded outputs are face down in OPEN.

***

### sites

> **sites**: `object`[]

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

***

### snapshots

> **snapshots**: `object`[]

Every population snapshot version so far, oldest first. The last is current.

#### capturedAt

> **capturedAt**: `string`

#### id

> **id**: `string` = `identifier`

#### subjects

> **subjects**: `object`[]

#### version

> **version**: `number`

***

### stage

> **stage**: `number`

A staged encounter's current stage, from 0.

***

### stageScores

> **stageScores**: `number`[]

Each encounter stage's score so far. Empty outside an encounter.

***

### status

> **status**: [`DeskStatus`](../../desk/type-aliases/DeskStatus.md)

***

### structuralQc

> **structuralQc**: `string`[]

Blinded outputs in hand that have had structural QC, in order.

***

### unblinded

> **unblinded**: `string`[]

Blinded outputs revealed by an unauthorized unblinding. They stay face up.
