[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/arcade/input/actions](../README.md) / controlsFromActions

# Function: controlsFromActions()

> **controlsFromActions**(`map`, `groups?`): [`CabinetControl`](../interfaces/CabinetControl.md)[]

The cabinet's control list, one row per group: the group's keys and what
they do. Pass it as `PlayCabinet`'s `controls`.

## Parameters

### map

[`ActionMap`](../interfaces/ActionMap.md)

The action map.

### groups?

readonly `string`[] = `...`

The groups to list, in order. Defaults to every group.

## Returns

[`CabinetControl`](../interfaces/CabinetControl.md)[]

The rows.
