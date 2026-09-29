[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [hooks/useDebounce](../README.md) / useDebounce

# Function: useDebounce()

> **useDebounce**\<`T`\>(`value`, `delayMs`): `T`

Returns `value` once it has stopped changing for `delayMs` milliseconds.

A delay of zero or less passes the value through unchanged on the same
render, which lets callers bypass the debounce for specific values (for
example, clearing a search field) by passing a zero delay for them.

The pending timer is cleared on every change and on unmount.

## Type Parameters

### T

`T`

## Parameters

### value

`T`

### delayMs

`number`

## Returns

`T`
