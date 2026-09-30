[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/scroll](../README.md) / isModifiedClick

# Function: isModifiedClick()

> **isModifiedClick**(`event`): `boolean`

Whether a click should be left to the browser rather than handled in page.

A click with a modifier key or a non-primary button asks for the link in a
new tab or window, so an in-page scroll handler must not cancel it.

## Parameters

### event

[`ClickModifiers`](../type-aliases/ClickModifiers.md)

A DOM or React mouse event.

## Returns

`boolean`

True for a modified or non-primary click.
