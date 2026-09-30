[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [hooks/useAppEvent](../README.md) / useAppEvent

# Function: useAppEvent()

> **useAppEvent**\<`K`\>(`event`, `handler`): `void`

Subscribes the component to a registered application event on `window` for
as long as it is mounted, removing the listener on unmount.

Each dispatch invokes the latest `handler`, so it reads current props and
state without re-subscribing when the handler's identity changes. Only a
change of `event` re-subscribes.

## Type Parameters

### K

`K` *extends* keyof [`AppEventMap`](../../../lib/event-bus/interfaces/AppEventMap.md)

## Parameters

### event

`K`

The registered event name from `AppEventMap`.

### handler

[`AppEventHandler`](../../../lib/event-bus/type-aliases/AppEventHandler.md)\<`K`\>

Called with the event's detail payload.

## Returns

`void`
