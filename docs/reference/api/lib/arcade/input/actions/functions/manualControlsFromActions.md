[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/arcade/input/actions](../README.md) / manualControlsFromActions

# Function: manualControlsFromActions()

> **manualControlsFromActions**(`map`, `specs`): [`ManualControlRow`](../interfaces/ManualControlRow.md)[]

Rows for a field manual's control table. The keys and the touch hints
come from the map, so the manual names the keys the game binds and, on a
phone, the touch control for each; the title and prose come from the spec.

## Parameters

### map

[`ActionMap`](../interfaces/ActionMap.md)

The action map.

### specs

readonly [`ManualControlSpec`](../interfaces/ManualControlSpec.md)[]

One entry per row.

## Returns

[`ManualControlRow`](../interfaces/ManualControlRow.md)[]

The rows, in the order of `specs`.
