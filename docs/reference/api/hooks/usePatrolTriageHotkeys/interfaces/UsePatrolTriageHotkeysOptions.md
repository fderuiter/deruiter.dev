[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [hooks/usePatrolTriageHotkeys](../README.md) / UsePatrolTriageHotkeysOptions

# Interface: UsePatrolTriageHotkeysOptions\<T\>

Options controlling the behavior of `usePatrolTriageHotkeys`.

## Type Parameters

### T

`T` = `unknown`

## Properties

### allowInInputs?

> `optional` **allowInInputs?**: `boolean`

Allow hotkeys while typing in editable inputs. Defaults to false.

***

### enabled?

> `optional` **enabled?**: `boolean`

Whether hotkeys are active. Defaults to true.

***

### ignoreWhenModalOpen?

> `optional` **ignoreWhenModalOpen?**: `boolean`

Ignore hotkeys when any modal or focus trap is active. Defaults to true.

***

### initialIndex?

> `optional` **initialIndex?**: `number`

Initial focused item index. Defaults to 0.

***

### isItemSelectable?

> `optional` **isItemSelectable?**: (`item`, `index`) => `boolean`

Predicate to determine if an item at index is selectable.
Locked, completed, or disabled items should return false to be skipped.

#### Parameters

##### item

`T` \| `undefined`

##### index

`number`

#### Returns

`boolean`

***

### items?

> `optional` **items?**: `T`[]

List of items available for hotkey triage navigation.

***

### itemsCount?

> `optional` **itemsCount?**: `number`

Total item count when items array is omitted.

***

### onAdvancePhase?

> `optional` **onAdvancePhase?**: () => `void`

Callback invoked when Enter/Space is pressed and no item is focused, or to advance the shift phase.

#### Returns

`void`

***

### onSelectItem?

> `optional` **onSelectItem?**: (`index`, `item?`) => `void`

Callback invoked when an item is selected via numeric hotkeys (1-9) or Enter/Space.

#### Parameters

##### index

`number`

##### item?

`T`

#### Returns

`void`

***

### phase?

> `optional` **phase?**: `string`

Current shift phase or scenario ID. Changes reset `focusedIndex` to 0 to prevent out-of-bounds focus.
