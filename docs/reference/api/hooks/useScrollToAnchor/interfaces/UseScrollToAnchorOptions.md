[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [hooks/useScrollToAnchor](../README.md) / UseScrollToAnchorOptions

# Interface: UseScrollToAnchorOptions

Options accepted by [useScrollToAnchor](../functions/useScrollToAnchor.md).

## Extends

- [`ScrollToElementOptions`](../../../lib/scroll/interfaces/ScrollToElementOptions.md)

## Properties

### behavior?

> `optional` **behavior?**: `ScrollBehavior`

Scroll animation requested by the caller. It is downgraded to `"auto"`
when the reader prefers reduced motion. Defaults to `"smooth"`.

#### Inherited from

[`ScrollToElementOptions`](../../../lib/scroll/interfaces/ScrollToElementOptions.md).[`behavior`](../../../lib/scroll/interfaces/ScrollToElementOptions.md#behavior)

***

### block?

> `optional` **block?**: `ScrollLogicalPosition`

Vertical alignment passed to `scrollIntoView`. Defaults to `"start"`.

#### Inherited from

[`ScrollToElementOptions`](../../../lib/scroll/interfaces/ScrollToElementOptions.md).[`block`](../../../lib/scroll/interfaces/ScrollToElementOptions.md#block)

***

### focus?

> `optional` **focus?**: `boolean`

Move keyboard focus to the target. A target that is not focusable gets a
`tabindex="-1"` that is removed again when it loses focus. Defaults to true.

#### Inherited from

[`ScrollToElementOptions`](../../../lib/scroll/interfaces/ScrollToElementOptions.md).[`focus`](../../../lib/scroll/interfaces/ScrollToElementOptions.md#focus)

***

### onNavigate?

> `optional` **onNavigate?**: (`id`) => `void`

Runs when a click is handled in page, before scrolling, for side effects
such as audio feedback or closing a menu. Receives the target id.

#### Parameters

##### id

`string`

#### Returns

`void`

***

### updateHash?

> `optional` **updateHash?**: [`ScrollHashMode`](../../../lib/scroll/type-aliases/ScrollHashMode.md)

Write `#id` to the address bar with `history.pushState` ("push") or
`history.replaceState` ("replace"). Needs a target with an id. Defaults to
false, which leaves the URL untouched.

#### Inherited from

[`ScrollToElementOptions`](../../../lib/scroll/interfaces/ScrollToElementOptions.md).[`updateHash`](../../../lib/scroll/interfaces/ScrollToElementOptions.md#updatehash)
