[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/arcade/input/react](../README.md) / ActionSinkProviderProps

# Interface: ActionSinkProviderProps\<A\>

Props for `ActionSinkProvider`.

## Type Parameters

### A

`A` *extends* `string` = `string`

## Properties

### actions?

> `optional` **actions?**: [`ActionMap`](../../actions/interfaces/ActionMap.md)\<`A`\>

The action map, when the sink should apply it: repeats of an action
without `repeat` are then dropped, as they are for keys.

***

### children

> **children**: `ReactNode`

***

### onAction

> **onAction**: [`ActionHandler`](../../actions/type-aliases/ActionHandler.md)\<`A`\>

The session's action handler. Touch controls below send their actions here.
