[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [hooks/useThrottle](../README.md) / useThrottle

# Function: useThrottle()

> **useThrottle**\<`T`\>(`value`, `intervalMs`): `T`

Returns `value`, updated at most once per `intervalMs`. A change that lands
inside the current window is applied when the window closes, so the latest
value is never lost. An interval of zero or less passes every change through.
The pending timer is cleared on unmount.

## Type Parameters

### T

`T`

## Parameters

### value

`T`

### intervalMs

`number`

## Returns

`T`
