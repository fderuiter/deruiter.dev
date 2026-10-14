[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/quasi-perfect/types](../README.md) / LevelScore

# Interface: LevelScore

## Properties

### completed

> **completed**: `boolean`

***

### golfed?

> `optional` **golfed?**: `boolean`

True once the level has been proved honestly in no more tactics than its
par (#2059). Missing in progress saved before the badge existed, which
reads as not golfed.

***

### levelId

> **levelId**: `string` \| `number`

***

### morality

> **morality**: `number`

***

### remainingRam

> **remainingRam**: `number`

***

### stars

> **stars**: `number`

***

### steps?

> `optional` **steps?**: `number`

Tactics the run applied; missing in older saves.

***

### timestamp

> **timestamp**: `number`

***

### usedSorry

> **usedSorry**: `boolean`
