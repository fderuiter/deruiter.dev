[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [hooks/useOfflineQueue](../README.md) / QueuedRequest

# Interface: QueuedRequest\<T\>

## Extended by

- [`DeadLetterItem`](DeadLetterItem.md)

## Type Parameters

### T

`T` = `unknown`

## Properties

### body

> **body**: `T`

***

### createdAt

> **createdAt**: `number`

***

### endpoint

> **endpoint**: `string`

***

### headers?

> `optional` **headers?**: `Record`\<`string`, `string`\>

***

### id

> **id**: `string`

***

### maxRetries?

> `optional` **maxRetries?**: `number`

***

### method?

> `optional` **method?**: `"POST"` \| `"PUT"` \| `"PATCH"` \| `"DELETE"`

***

### retries

> **retries**: `number`

***

### type

> **type**: `string`
