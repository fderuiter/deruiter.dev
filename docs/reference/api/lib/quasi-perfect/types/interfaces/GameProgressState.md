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
