[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/study-director-world/internal/people](../README.md) / placeTeam

# Function: placeTeam()

> **placeTeam**(`study`, `map?`): [`PersonPlacement`](../../../types/interfaces/PersonPlacement.md)[]

Where each team member stands: at a desk in their department's room, in
team order. This is the default placement; NPC schedules (#1688) will
move people through the day and pass their own placements instead.
Members whose role has no room on the map are left off it.

## Parameters

### study

[`StudyState`](../../../../study-director/types/interfaces/StudyState.md)

### map?

[`WorldMap`](../../../types/interfaces/WorldMap.md) = `CRO_FLOOR`

## Returns

[`PersonPlacement`](../../../types/interfaces/PersonPlacement.md)[]
