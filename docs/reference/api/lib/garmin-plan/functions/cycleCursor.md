[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/garmin-plan](../README.md) / cycleCursor

# Function: cycleCursor()

> **cycleCursor**(`save`, `from`, `step`): [`PlanNodeId`](../type-aliases/PlanNodeId.md)

The open node `step` places from `from` in plan order, wrapping round: the
watch's UP and DOWN buttons step through the map this way.

## Parameters

### save

[`PlanSave`](../interfaces/PlanSave.md)

### from

[`PlanNodeId`](../type-aliases/PlanNodeId.md)

### step

`-1` \| `1`

## Returns

[`PlanNodeId`](../type-aliases/PlanNodeId.md)
