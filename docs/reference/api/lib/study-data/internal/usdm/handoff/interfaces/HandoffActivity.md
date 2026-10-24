[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/usdm/handoff](../README.md) / HandoffActivity

# Interface: HandoffActivity

What the run does with one activity of the handed-off study.

## Properties

### domain

> `readonly` **domain**: `string` \| `null`

***

### id

> `readonly` **id**: `string`

***

### name

> `readonly` **name**: `string`

***

### reason?

> `readonly` `optional` **reason?**: `"no-domain"` \| `"domain-not-generated"` \| `"no-modelled-tests"`

Why the activity is not tabulated. Absent for tabulated activities.

***

### skippedConcepts

> `readonly` **skippedConcepts**: readonly [`HandoffSkippedConcept`](HandoffSkippedConcept.md)[]

***

### tabulated

> `readonly` **tabulated**: `boolean`

***

### tests

> `readonly` **tests**: readonly [`HandoffTest`](HandoffTest.md)[]
