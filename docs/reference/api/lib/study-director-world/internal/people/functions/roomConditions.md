[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/study-director-world/internal/people](../README.md) / roomConditions

# Function: roomConditions()

> **roomConditions**(`map?`, `world?`): `Record`\<[`RoomId`](../../../types/type-aliases/RoomId.md), [`RoomCondition`](../../../types/interfaces/RoomCondition.md)\>

How every room on a map looks. Without a world every room is tidy; with
one, the office tells the story of the study (#1691): the conditions come
from `dressFloor`, the pure state-to-set-dressing mapping.

## Parameters

### map?

[`WorldMap`](../../../types/interfaces/WorldMap.md) = `CRO_FLOOR`

### world?

[`DressingInput`](../../dressing/type-aliases/DressingInput.md)

## Returns

`Record`\<[`RoomId`](../../../types/type-aliases/RoomId.md), [`RoomCondition`](../../../types/interfaces/RoomCondition.md)\>
