[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/arcade/input/actions](../README.md) / codeForKeyEvent

# Function: codeForKeyEvent()

> **codeForKeyEvent**(`event`): `string`

The physical key of a keyboard event. Some synthetic events and Android
soft keyboards send an empty `code`; for those the key's character stands
in, so "q" reads as `KeyQ`, "1" as `Digit1` and " " as `Space`.

## Parameters

### event

`Pick`\<`KeyboardEvent`, `"code"` \| `"key"`\>

The keyboard event, or the two fields it needs.

## Returns

`string`

A `KeyboardEvent.code` value, or an empty string.
