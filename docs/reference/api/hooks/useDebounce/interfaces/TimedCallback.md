[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [hooks/useDebounce](../README.md) / TimedCallback

# Interface: TimedCallback()\<Args\>

A rate-limited wrapper around a callback. Calling it schedules or invokes the
underlying callback; its identity is stable for the lifetime of the component.

## Type Parameters

### Args

`Args` *extends* `unknown`[]

> **TimedCallback**(...`args`): `void`

A rate-limited wrapper around a callback. Calling it schedules or invokes the
underlying callback; its identity is stable for the lifetime of the component.

## Parameters

### args

...`Args`

## Returns

`void`

## Properties

### cancel

> **cancel**: () => `void`

Drop any pending trailing invocation.

#### Returns

`void`

***

### flush

> **flush**: () => `void`

Invoke a pending trailing invocation immediately, if one is queued.

#### Returns

`void`

***

### isPending

> **isPending**: () => `boolean`

Whether a trailing invocation is currently queued.

#### Returns

`boolean`
