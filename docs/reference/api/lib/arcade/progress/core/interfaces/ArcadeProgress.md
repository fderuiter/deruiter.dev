[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/arcade/progress/core](../README.md) / ArcadeProgress

# Interface: ArcadeProgress

Persistent Arcade Progress Schema.

## Properties

### bestTags?

> `optional` **bestTags?**: `Record`\<`string`, [`RunTags`](../../../run-tags/interfaces/RunTags.md)\>

Map of gameId -> how the best score was played (#2547): its views,
inputs and assists. Unset for a best recorded without them, and absent
from storage until a game records one, so the bytes stay as they were.

***

### highScores

> **highScores**: `Record`\<`string`, `number`\>

Map of gameId -> best numeric score recorded

***

### migratedAt?

> `optional` **migratedAt?**: `number`

When the per-game and legacy score keys were folded in, once. Unset
until then.

***

### unlockedTrophies

> **unlockedTrophies**: `Record`\<`string`, `number`\>

Map of trophyId -> timestamp unlocked

***

### updatedAt

> **updatedAt**: `number`

Timestamp of last update
