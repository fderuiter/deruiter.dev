[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/arcade/input/controller](../README.md) / ActionInputControllerOptions

# Interface: ActionInputControllerOptions

When the controller takes a key, beyond its own text-field check.

## Properties

### accepts?

> `optional` **accepts?**: (`event`) => `boolean`

A last gate for each key down, such as "focus is inside the game". Keys
it refuses are neither handled nor prevented.

#### Parameters

##### event

`KeyboardEvent`

#### Returns

`boolean`

***

### getContext?

> `optional` **getContext?**: () => `string` \| `undefined`

The game's current context, read on every key, such as "park". Only
actions with no context or this context are live.

#### Returns

`string` \| `undefined`

***

### ignoreControls?

> `optional` **ignoreControls?**: `boolean`

Leave keys to a focused button, link, select or tab, so Space and Enter
activate it (the default). An action with `onControls` still acts.

***

### modifiers?

> `optional` **modifiers?**: `"any"` \| `"none"`

`none` (the default) leaves keys pressed with Ctrl, Alt or Meta to the
browser and the system. `any` takes them as the bare key.
