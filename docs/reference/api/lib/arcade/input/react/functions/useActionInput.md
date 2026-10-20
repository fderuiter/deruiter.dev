[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/arcade/input/react](../README.md) / useActionInput

# Function: useActionInput()

> **useActionInput**\<`A`\>(`map`, `onAction`, `options?`): `void`

Binds an action map to the keyboard and any gamepad for the life of the
component. Keys are matched by `KeyboardEvent.code`, so the bindings follow
the key's position on any layout. A key typed into a text field is left to
it, a key on a focused button is left to the button unless the action says
otherwise, and only actions with `repeat` act on a held key. Every held
action is released when the window blurs, the page hides or the hook is
disabled. The handler is always the latest one, so it never re-binds; a
new map, or a change to `enabled`, `modifiers` or `ignoreControls`,
re-binds. Conflicts with the cabinet's own keys are reported once per map.

## Type Parameters

### A

`A` *extends* `string`

## Parameters

### map

[`ActionMap`](../../actions/interfaces/ActionMap.md)\<`A`\>

The action map from `defineActions`.

### onAction

[`ActionHandler`](../../actions/type-aliases/ActionHandler.md)\<`A`\>

Receives each action input.

### options?

[`UseActionInputOptions`](../interfaces/UseActionInputOptions.md) = `{}`

When and where the bindings act.

## Returns

`void`

## Example

```tsx
useActionInput(ACTIONS, (input) => {
  if (input.action === "jump" && input.phase === "down") session.dispatch("jump");
});
```
