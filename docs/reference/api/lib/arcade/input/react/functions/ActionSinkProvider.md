[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/arcade/input/react](../README.md) / ActionSinkProvider

# Function: ActionSinkProvider()

> **ActionSinkProvider**\<`A`\>(`props`): `Element`

Hands a session's action handler to the touch controls below it, so a
`TouchButton` with an `action` sends that action, not a fake key.

## Type Parameters

### A

`A` *extends* `string` = `string`

## Parameters

### props

[`ActionSinkProviderProps`](../interfaces/ActionSinkProviderProps.md)\<`A`\>

The handler, an optional action map and the controls.

## Returns

`Element`

The children, with the handler in context.
