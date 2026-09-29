[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [hooks/useScrollToAnchor](../README.md) / useScrollToAnchor

# Function: useScrollToAnchor()

> **useScrollToAnchor**(`options?`): [`ScrollToAnchorHandler`](../type-aliases/ScrollToAnchorHandler.md)

Click handler for in-page anchor links.

A plain click is handled in page: the default jump is prevented, the target
scrolls into view (instantly under reduced motion) and receives focus. A
click with a modifier key or a non-primary button is left to the browser, so
opening the section in a new tab still works.

## Parameters

### options?

[`UseScrollToAnchorOptions`](../interfaces/UseScrollToAnchorOptions.md) = `{}`

Scroll settings plus an optional `onNavigate` callback.

## Returns

[`ScrollToAnchorHandler`](../type-aliases/ScrollToAnchorHandler.md)

A handler to call from an anchor's `onClick` with the target id.
