[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/for-better-or-bulk/internal/level](../README.md) / createLevel

# Function: createLevel()

> **createLevel**(`setup`): [`GameState`](../../../types/interfaces/GameState.md)

A fresh level at 9:00. Throws a RangeError for a setup `validateSetup`
rejects, so a bad shared link fails loudly instead of playing a different
game.

## Parameters

### setup

[`Setup`](../../../types/interfaces/Setup.md)

## Returns

[`GameState`](../../../types/interfaces/GameState.md)
