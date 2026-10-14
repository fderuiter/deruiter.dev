[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/garmin-plan](../README.md) / takeHutItem

# Function: takeHutItem()

> **takeHutItem**(`save`, `id`, `slot`): [`HutPick`](../interfaces/HutPick.md)

Takes the item behind `slot` (0 to 2) at hut `id`: the hut is cleared and
the item goes into the bag when there is room. A hut gives one item, and
only when it is open.

## Parameters

### save

[`PlanSave`](../interfaces/PlanSave.md)

### id

[`PlanNodeId`](../type-aliases/PlanNodeId.md)

### slot

`number`

## Returns

[`HutPick`](../interfaces/HutPick.md)
