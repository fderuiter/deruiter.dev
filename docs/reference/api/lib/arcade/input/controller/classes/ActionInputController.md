[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/arcade/input/controller](../README.md) / ActionInputController

# Class: ActionInputController\<A\>

Reads the keyboard and gamepads into action inputs for one action map. It
holds no DOM: the caller forwards key events and gamepad snapshots, which
keeps it testable and lets `useActionInput` own the listeners.

## Type Parameters

### A

`A` *extends* `string` = `string`

## Constructors

### Constructor

> **new ActionInputController**\<`A`\>(`map`, `emit`, `options?`): `ActionInputController`\<`A`\>

#### Parameters

##### map

[`ActionMap`](../../actions/interfaces/ActionMap.md)\<`A`\>

##### emit

[`ActionHandler`](../../actions/type-aliases/ActionHandler.md)\<`A`\>

##### options?

[`ActionInputControllerOptions`](../interfaces/ActionInputControllerOptions.md) = `{}`

#### Returns

`ActionInputController`\<`A`\>

## Methods

### handleKeyDown()

> **handleKeyDown**(`event`): `void`

Handles a key going down. A key typed into a text field, pressed with a
modifier the options refuse, or landing on a focused control is left
alone. Otherwise the first live action bound to the key fires.

#### Parameters

##### event

`KeyboardEvent`

The keydown event.

#### Returns

`void`

***

### handleKeyUp()

> **handleKeyUp**(`event`): `void`

Handles a key going up. A release always counts, wherever focus is now,
so a hold never sticks.

#### Parameters

##### event

`KeyboardEvent`

The keyup event.

#### Returns

`void`

***

### pollGamepads()

> **pollGamepads**(`pads`, `now`): `void`

Reads one frame of gamepad state. Buttons and axes bound to `press` and
`hold` actions fire on their edges, and repeat while held for actions
that ask for it; sticks and the D-pad drive `axis2d` actions.

#### Parameters

##### pads

readonly ([`GamepadLike`](../interfaces/GamepadLike.md) \| `null`)[]

`navigator.getGamepads()`, or test doubles.

##### now

`number`

The frame time in milliseconds.

#### Returns

`void`

***

### releaseAll()

> **releaseAll**(): `void`

Releases every held action and centres every axis, as when the window
loses focus or the page is hidden. A gamepad button still down must be
let go before it presses again.

#### Returns

`void`
