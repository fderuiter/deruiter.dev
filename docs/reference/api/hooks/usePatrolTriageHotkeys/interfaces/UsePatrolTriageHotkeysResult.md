[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [hooks/usePatrolTriageHotkeys](../README.md) / UsePatrolTriageHotkeysResult

# Interface: UsePatrolTriageHotkeysResult\<T\>

Return type for `usePatrolTriageHotkeys`.

## Type Parameters

### T

`T` = `unknown`

## Properties

### focusedIndex

> **focusedIndex**: `number`

Currently focused item index.

***

### focusedItem

> **focusedItem**: `T` \| `undefined`

Currently focused item object (if `items` array was provided).

***

### getHotkeyBadge

> **getHotkeyBadge**: (`index`) => `string` \| `null`

Returns hotkey badge text (e.g., "[1]", "[2]") for item at index, or null if beyond 9 items.

#### Parameters

##### index

`number`

#### Returns

`string` \| `null`

***

### isFocused

> **isFocused**: (`index`) => `boolean`

Checks if the given item index is currently focused.

#### Parameters

##### index

`number`

#### Returns

`boolean`

***

### nextItem

> **nextItem**: () => `void`

Navigate focus to the next selectable item.

#### Returns

`void`

***

### prevItem

> **prevItem**: () => `void`

Navigate focus to the previous selectable item.

#### Returns

`void`

***

### selectIndex

> **selectIndex**: (`index`) => `void`

Programmatically select an item at the given index.

#### Parameters

##### index

`number`

#### Returns

`void`

***

### setFocusedIndex

> **setFocusedIndex**: `Dispatch`\<`SetStateAction`\<`number`\>\>

State setter for focused item index.
