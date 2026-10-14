[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/quasi-perfect/progress](../README.md) / withUnlockedChapter

# Function: withUnlockedChapter()

> **withUnlockedChapter**(`progress`): [`GameProgressState`](../../types/interfaces/GameProgressState.md)

Record that Act 2 is open once the capstone is proved honestly. Progress
that already records it, or does not qualify, comes back unchanged.

## Parameters

### progress

[`GameProgressState`](../../types/interfaces/GameProgressState.md)

Campaign progress after a run was saved.

## Returns

[`GameProgressState`](../../types/interfaces/GameProgressState.md)

Progress with `unlockedChapter` raised to Act 2 when earned.
