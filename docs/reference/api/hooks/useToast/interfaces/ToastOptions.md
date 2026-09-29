[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [hooks/useToast](../README.md) / ToastOptions

# Interface: ToastOptions

Per-call options accepted by the toast methods.

## Properties

### description?

> `optional` **description?**: `string`

Optional secondary line rendered beneath the message.

***

### duration?

> `optional` **duration?**: `number`

Auto-dismiss delay in milliseconds. Defaults to 4000ms (6000ms for errors).
Pass `Infinity` or `0` to keep the toast until the user dismisses it.
