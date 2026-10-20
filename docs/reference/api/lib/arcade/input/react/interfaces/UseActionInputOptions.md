[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/arcade/input/react](../README.md) / UseActionInputOptions

# Interface: UseActionInputOptions

Options for `useActionInput`.

## Properties

### enabled?

> `optional` **enabled?**: `boolean`

Whether the listeners are attached. Defaults to true.

***

### getContext?

> `optional` **getContext?**: () => `string` \| `undefined`

The game's current context, read on every key. See `ActionDefinition.context`.

#### Returns

`string` \| `undefined`

***

### ignoreControls?

> `optional` **ignoreControls?**: `boolean`

See `ActionInputControllerOptions.ignoreControls`. Defaults to true.

***

### modifiers?

> `optional` **modifiers?**: `"any"` \| `"none"`

See `ActionInputControllerOptions.modifiers`. Defaults to `none`.

***

### onConflict?

> `optional` **onConflict?**: (`conflicts`) => `void`

Called once per map with any binding conflicts. Without it, conflicts
are logged as a console warning.

#### Parameters

##### conflicts

readonly [`ActionConflict`](../../actions/interfaces/ActionConflict.md)[]

#### Returns

`void`

***

### reservedKeys?

> `optional` **reservedKeys?**: readonly `string`[]

The keys the cabinet takes, for the conflict check. Defaults to F and
Escape; a cabinet with `fullscreenKey={false}` passes `["Escape"]`.

***

### scopeRef?

> `optional` **scopeRef?**: `RefObject`\<`HTMLElement` \| `null`\>

Only keys pressed while focus is inside this element act, so a game
leaves the rest of the page its keys.
