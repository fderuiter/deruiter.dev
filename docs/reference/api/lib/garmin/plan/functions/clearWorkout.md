[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/garmin/plan](../README.md) / clearWorkout

# Function: clearWorkout()

> **clearWorkout**(`save`, `id`, `result`): [`PlanSave`](../interfaces/PlanSave.md)

The plan after clearing workout `id`: it is cleared (opening its paths),
the lives left and the points come back, and Race Day wins the medal.
A practice run never comes here. A locked node or a hut changes nothing.

## Parameters

### save

[`PlanSave`](../interfaces/PlanSave.md)

### id

[`PlanNodeId`](../type-aliases/PlanNodeId.md)

### result

[`WorkoutResult`](../interfaces/WorkoutResult.md)

## Returns

[`PlanSave`](../interfaces/PlanSave.md)
