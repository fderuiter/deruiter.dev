[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/event-bus](../README.md) / emitAppEvent

# Function: emitAppEvent()

> **emitAppEvent**\<`K`\>(`event`, ...`args`): `void`

Dispatches a registered application event on `window` as a `CustomEvent`
carrying `detail`. Does nothing outside the browser.

## Type Parameters

### K

`K` *extends* keyof [`AppEventMap`](../interfaces/AppEventMap.md)

## Parameters

### event

`K`

The registered event name.

### args

...[`AppEventArgs`](../type-aliases/AppEventArgs.md)\<`K`\>

The event's detail payload, optional when the payload type admits `undefined`.

## Returns

`void`
