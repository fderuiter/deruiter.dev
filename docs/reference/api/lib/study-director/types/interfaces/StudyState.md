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

### day

> **day**: `number`

***

### documentationDebt

> **documentationDebt**: `number`

Documentation debt, 0 to 100.

***

### draws

> **draws**: `number`

Next unused draw index for the seeded PRNG.

***

### log

> **log**: [`DecisionRecord`](DecisionRecord.md)[]

***

### queriesRaised

> **queriesRaised**: `number`

Total queries ever raised, for data-cleanliness reporting.

***

### seed

> **seed**: `string`

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
