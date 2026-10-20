[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/garmin/plan](../README.md) / moveCursor

# Function: moveCursor()

> **moveCursor**(`save`, `from`, `dir`): [`PlanNodeId`](../type-aliases/PlanNodeId.md)

The node the cursor moves to from `from` in `dir`: the neighbour that way,
when a path joins them and it is open. Otherwise the cursor stays.

## Parameters

### save

[`PlanSave`](../interfaces/PlanSave.md)

### from

[`PlanNodeId`](../type-aliases/PlanNodeId.md)

### dir

[`MapDirection`](../type-aliases/MapDirection.md)

## Returns

[`PlanNodeId`](../type-aliases/PlanNodeId.md)
