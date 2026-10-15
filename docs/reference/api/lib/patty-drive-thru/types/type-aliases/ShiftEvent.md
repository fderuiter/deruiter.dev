[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/patty-drive-thru/types](../README.md) / ShiftEvent

# Type Alias: ShiftEvent

> **ShiftEvent** = \{ `orderId`: `number`; `type`: `"order-arrived"`; \} \| \{ `orderId`: `number`; `type`: `"order-expired"`; \} \| \{ `band`: [`KdsBand`](KdsBand.md); `orderId`: `number`; `type`: `"bumped"`; \} \| \{ `itemId`: [`MenuItemId`](MenuItemId.md); `orderId`: `number`; `type`: `"item-rung"`; \} \| \{ `orderId`: `number`; `type`: `"drink-dropped"`; \} \| \{ `orderId`: `number`; `type`: `"drink-reentered"`; \} \| \{ `orderId`: `number` \| `null`; `type`: `"locked"`; \} \| \{ `orderId`: `number`; `type`: `"coworker-ready"`; \} \| \{ `nodeId`: `string`; `type`: `"wrong-entry"`; \} \| \{ `type`: `"manager-yell"`; \} \| \{ `type`: `"wiped"`; \} \| \{ `rush`: `number`; `type`: `"rush-started"`; \} \| \{ `dilemmaId`: [`DilemmaId`](DilemmaId.md); `type`: `"dilemma-offered"`; \} \| \{ `dilemmaId`: [`DilemmaId`](DilemmaId.md); `optionId`: `string`; `timedOut`: `boolean`; `type`: `"dilemma-resolved"`; \} \| \{ `outcome`: [`ShiftOutcome`](ShiftOutcome.md); `type`: `"shift-ended"`; \}

One-shot facts for audio, screen effects and the diary log.

## Union Members

### Type Literal

\{ `orderId`: `number`; `type`: `"order-arrived"`; \}

***

### Type Literal

\{ `orderId`: `number`; `type`: `"order-expired"`; \}

***

### Type Literal

\{ `band`: [`KdsBand`](KdsBand.md); `orderId`: `number`; `type`: `"bumped"`; \}

***

### Type Literal

\{ `itemId`: [`MenuItemId`](MenuItemId.md); `orderId`: `number`; `type`: `"item-rung"`; \}

***

### Type Literal

\{ `orderId`: `number`; `type`: `"drink-dropped"`; \}

***

### Type Literal

\{ `orderId`: `number`; `type`: `"drink-reentered"`; \}

***

### Type Literal

\{ `orderId`: `number` \| `null`; `type`: `"locked"`; \}

***

### Type Literal

\{ `orderId`: `number`; `type`: `"coworker-ready"`; \}

***

### Type Literal

\{ `nodeId`: `string`; `type`: `"wrong-entry"`; \}

***

### Type Literal

\{ `type`: `"manager-yell"`; \}

***

### Type Literal

\{ `type`: `"wiped"`; \}

***

### Type Literal

\{ `rush`: `number`; `type`: `"rush-started"`; \}

#### rush

> `readonly` **rush**: `number`

Which of the shift's rushes began, counting from 0 (#2139).

#### type

> `readonly` **type**: `"rush-started"`

***

### Type Literal

\{ `dilemmaId`: [`DilemmaId`](DilemmaId.md); `type`: `"dilemma-offered"`; \}

***

### Type Literal

\{ `dilemmaId`: [`DilemmaId`](DilemmaId.md); `optionId`: `string`; `timedOut`: `boolean`; `type`: `"dilemma-resolved"`; \}

***

### Type Literal

\{ `outcome`: [`ShiftOutcome`](ShiftOutcome.md); `type`: `"shift-ended"`; \}
