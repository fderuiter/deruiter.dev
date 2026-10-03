[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/study-director-world/internal/channels](../README.md) / decide

# Function: decide()

> **decide**(`world`, `eventId`, `optionId`, `via?`): [`WorldResult`](../../../types/type-aliases/WorldResult.md)\<\{ `lines`: [`DialogueLine`](../../../types/interfaces/DialogueLine.md)[]; `record`: [`DecisionRecord`](../../../../study-director/types/interfaces/DecisionRecord.md); \}\>

Chooses one of an event's options: the translation of a dialogue choice
into the domain. It calls `resolveEvent`, which records the decision
through `resolveDecision`, undocumented: writing it up is a separate
twenty minutes at the desk, and until then it counts as documentation
debt. Answering a team member's message is follow-through and builds
their trust. Answering someone who stopped you in the hallway takes the
conversation's ten minutes; the phone, the desk and a talk have already
spent theirs.

## Parameters

### world

[`WorldState`](../../../types/interfaces/WorldState.md)

### eventId

`string`

### optionId

`string`

### via?

[`EventVia`](../../../types/type-aliases/EventVia.md) = `"phone"`

## Returns

[`WorldResult`](../../../types/type-aliases/WorldResult.md)\<\{ `lines`: [`DialogueLine`](../../../types/interfaces/DialogueLine.md)[]; `record`: [`DecisionRecord`](../../../../study-director/types/interfaces/DecisionRecord.md); \}\>
