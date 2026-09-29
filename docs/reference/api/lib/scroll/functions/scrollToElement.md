[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/scroll](../README.md) / scrollToElement

# Function: scrollToElement()

> **scrollToElement**(`target`, `options?`): `HTMLElement` \| `null`

Scroll an element into view and, by default, move focus to it.

Safe to call during server rendering, where it does nothing.

## Parameters

### target

`string` \| `HTMLElement`

The element, or the id of the element, to scroll to.

### options?

[`ScrollToElementOptions`](../interfaces/ScrollToElementOptions.md) = `{}`

Animation, alignment, focus and URL hash settings.

## Returns

`HTMLElement` \| `null`

The element scrolled to, or null when it does not exist.
