[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/arcade/input/actions](../README.md) / findActionConflicts

# Function: findActionConflicts()

> **findActionConflicts**(`map`, `options?`): [`ActionConflict`](../interfaces/ActionConflict.md)[]

Finds the bindings that would clash: one key bound to two actions that can
be live at once, and keys the cabinet takes (F and Escape) bound by an
action that does not say it yields to the cabinet.

## Parameters

### map

[`ActionMap`](../interfaces/ActionMap.md)

The action map.

### options?

`reserved` replaces the cabinet's keys, such as `["Escape"]`
  for a cabinet that passes F to the game.

#### reserved?

readonly `string`[]

## Returns

[`ActionConflict`](../interfaces/ActionConflict.md)[]

Each conflict, in definition order. Empty when the map is clean.
