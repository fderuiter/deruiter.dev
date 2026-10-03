[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/study-director-world/internal/channels](../README.md) / openAtDesk

# Function: openAtDesk()

> **openAtDesk**(`world`, `eventId`, `via`): [`WorldResult`](../../../types/type-aliases/WorldResult.md)\<\{ `dialogue`: [`EventDialogue`](../../../types/interfaces/EventDialogue.md); \}\>

Opens a message at the desk: reading mail or listening to voicemail takes
ten minutes, and returning a call takes the call's ten minutes.

## Parameters

### world

[`WorldState`](../../../types/interfaces/WorldState.md)

### eventId

`string`

### via

`"voicemail"` \| `"callback"` \| `"mail"`

## Returns

[`WorldResult`](../../../types/type-aliases/WorldResult.md)\<\{ `dialogue`: [`EventDialogue`](../../../types/interfaces/EventDialogue.md); \}\>
