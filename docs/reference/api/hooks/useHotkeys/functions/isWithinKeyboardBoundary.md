[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [hooks/useHotkeys](../README.md) / isWithinKeyboardBoundary

# Function: isWithinKeyboardBoundary()

> **isWithinKeyboardBoundary**(`target`): `boolean`

Checks whether an event target sits inside a `[data-keyboard-boundary]`
region, such as a game canvas or terminal that owns its own keys.

## Parameters

### target

`EventTarget` \| `null`

The event target, usually `event.target`.

## Returns

`boolean`

True when the target is inside a keyboard boundary.
