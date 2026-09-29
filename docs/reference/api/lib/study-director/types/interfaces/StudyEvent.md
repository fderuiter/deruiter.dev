[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-director/types](../README.md) / StudyEvent

# Interface: StudyEvent

## Properties

### body

> **body**: `string`

***

### day

> **day**: `number`

First day the event can appear.

***

### followUp?

> `optional` **followUp?**: `boolean`

Only appears when scheduled by an earlier decision.

***

### from

> **from**: `string`

Who is writing: a sponsor, site, team member or the boss.

***

### id

> **id**: `string`

***

### ifIgnored

> **ifIgnored**: [`Effects`](Effects.md)

Applied when the event expires unanswered.

***

### options

> **options**: [`EventOption`](EventOption.md)[]

***

### subject

> **subject**: `string`

***

### trigger?

> `optional` **trigger?**: (`state`) => `boolean`

Extra condition that must hold for the event to appear.

#### Parameters

##### state

[`StudyState`](StudyState.md)

#### Returns

`boolean`

***

### ttl

> **ttl**: `number`

Days the event stays actionable, counting its first day.

***

### urgency

> **urgency**: [`Urgency`](../type-aliases/Urgency.md)
