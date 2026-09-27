[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/trial-and-error/internal/table](../README.md) / TableView

# Interface: TableView

Everything the Card Table renders, derived purely from scenario and state.

## Properties

### accessLog

> **accessLog**: [`AccessRecord`](../../blinding/interfaces/AccessRecord.md)[]

The Blind's DMC access history, oldest first.

***

### amendmentPreviews

> **amendmentPreviews**: [`AmendmentPreview`](AmendmentPreview.md)[]

What each SAP Amendment in the tray would do if used, in tray order.

***

### auditLog

> **auditLog**: [`TraceRecord`](TraceRecord.md)[]

The Blind's inspection audit log, for end-of-Blind grading.

***

### bossIntro

> **bossIntro**: [`BossIntroView`](BossIntroView.md) \| `null`

The intro card for a Boss Blind; null for every other Blind.

***

### budget

> **budget**: `number`

***

### canDiscard

> **canDiscard**: `boolean`

***

### canInspect

> **canInspect**: `boolean`

***

### canPlay

> **canPlay**: `boolean`

***

### canRecompile

> **canRecompile**: `boolean`

***

### classification

> **classification**: \{ `handType`: `"HIGH_TABLE"` \| `"TLF_PAIR"` \| `"TLF_TWO_PAIR"` \| `"POPULATION_FLUSH"` \| `"CSR_STRAIGHT"` \| `"EFFICACY_FULL_HOUSE"` \| `"MEDDRA_FIVE_OF_A_KIND"`; `scoringCardIds`: `string`[]; \} \| `null`

***

### clock

> **clock**: [`ClockView`](ClockView.md) \| `null`

An FDA Information Request's clock, or null outside one.

***

### consumables

> **consumables**: [`Consumable`](../type-aliases/Consumable.md)[]

The consumable tray.

***

### consumableSlots

> **consumableSlots**: `number`

***

### cpuAllocation

> **cpuAllocation**: `number`

The CPU the Blind started with: its allocation plus ON_BLIND_START relics.

***

### crisis

> **crisis**: [`CrisisView`](CrisisView.md) \| `null`

The crisis to answer before the Blind can be played, if any.

***

### csrLock

> **csrLock**: [`CsrLockView`](CsrLockView.md) \| `null`

CSR Lock's sequence slots and lock, or null outside it.

***

### deckRemaining

> **deckRemaining**: `number`

***

### deviation

> **deviation**: [`DeviationView`](DeviationView.md) \| `null`

