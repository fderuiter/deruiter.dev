[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/study-director-world/internal/team](../README.md) / positionAt

# Function: positionAt()

> **positionAt**(`schedule`, `minute`, `map?`): \{ `activity`: [`PersonActivity`](../../../types/type-aliases/PersonActivity.md); `facing`: `"up"` \| `"down"` \| `"left"` \| `"right"`; `room`: [`RoomId`](../../../types/type-aliases/RoomId.md); `tile`: [`TilePoint`](../../../types/interfaces/TilePoint.md); \} \| `null`

Where a member is at a minute of the day, from their schedule: walking
between places along the shortest path, four tiles a minute, or at the
place a block puts them. Null before they arrive and after they leave.

## Parameters

### schedule

[`DaySchedule`](../../../types/interfaces/DaySchedule.md)

### minute

`number`

### map?

[`WorldMap`](../../../types/interfaces/WorldMap.md) = `CRO_FLOOR`

## Returns

\{ `activity`: [`PersonActivity`](../../../types/type-aliases/PersonActivity.md); `facing`: `"up"` \| `"down"` \| `"left"` \| `"right"`; `room`: [`RoomId`](../../../types/type-aliases/RoomId.md); `tile`: [`TilePoint`](../../../types/interfaces/TilePoint.md); \} \| `null`
