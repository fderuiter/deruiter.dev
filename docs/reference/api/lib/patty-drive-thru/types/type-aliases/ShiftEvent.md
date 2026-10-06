[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/patty-drive-thru/types](../README.md) / ShiftEvent

# Type Alias: ShiftEvent

> **ShiftEvent** = \{ `orderId`: `number`; `type`: `"order-arrived"`; \} \| \{ `orderId`: `number`; `type`: `"order-expired"`; \} \| \{ `band`: [`KdsBand`](KdsBand.md); `orderId`: `number`; `type`: `"bumped"`; \} \| \{ `itemId`: [`MenuItemId`](MenuItemId.md); `orderId`: `number`; `type`: `"item-rung"`; \} \| \{ `orderId`: `number`; `type`: `"drink-dropped"`; \} \| \{ `orderId`: `number`; `type`: `"drink-reentered"`; \} \| \{ `orderId`: `number` \| `null`; `type`: `"locked"`; \} \| \{ `orderId`: `number`; `type`: `"coworker-ready"`; \} \| \{ `nodeId`: `string`; `type`: `"wrong-entry"`; \} \| \{ `type`: `"manager-yell"`; \} \| \{ `type`: `"wiped"`; \} \| \{ `outcome`: [`ShiftOutcome`](ShiftOutcome.md); `type`: `"shift-ended"`; \}

One-shot facts for audio, screen effects and the diary log.
