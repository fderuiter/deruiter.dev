[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/study-director-world/internal/dialogue](../README.md) / dialogueLines

# Function: dialogueLines()

> **dialogueLines**(`world`, `memberId`): [`DialogueLine`](../../../types/interfaces/DialogueLine.md)[]

What a member says when the player talks to them: a pure function of the
study, their trust and what the player already knows. Every line carries
information, a warning, an opportunity, a relationship signal or a joke.
A line whose fact the player already has is dropped rather than repeated.

## Parameters

### world

[`WorldState`](../../../types/interfaces/WorldState.md)

### memberId

`string`

## Returns

[`DialogueLine`](../../../types/interfaces/DialogueLine.md)[]
