[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [hooks/useHotkeys](../README.md) / isEditableElement

# Function: isEditableElement()

> **isEditableElement**(`target`): `boolean`

Checks whether an event target is a place where the user types text:
an input, textarea, select or contenteditable region.

## Parameters

### target

`EventTarget` \| `null`

The event target, usually `event.target`.

## Returns

`boolean`

True when keystrokes should be left to the element.
