[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-director/types](../README.md) / Effects

# Interface: Effects

What a decision or event changes. Everything is optional.

## Properties

### meters?

> `optional` **meters?**: `Partial`\<`Record`\<`"client"` \| `"integrity"` \| `"compliance"` \| `"timeline"` \| `"budget"` \| `"team"`, `number`\>\>

Direct meter adjustments, added to the derived meters.

***

### sites?

> `optional` **sites?**: `object`[]

#### burden?

> `optional` **burden?**: `number`

#### deviations?

> `optional` **deviations?**: `number`

#### eligibilityConcerns?

> `optional` **eligibilityConcerns?**: `number`

#### openQueries?

> `optional` **openQueries?**: `number`

#### siteId

> **siteId**: `string`

#### trainingCurrent?

> `optional` **trainingCurrent?**: `boolean`

#### unsignedSource?

> `optional` **unsignedSource?**: `number`

***

### slipDays?

> `optional` **slipDays?**: `number`

Days added to the schedule (negative shortens it).

***

### spend?

> `optional` **spend?**: `number`

Dollars spent (positive) or saved (negative).

***

### workload?

> `optional` **workload?**: `object`[]

#### delta

> **delta**: `number`

#### memberId

> **memberId**: `string`
