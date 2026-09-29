[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [hooks/useHotkeys](../README.md) / UseHotkeysOptions

# Interface: UseHotkeysOptions

Options controlling when a `useHotkeys` binding fires.

## Properties

### allowInInputs?

> `optional` **allowInInputs?**: `boolean`

Fire even while the user is typing in an input, textarea, select or
contenteditable region. Defaults to false.

***

### allowInKeyboardBoundary?

> `optional` **allowInKeyboardBoundary?**: `boolean`

Fire even when the event originates inside a `[data-keyboard-boundary]`
region (a game or terminal that owns its own keys). Defaults to false.

***

### enabled?

> `optional` **enabled?**: `boolean`

Whether the listener is attached. Defaults to true.

***

### ignoreWhenModalOpen?

> `optional` **ignoreWhenModalOpen?**: `boolean`

Skip the binding while any `useFocusTrap` dialog or drawer is active, so
background shortcuts do not fire behind a modal. Defaults to false.

***

### preventDefault?

> `optional` **preventDefault?**: `boolean`

Call `preventDefault()` on the event when a hotkey matches. Defaults to false.

***

### stopPropagation?

> `optional` **stopPropagation?**: `boolean`

Call `stopPropagation()` on the event when a hotkey matches. Defaults to false.

***

### target?

> `optional` **target?**: `"window"` \| `"document"`

Where the keydown listener is attached. Defaults to `"window"`.

***

### targetRef?

> `optional` **targetRef?**: `RefObject`\<`HTMLElement` \| `null`\>

When set, only events whose target is inside this element are handled.
