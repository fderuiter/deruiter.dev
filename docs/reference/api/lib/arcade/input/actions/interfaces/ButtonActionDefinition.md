[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/arcade/input/actions](../README.md) / ButtonActionDefinition

# Interface: ButtonActionDefinition

A `press` or `hold` action.

## Extends

- `ActionDefinitionBase`

## Properties

### context?

> `readonly` `optional` **context?**: `string`

The game context in which the action's keys are live, such as "park".
Two actions may share a key when their contexts differ. An action with no
context is live everywhere.

#### Inherited from

`ActionDefinitionBase.context`

***

### gamepad?

> `readonly` `optional` **gamepad?**: [`GamepadButtonBinding`](GamepadButtonBinding.md)

***

### gamepadLabel?

> `readonly` `optional` **gamepadLabel?**: `string`

The gamepad button as players read it, such as "A".

#### Inherited from

`ActionDefinitionBase.gamepadLabel`

***

### group?

> `readonly` `optional` **group?**: `string`

The manual and control-list group this action belongs to.

#### Inherited from

`ActionDefinitionBase.group`

***

### keyLabel?

> `readonly` `optional` **keyLabel?**: `string`

The key as players read it, such as "Space". Defaults to names derived from `keys`.

#### Inherited from

`ActionDefinitionBase.keyLabel`

***

### keys

> `readonly` **keys**: readonly `string`[]

`KeyboardEvent.code` values, such as `KeyW`, `Space` or `ArrowUp`.

***

### kind

> `readonly` **kind**: `"press"` \| `"hold"`

***

### label

> `readonly` **label**: `string`

What the action does, such as "Jump". The control list and manual use it.

#### Inherited from

`ActionDefinitionBase.label`

***

### onControls?

> `readonly` `optional` **onControls?**: `boolean`

Whether the key still acts while a button, link or tab has focus. Off by
default, so Space and Enter activate the focused control instead.

#### Inherited from

`ActionDefinitionBase.onControls`

***

### preventDefault?

> `readonly` `optional` **preventDefault?**: `boolean`

Whether the key's browser default (scrolling, for Space and the arrows) is prevented.

#### Inherited from

`ActionDefinitionBase.preventDefault`

***

### repeat?

> `readonly` `optional` **repeat?**: `boolean`

Whether a held key repeats the action. Off by default.

#### Inherited from

`ActionDefinitionBase.repeat`

***

### touchLabel?

> `readonly` `optional` **touchLabel?**: `string`

The touch hint, such as "Tap Jump". Defaults to "Tap" and the label.

#### Inherited from

`ActionDefinitionBase.touchLabel`

***

### yieldsToCabinet?

> `readonly` `optional` **yieldsToCabinet?**: `boolean`

Set on an action that binds a key the cabinet also uses (F or Escape),
to say the game accepts that the cabinet takes the key first where it
does. The conflict check then lets it through.

#### Inherited from

`ActionDefinitionBase.yieldsToCabinet`
