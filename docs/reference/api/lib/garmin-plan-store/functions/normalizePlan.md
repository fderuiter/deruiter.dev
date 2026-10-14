[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/garmin-plan-store](../README.md) / normalizePlan

# Function: normalizePlan()

> **normalizePlan**(`value`): [`PlanSave`](../../garmin-plan/interfaces/PlanSave.md) \| `null`

A save read back from storage: each field is checked and replaced by the
fresh plan's value when it is missing or malformed. Unknown nodes and items
are dropped, so a save can never open a node its paths don't reach.

## Parameters

### value

`unknown`

## Returns

[`PlanSave`](../../garmin-plan/interfaces/PlanSave.md) \| `null`
