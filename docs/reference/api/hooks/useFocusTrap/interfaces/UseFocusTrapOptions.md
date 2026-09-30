[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [hooks/useFocusTrap](../README.md) / UseFocusTrapOptions

# Interface: UseFocusTrapOptions

## Properties

### initialFocusRef?

> `optional` **initialFocusRef?**: `RefObject`\<`HTMLElement` \| `null`\>

Element or ref to focus immediately when the trap activates.

***

### onEscape?

> `optional` **onEscape?**: () => `void`

Callback triggered when Escape key is pressed.

#### Returns

`void`

***

### onKeyDown?

> `optional` **onKeyDown?**: (`event`) => `void`

Custom keydown handler to process shortcuts (e.g., Arrow keys, letter hotkeys)
while the trap is active before or along with standard trap behavior.

#### Parameters

##### event

`KeyboardEvent`

#### Returns

`void`

***

### returnFocus?

> `optional` **returnFocus?**: `boolean`

Whether to restore focus to previously active element upon unmount or deactivation.
Defaults to true.

***

### returnFocusTo?

> `optional` **returnFocusTo?**: `RefObject`\<`HTMLElement` \| `null`\>

Fallback element to focus on close when the element that was focused at
activation is no longer connected to the document.
