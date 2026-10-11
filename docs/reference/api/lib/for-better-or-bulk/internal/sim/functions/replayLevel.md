[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/for-better-or-bulk/internal/sim](../README.md) / replayLevel

# Function: replayLevel()

> **replayLevel**(`setup`, `frames`, `options?`): `object`

Rebuilds a level from its setup and recorded frames. Strict mode, the
default for shared runs, throws at a decision that does not fit the state it
lands on. Lenient mode drops such decisions with their reasons.

## Parameters

### setup

[`Setup`](../../../types/interfaces/Setup.md)

### frames

readonly [`Frame`](../../../types/interfaces/Frame.md)[]

### options?

#### mode?

`"strict"` \| `"lenient"`

## Returns

`object`

### dropped

> `readonly` **dropped**: readonly `object`[]

### state

> `readonly` **state**: [`GameState`](../../../types/interfaces/GameState.md)
