[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/arcade/input/actions](../README.md) / touchActionInput

# Function: touchActionInput()

> **touchActionInput**\<`A`\>(`action`, `phase`, `repeat?`): [`ActionInput`](../interfaces/ActionInput.md)\<`A`\>

Builds the input a touch control sends for an action.

## Type Parameters

### A

`A` *extends* `string`

## Parameters

### action

`A`

The action name.

### phase

`"up"` \| `"down"`

`down` on press, `up` on release.

### repeat?

`boolean` = `false`

True for a hold's repeat.

## Returns

[`ActionInput`](../interfaces/ActionInput.md)\<`A`\>

An action input from the touch source.
