[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/study-director-world/internal/channels](../README.md) / channelFor

# Function: channelFor()

> **channelFor**(`world`, `event`): [`Channel`](../../../types/type-aliases/Channel.md)

How an event reaches the player. A team member's message comes in person;
sponsors, the boss, investigators, coordinators and the lab phone; the
rest is mail on the desk.

## Parameters

### world

[`WorldState`](../../../types/interfaces/WorldState.md)

### event

`Pick`\<[`StudyEvent`](../../../../study-director/types/interfaces/StudyEvent.md), `"from"`\>

## Returns

[`Channel`](../../../types/type-aliases/Channel.md)
