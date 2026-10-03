[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/study-director-world/internal/meetings](../README.md) / startMeeting

# Function: startMeeting()

> **startMeeting**(`world`, `kind`, `attendees`, `map?`): [`WorldResult`](../../../types/type-aliases/WorldResult.md)\<\{ `meeting`: [`Meeting`](../../../types/interfaces/Meeting.md); \}\>

Opens a meeting in the conference room. The player must be in the room;
attendees must be on the floor today, and they take their seats at the
table until the meeting ends. Nothing is spent until it ends.

## Parameters

### world

[`WorldState`](../../../types/interfaces/WorldState.md)

### kind

`"sponsor"` \| `"team"`

### attendees

readonly `string`[]

### map?

[`WorldMap`](../../../types/interfaces/WorldMap.md) = `CRO_FLOOR`

## Returns

[`WorldResult`](../../../types/type-aliases/WorldResult.md)\<\{ `meeting`: [`Meeting`](../../../types/interfaces/Meeting.md); \}\>
