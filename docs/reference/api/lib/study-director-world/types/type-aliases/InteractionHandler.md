[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-director-world/types](../README.md) / InteractionHandler

# Type Alias: InteractionHandler

> **InteractionHandler** = (`world`, `target`) => [`InteractionOutcome`](../interfaces/InteractionOutcome.md) \| `null`

Handles E on one kind of target. Return null to fall through to the
default. Later layers (dialogue, events, site visits) plug in here.

## Parameters

### world

[`WorldState`](../interfaces/WorldState.md)

### target

[`WorldTarget`](WorldTarget.md)

## Returns

[`InteractionOutcome`](../interfaces/InteractionOutcome.md) \| `null`
