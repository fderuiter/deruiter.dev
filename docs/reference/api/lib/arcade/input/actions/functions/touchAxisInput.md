[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/arcade/input/actions](../README.md) / touchAxisInput

# Function: touchAxisInput()

> **touchAxisInput**\<`A`\>(`action`, `value`): [`ActionInput`](../interfaces/ActionInput.md)\<`A`\>

Builds the input a touch stick or drag pad sends for an `axis2d` action:
phase `change` with the vector, as a keyboard or gamepad stick sends it.
A released stick sends `{ x: 0, y: 0 }`.

## Type Parameters

### A

`A` *extends* `string`

## Parameters

### action

`A`

The `axis2d` action name.

### value

[`ActionVector`](../interfaces/ActionVector.md)

The direction, each axis from -1 to 1, screen y down.

## Returns

[`ActionInput`](../interfaces/ActionInput.md)\<`A`\>

An action input from the touch source.
