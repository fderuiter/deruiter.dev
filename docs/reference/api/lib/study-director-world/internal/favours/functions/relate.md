[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/study-director-world/internal/favours](../README.md) / relate

# Function: relate()

> **relate**(`world`, `memberId`, `action`): [`WorldResult`](../../../types/type-aliases/WorldResult.md)\<\{ `lines`: [`DialogueLine`](../../../types/interfaces/DialogueLine.md)[]; \}\>

One relationship action on a member: a coffee, a small job taken off
them, asking about them (which teaches their quirk once) or, from four
hearts, asking them to cover your last hour. Each has a limit; one the
rules do not allow is refused with lines saying why, and costs nothing.
Trust is only ever reported as a direction, never a number (ADR 0055).

## Parameters

### world

[`WorldState`](../../../types/interfaces/WorldState.md)

### memberId

`string`

### action

`"coffee"` \| `"favour"` \| `"askAbout"` \| `"cover"`

## Returns

[`WorldResult`](../../../types/type-aliases/WorldResult.md)\<\{ `lines`: [`DialogueLine`](../../../types/interfaces/DialogueLine.md)[]; \}\>
