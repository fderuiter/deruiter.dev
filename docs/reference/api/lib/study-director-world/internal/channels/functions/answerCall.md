[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/study-director-world/internal/channels](../README.md) / answerCall

# Function: answerCall()

> **answerCall**(`world`, `eventId`): [`WorldResult`](../../../types/type-aliases/WorldResult.md)\<\{ `dialogue`: [`EventDialogue`](../../../types/interfaces/EventDialogue.md); \}\>

Answers the ringing phone: ten minutes on the call, after which the
caller waits for a decision. Choosing an option ends the call through
`decide`; hanging up without one leaves the message to call back about.

## Parameters

### world

[`WorldState`](../../../types/interfaces/WorldState.md)

### eventId

`string`

## Returns

[`WorldResult`](../../../types/type-aliases/WorldResult.md)\<\{ `dialogue`: [`EventDialogue`](../../../types/interfaces/EventDialogue.md); \}\>
