[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/study-director-world/internal/dialogue](../README.md) / talk

# Function: talk()

> **talk**(`world`, `memberId`): [`WorldResult`](../../../types/type-aliases/WorldResult.md)\<\{ `lines`: [`DialogueLine`](../../../types/interfaces/DialogueLine.md)[]; \}\>

Talks to a member: ten minutes of the player's day. What they say is
worked out before the talk, any facts are recorded as seen, and the first
talk of the day builds a little trust, which the last line reports.

## Parameters

### world

[`WorldState`](../../../types/interfaces/WorldState.md)

### memberId

`string`

## Returns

[`WorldResult`](../../../types/type-aliases/WorldResult.md)\<\{ `lines`: [`DialogueLine`](../../../types/interfaces/DialogueLine.md)[]; \}\>
