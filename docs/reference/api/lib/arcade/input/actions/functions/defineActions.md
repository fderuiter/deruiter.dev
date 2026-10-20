[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/arcade/input/actions](../README.md) / defineActions

# Function: defineActions()

> **defineActions**\<`M`\>(`actions`, `options?`): [`ActionMap`](../interfaces/ActionMap.md)\<`Extract`\<keyof `M`, `string`\>\>

Builds a frozen action map. Names keep their literal types, so a handler
switches over exactly the actions the game defined.

## Type Parameters

### M

`M` *extends* `Readonly`\<`Record`\<`string`, [`ActionDefinition`](../type-aliases/ActionDefinition.md)\>\>

## Parameters

### actions

`M`

Each action by name.

### options?

Optional group titles for the control list and the manual.

#### groups?

`Readonly`\<`Record`\<`string`, [`ActionGroup`](../interfaces/ActionGroup.md)\>\>

## Returns

[`ActionMap`](../interfaces/ActionMap.md)\<`Extract`\<keyof `M`, `string`\>\>

The action map.

## Example

```ts
const ACTIONS = defineActions({
  jump: { kind: "press", keys: ["Space"], label: "Jump", gamepad: { buttons: [0] } },
});
```
