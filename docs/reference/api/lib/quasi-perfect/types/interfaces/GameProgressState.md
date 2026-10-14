[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/quasi-perfect/types](../README.md) / GameProgressState

# Interface: GameProgressState

## Properties

### clearedVariants?

> `optional` **clearedVariants?**: `Record`\<`string` \| `number`, [`PuzzlerVariantKind`](../type-aliases/PuzzlerVariantKind.md)[]\>

Variants cleared per level id (#2090). Missing in progress saved before
variants existed, which reads as none cleared. Kept apart from
`completedLevels`, so a variant never changes a level's stars.

***

### completedLevels

> **completedLevels**: `Record`\<`string` \| `number`, [`LevelScore`](LevelScore.md)\>

***

### currentLevelIndex

> **currentLevelIndex**: `number`

***

### unlockedChapter?

> `optional` **unlockedChapter?**: `number`

Highest chapter the player has opened. Act 2 (chapter 4 on) opens after
an honest proof of the Act 1 capstone (#2091). Missing in older saves,
which read their capstone score instead.
