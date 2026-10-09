[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/study-director-world/internal/rhythm](../README.md) / choosePriority

# Function: choosePriority()

> **choosePriority**(`world`, `priority`): [`WorldResult`](../../../types/type-aliases/WorldResult.md)\<\{ `changed`: `boolean`; \}\>

Chooses today's priority. It is a promise, so it can be made once a day:
choosing again, or after the day has started to go wrong, changes nothing.

## Parameters

### world

[`WorldState`](../../../types/interfaces/WorldState.md)

### priority

`"desk"` \| `"sites"` \| `"people"`

## Returns

[`WorldResult`](../../../types/type-aliases/WorldResult.md)\<\{ `changed`: `boolean`; \}\>
