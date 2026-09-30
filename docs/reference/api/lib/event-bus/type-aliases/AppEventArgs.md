[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/event-bus](../README.md) / AppEventArgs

# Type Alias: AppEventArgs\<K\>

> **AppEventArgs**\<`K`\> = `undefined` *extends* [`AppEventMap`](../interfaces/AppEventMap.md)\[`K`\] ? \[[`AppEventMap`](../interfaces/AppEventMap.md)\[`K`\]\] : \[[`AppEventMap`](../interfaces/AppEventMap.md)\[`K`\]\]

Trailing arguments of [emitAppEvent](../functions/emitAppEvent.md) for event `K`: the detail is
optional when the event's payload type admits `undefined`, required otherwise.

## Type Parameters

### K

`K` *extends* [`AppEventName`](AppEventName.md)
