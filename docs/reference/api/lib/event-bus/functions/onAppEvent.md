[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/event-bus](../README.md) / onAppEvent

# Function: onAppEvent()

> **onAppEvent**\<`K`\>(`event`, `handler`): () => `void`

Subscribes to a registered application event on `window`.

The handler receives the event's `detail`; a detail-less dispatch (whose
`CustomEvent.detail` is `null`) is delivered as `undefined`. Outside the
browser this is a no-op.

## Type Parameters

### K

`K` *extends* keyof [`AppEventMap`](../interfaces/AppEventMap.md)

## Parameters

### event

`K`

The registered event name.

### handler

[`AppEventHandler`](../type-aliases/AppEventHandler.md)\<`K`\>

Called with the detail payload on every dispatch.

## Returns

A function that removes the listener.

() => `void`
