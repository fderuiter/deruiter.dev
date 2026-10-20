[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/garmin/badges](../README.md) / BadgeSave

# Interface: BadgeSave

Everything kept between runs.

## Properties

### badges

> **badges**: `Partial`\<`Record`\<[`BadgeId`](../type-aliases/BadgeId.md), `string`\>\>

Each badge earned, and the day it was earned.

***

### lastDnfDay

> **lastDnfDay**: `string` \| `null`

The last day a run ended in a DNF, for Couch to 5K.

***

### runs

> **runs**: [`RunEntry`](RunEntry.md)[]

The last runs, newest first.

***

### streak

> **streak**: [`Streak`](Streak.md)
