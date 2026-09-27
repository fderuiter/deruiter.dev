[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/trial-and-error/internal/table](../README.md) / ScheduledDeviation

# Interface: ScheduledDeviation

A protocol deviation drawn for a Blind, and the hand it lands after.

## Properties

### afterHands

> **afterHands**: `number`

***

### event

> **event**: `object`

#### afterHands

> **afterHands**: `number`[]

The hands it may land after; the draw picks one.

#### flavor

> **flavor**: `string`

One line of what the monitor found, in the study's words.

#### id

> **id**: `string` = `identifier`

#### name

> **name**: `string`

#### transition

> **transition**: `object` = `PopulationTransitionSchema`

##### transition.change

> **change**: `"JOIN"` \| `"LEAVE"` \| `"ENROLL"`

ENROLL adds `subject`, a subject the snapshot does not hold yet.

##### transition.description

> **description**: `string`

What happened, in the study's words.

##### transition.effectiveAt

> **effectiveAt**: `string`

##### transition.id

> **id**: `string` = `identifier`

##### transition.populations

> **populations**: (`"SCREENED"` \| `"ITT"` \| `"SAFETY"` \| `"PER_PROTOCOL"` \| `"FAS"`)[]

##### transition.reason

> **reason**: `"DROPOUT"` \| `"PROTOCOL_AMENDMENT"` \| `"SCREEN_FAILURE"` \| `"PROTOCOL_DEVIATION"` \| `"SITE_ACTIVATION"` = `TransitionReasonSchema`

##### transition.subject?

> `optional` **subject?**: `object`

The subject an ENROLL transition adds.

##### transition.subject.adverseEvents?

> `optional` **adverseEvents?**: `object`[]

Treatment-emergent adverse events. Absent means none were reported.

##### transition.subject.age

> **age**: `number`

##### transition.subject.arm

> **arm**: `"PLACEBO"` \| `"ACTIVE"` = `ArmSchema`

##### transition.subject.id

> **id**: `string` = `identifier`

##### transition.subject.populations

> **populations**: (`"SCREENED"` \| `"ITT"` \| `"SAFETY"` \| `"PER_PROTOCOL"` \| `"FAS"`)[]

##### transition.subject.sex

> **sex**: `"F"` \| `"M"`

##### transition.subjectId

> **subjectId**: `string` = `identifier`
