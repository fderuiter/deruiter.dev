[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-director/types](../README.md) / StudyState

# Interface: StudyState

## Properties

### adjust

> **adjust**: `Record`\<[`MeterId`](../type-aliases/MeterId.md), `number`\>

Direct meter adjustments accumulated from decisions.

***

### attention

> **attention**: `number`

Attention left today.

***

### budget?

> `optional` **budget?**: [`StudyBudget`](../type-aliases/StudyBudget.md)

How the player's day is budgeted. Attention points (the default, and
every save made before ADR 0055) or the world's clock, in which case the
domain records attention costs without enforcing them.

***

### day

> **day**: `number`

***

### difficulty?

> `optional` **difficulty?**: `"calm"` \| `"standard"` \| `"rescue"`

***

### documentationDebt

> **documentationDebt**: `number`

Documentation debt, 0 to 100.

***

### draws

> **draws**: `number`

Next unused draw index for the seeded PRNG.

***

### flags

> **flags**: `string`[]

Story flags set by decisions, read by later events.

***

### handled

> **handled**: `string`[]

Events that were answered or expired.

***

### log

> **log**: [`DecisionRecord`](DecisionRecord.md)[]

***

### queriesRaised

> **queriesRaised**: `number`

Total queries ever raised, for data-cleanliness reporting.

***

### routine

> **routine**: `number`

Attention today's routine work took before any decision.

***

### scheduled

> **scheduled**: `object`[]

Follow-up events scheduled by earlier decisions.

#### day

> **day**: `number`

#### eventId

> **eventId**: `string`

***

### seed

> **seed**: `string`

***

### seen

> **seen**: `Record`\<`string`, `number`\>

Day each event first reached the inbox.

***

### setup

> **setup**: [`StudySetup`](StudySetup.md)

***

### sites

> **sites**: [`SiteState`](SiteState.md)[]

***

### slipDays

> **slipDays**: `number`

***

### spent

> **spent**: `number`

***

### status

> **status**: `"complete"` \| `"running"`

***

### team

> **team**: [`TeamMember`](TeamMember.md)[]

***

### version

> **version**: `1`
