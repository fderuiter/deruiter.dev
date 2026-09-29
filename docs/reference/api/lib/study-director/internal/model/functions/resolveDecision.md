[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/study-director/internal/model](../README.md) / resolveDecision

# Function: resolveDecision()

> **resolveDecision**(`state`, `input`): [`ActionResult`](../../../types/type-aliases/ActionResult.md)

Resolves a decision: spends attention, applies its effects and records it.
A decision the player does not document adds documentation debt, which the
inspection later replays (ADR 0054).

## Parameters

### state

[`StudyState`](../../../types/interfaces/StudyState.md)

### input

[`DecisionInput`](../../../types/interfaces/DecisionInput.md)

## Returns

[`ActionResult`](../../../types/type-aliases/ActionResult.md)
