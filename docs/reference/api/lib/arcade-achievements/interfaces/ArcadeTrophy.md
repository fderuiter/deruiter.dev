[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/arcade-achievements](../README.md) / ArcadeTrophy

# Interface: ArcadeTrophy

Trophy definition structure.

## Properties

### category

> **category**: `"gameplay"` \| `"milestone"` \| `"mastery"` \| `"cross_game"`

***

### conditionDescription

> **conditionDescription**: `string`

***

### description

> **description**: `string`

***

### gameId

> **gameId**: `string`

***

### icon

> **icon**: `string`

***

### id

> **id**: `string`

***

### milestone?

> `optional` **milestone?**: `string`

A named moment in play (an act cleared, every level proven) that unlocks
this trophy through recordArcadeMilestone. A trophy with a milestone and
no targetScore unlocks only from play, never from a score (#2047).

***

### subtitle

> **subtitle**: `string`

***

### targetScore?

> `optional` **targetScore?**: `number`

***

### title

> **title**: `string`
