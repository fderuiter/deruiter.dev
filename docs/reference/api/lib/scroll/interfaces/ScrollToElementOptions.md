[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/scroll](../README.md) / ScrollToElementOptions

# Interface: ScrollToElementOptions

Options accepted by [scrollToElement](../functions/scrollToElement.md).

## Extended by

- [`UseScrollToAnchorOptions`](../../../hooks/useScrollToAnchor/interfaces/UseScrollToAnchorOptions.md)

## Properties

### behavior?

> `optional` **behavior?**: `ScrollBehavior`

Scroll animation requested by the caller. It is downgraded to `"auto"`
when the reader prefers reduced motion. Defaults to `"smooth"`.

***

### block?

> `optional` **block?**: `ScrollLogicalPosition`

Vertical alignment passed to `scrollIntoView`. Defaults to `"start"`.

***

### focus?

> `optional` **focus?**: `boolean`

Move keyboard focus to the target. A target that is not focusable gets a
`tabindex="-1"` that is removed again when it loses focus. Defaults to true.

***

### updateHash?

> `optional` **updateHash?**: [`ScrollHashMode`](../type-aliases/ScrollHashMode.md)

Write `#id` to the address bar with `history.pushState` ("push") or
`history.replaceState` ("replace"). Needs a target with an id. Defaults to
false, which leaves the URL untouched.