The protocol deviation that landed this Blind (#1087), or null.

***

### discardCost

> **discardCost**: `number`

What one discard costs, with any penalty.

***

### discardFree

> **discardFree**: `boolean`

The next discard is one of the Blind's free discards (#924).

***

### discardsAffordable

> **discardsAffordable**: `number`

***

### dmcCharter

> **dmcCharter**: `string` \| `null`

The charter the closed session is convened under, or null without a DMC.

***

### drawPile

> **drawPile**: `object`[]

The undealt deck, face down: opaque slots that carry no card data.

#### faceDown

> **faceDown**: `true`

#### slot

> **slot**: `string` = `identifier`

***

### emptySelected

> **emptySelected**: `string`[]

Selected blank shells with no analysis set allocated, in selection order.

***

### encounter

> **encounter**: [`EncounterView`](EncounterView.md) \| `null`

A staged encounter's progress, or null outside one.

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

### figureInspection

> **figureInspection**: [`FigureInspectionView`](FigureInspectionView.md) \| `null`

The open Inspect drawer's content when it holds a KM figure.

***

### firewall

> **firewall**: `boolean`

Treatment-arm values are face down (a DMC firewall).

***

### flushBrokenBy

> **flushBrokenBy**: `string`[]

Stale cards that alone stop the selection from being a Population Flush:
without them it would be one. Empty otherwise.

***

### hand

> **hand**: [`TableCardView`](TableCardView.md)[]

***

### handLevels

> **handLevels**: [`HandLevels`](../../../types/type-aliases/HandLevels.md)

The run's hand levels.

***

### handsAffordable

> **handsAffordable**: `number`

***

### handsLeft

> **handsLeft**: `number` \| `null`

Hands left under a hand limit, or null when there is none.

***

### handTable

> **handTable**: [`HandLevelRow`](../../hands/interfaces/HandLevelRow.md)[]

The run's hand table at current levels, weakest hand first, for Run Info.

***

### inspection

> **inspection**: [`TableInspectionView`](TableInspectionView.md) \| `null`

***

### invalidations

> **invalidations**: [`SnapshotInvalidation`](../../snapshots/interfaces/SnapshotInvalidation.md)[]

Every population transition so far this study, oldest first.

***

### lastTimeline

> **lastTimeline**: [`TimelineStep`](../../timeline/type-aliases/TimelineStep.md)[] \| `null`

The last played hand as an ordered scoring timeline, for playback.

***

### modifiers

> **modifiers**: `object`[]

Every modifier in force: the boss's, then any a crisis imposed.

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

### pendingViolations

> **pendingViolations**: `string`[]

Unblinded outputs the next hand played will score ×0 for.

***

### playBlockedReason

> **playBlockedReason**: `string` \| `null`

The stale or empty-shell alert when one of those blocks Play Hand, or
null. `playBlocker` carries every reason, with the cards and the fix.

***

### playBlocker

> **playBlocker**: [`PlayBlocker`](PlayBlocker.md) \| `null`

The first reason Play Hand would be refused, with its fix, or null when
the selection can be played. The same helper refuses `PLAY_HAND`.

***

### preview

> **preview**: \{ `base`: \{ `baseChips`: `number`; `baseMult`: `number`; `description`: `string`; `handType`: `"HIGH_TABLE"` \| `"TLF_PAIR"` \| `"TLF_TWO_PAIR"` \| `"POPULATION_FLUSH"` \| `"CSR_STRAIGHT"` \| `"EFFICACY_FULL_HOUSE"` \| `"MEDDRA_FIVE_OF_A_KIND"`; \}; `cardIds`: `string`[]; `chips`: \{ `base`: `number`; `outputs`: `number`; `relics`: `number`; `total`: `number`; \}; `finalMult`: `number`; `handType`: `"HIGH_TABLE"` \| `"TLF_PAIR"` \| `"TLF_TWO_PAIR"` \| `"POPULATION_FLUSH"` \| `"CSR_STRAIGHT"` \| `"EFFICACY_FULL_HOUSE"` \| `"MEDDRA_FIVE_OF_A_KIND"`; `ledger`: `object`[]; `level`: `number`; `mult`: \{ `base`: `number`; `cardsAndRules`: `number`; `relics`: `number`; `total`: `number`; \}; `ruleResults`: `object`[]; `score`: `number`; `xMult`: \{ `factors`: `object`[]; `product`: `number`; \}; `zeroRule`: \{ `ruleIds`: `string`[]; `triggered`: `boolean`; \}; \} \| `null`

Value of the selection from revealed findings only.

#### Union Members

##### Type Literal

\{ `base`: \{ `baseChips`: `number`; `baseMult`: `number`; `description`: `string`; `handType`: `"HIGH_TABLE"` \| `"TLF_PAIR"` \| `"TLF_TWO_PAIR"` \| `"POPULATION_FLUSH"` \| `"CSR_STRAIGHT"` \| `"EFFICACY_FULL_HOUSE"` \| `"MEDDRA_FIVE_OF_A_KIND"`; \}; `cardIds`: `string`[]; `chips`: \{ `base`: `number`; `outputs`: `number`; `relics`: `number`; `total`: `number`; \}; `finalMult`: `number`; `handType`: `"HIGH_TABLE"` \| `"TLF_PAIR"` \| `"TLF_TWO_PAIR"` \| `"POPULATION_FLUSH"` \| `"CSR_STRAIGHT"` \| `"EFFICACY_FULL_HOUSE"` \| `"MEDDRA_FIVE_OF_A_KIND"`; `ledger`: `object`[]; `level`: `number`; `mult`: \{ `base`: `number`; `cardsAndRules`: `number`; `relics`: `number`; `total`: `number`; \}; `ruleResults`: `object`[]; `score`: `number`; `xMult`: \{ `factors`: `object`[]; `product`: `number`; \}; `zeroRule`: \{ `ruleIds`: `string`[]; `triggered`: `boolean`; \}; \}

##### base

> **base**: `object` = `HandBaseScoreSchema`

The hand's base at that level: its level-1 base plus the level bonus.

###### base.baseChips

> **baseChips**: `number` = `nonNegativeInt`

###### base.baseMult

> **baseMult**: `number` = `nonNegativeInt`

###### base.description

> **description**: `string`

###### base.handType

> **handType**: `"HIGH_TABLE"` \| `"TLF_PAIR"` \| `"TLF_TWO_PAIR"` \| `"POPULATION_FLUSH"` \| `"CSR_STRAIGHT"` \| `"EFFICACY_FULL_HOUSE"` \| `"MEDDRA_FIVE_OF_A_KIND"` = `HandTypeSchema`

##### cardIds

> **cardIds**: `string`[]

##### chips

> **chips**: `object`

###### chips.base

> **base**: `number`

###### chips.outputs

> **outputs**: `number`

###### chips.relics

> **relics**: `number`

###### chips.total

> **total**: `number`

##### finalMult

> **finalMult**: `number`

##### handType

> **handType**: `"HIGH_TABLE"` \| `"TLF_PAIR"` \| `"TLF_TWO_PAIR"` \| `"POPULATION_FLUSH"` \| `"CSR_STRAIGHT"` \| `"EFFICACY_FULL_HOUSE"` \| `"MEDDRA_FIVE_OF_A_KIND"` = `HandTypeSchema`

##### ledger

> **ledger**: `object`[]

##### level

> **level**: `number`

The hand type's level this hand was scored at.

##### mult

> **mult**: `object`

###### mult.base

> **base**: `number`

###### mult.cardsAndRules

> **cardsAndRules**: `number`

###### mult.relics

> **relics**: `number`

###### mult.total

> **total**: `number`

##### ruleResults

> **ruleResults**: `object`[]

##### score

> **score**: `number`

##### xMult

> **xMult**: `object`

###### xMult.factors

> **factors**: `object`[]

###### xMult.product

> **product**: `number`

##### zeroRule

> **zeroRule**: `object`

###### zeroRule.ruleIds

> **ruleIds**: `string`[]

###### zeroRule.triggered

> **triggered**: `boolean`

***

`null`

***

### previewUnpenalizedMult

> **previewUnpenalizedMult**: `number`

***

### previewUnverified

> **previewUnverified**: `boolean`

Any selected card is inspectable but uninspected.

***

### questions

> **questions**: [`IrQuestionView`](IrQuestionView.md)[]

An FDA Information Request's targeted questions; empty outside one.

***

### quota

> **quota**: `number`

***

### refusedHands

> **refusedHands**: (`"HIGH_TABLE"` \| `"TLF_PAIR"` \| `"TLF_TWO_PAIR"` \| `"POPULATION_FLUSH"` \| `"CSR_STRAIGHT"` \| `"EFFICACY_FULL_HOUSE"` \| `"MEDDRA_FIVE_OF_A_KIND"`)[]

The hand types that cannot be played now because the encounter stage
does not accept them, weakest first. Empty when every hand is playable.

***

### relics

> **relics**: `object`[]

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

### relicSlots

> **relicSlots**: `number`

***

### reward

> **reward**: \{ `choices`: `object`[]; `claimed`: `string` \| `null`; \} \| `null`

A defended encounter's relic offer, or null.

***

### rulebook

> **rulebook**: `object`

The SAP rulebook in force, amendments applied.

#### id

> **id**: `string` = `identifier`

#### meanPrecision

> **meanPrecision**: `number`

#### percentPrecision

> **percentPrecision**: `number`

#### populationAliases

> **populationAliases**: `object`[]

#### populationSuit

> **populationSuit**: `"SCREENED"` \| `"ITT"` \| `"SAFETY"` \| `"PER_PROTOCOL"` \| `"FAS"` = `PopulationTypeSchema`

#### roundingMode

> **roundingMode**: `"HALF_EVEN"` \| `"HALF_AWAY_FROM_ZERO"` \| `"TRUNCATE"` = `RoundingModeSchema`

#### rules

> **rules**: `object`[]

#### title

> **title**: `string`

***

### scoreLog

> **scoreLog**: [`ScoreLogEntry`](ScoreLogEntry.md)[]

Every hand played this Blind, oldest first, read from the same timeline
the playback uses. The scores sum to the round score.

***

### session

> **session**: [`DmcSession`](../../blinding/type-aliases/DmcSession.md)

The DMC session in force.

***

### sessionRefusal

> **sessionRefusal**: `string` \| `null`

Why the session cannot change now, or null.

***

### sites

> **sites**: `object`[]

Trial sites the run has activated.

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

### snapshot

> **snapshot**: `object`

The current population snapshot.

#### capturedAt

> **capturedAt**: `string`

#### id

> **id**: `string` = `identifier`

#### version

> **version**: `number`

***

### spentCount

> **spentCount**: `number`

Cards dealt and since played or discarded: the discard stack.

***

### stageAccepts

> **stageAccepts**: (`"HIGH_TABLE"` \| `"TLF_PAIR"` \| `"TLF_TWO_PAIR"` \| `"POPULATION_FLUSH"` \| `"CSR_STRAIGHT"` \| `"EFFICACY_FULL_HOUSE"` \| `"MEDDRA_FIVE_OF_A_KIND"`)[] \| `null`

The hand types the current encounter stage accepts, weakest first, or
null outside a staged encounter or once its Blind is decided. The
selection is classified against them, so the preview and the scored
hand agree.

***

### staleSelected

> **staleSelected**: `string`[]

Selected cards that are stale, in selection order.
