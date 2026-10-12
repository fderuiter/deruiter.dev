[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/for-better-or-bulk/internal/receipt](../README.md) / availableCommitments

# Function: availableCommitments()

> **availableCommitments**(`state`): [`Commitment`](../../../types/type-aliases/Commitment.md)[]

The promises a break can carry in this plan: a commitment with at least one
category in the plan that is not yet all placed. A category already complete
is left out, so a promise cannot be kept for free (round 8, S6). The brothers'
dialog offers exactly these, and `validateDecision` refuses any other.

## Parameters

### state

[`GameState`](../../../types/interfaces/GameState.md)

## Returns

[`Commitment`](../../../types/type-aliases/Commitment.md)[]
