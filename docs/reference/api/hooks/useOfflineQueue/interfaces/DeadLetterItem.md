[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [hooks/useOfflineQueue](../README.md) / DeadLetterItem

# Interface: DeadLetterItem\<T\>

## Extends

- [`QueuedRequest`](QueuedRequest.md)\<`T`\>

## Type Parameters

### T

`T` = `unknown`

## Properties

### body

> **body**: `T`

#### Inherited from

[`QueuedRequest`](QueuedRequest.md).[`body`](QueuedRequest.md#body)

***

### createdAt

> **createdAt**: `number`

#### Inherited from

[`QueuedRequest`](QueuedRequest.md).[`createdAt`](QueuedRequest.md#createdat)

***

### endpoint

> **endpoint**: `string`

#### Inherited from

[`QueuedRequest`](QueuedRequest.md).[`endpoint`](QueuedRequest.md#endpoint)

***

### failedAt

> **failedAt**: `number`

***

### failureReason

> **failureReason**: `string`

***

### headers?

> `optional` **headers?**: `Record`\<`string`, `string`\>

#### Inherited from

[`QueuedRequest`](QueuedRequest.md).[`headers`](QueuedRequest.md#headers)

***

### id

> **id**: `string`

#### Inherited from

[`QueuedRequest`](QueuedRequest.md).[`id`](QueuedRequest.md#id)

***

### maxRetries?

> `optional` **maxRetries?**: `number`

#### Inherited from

[`QueuedRequest`](QueuedRequest.md).[`maxRetries`](QueuedRequest.md#maxretries)

***

### method?

> `optional` **method?**: `"POST"` \| `"PUT"` \| `"PATCH"` \| `"DELETE"`

#### Inherited from

[`QueuedRequest`](QueuedRequest.md).[`method`](QueuedRequest.md#method)

***

### retries

> **retries**: `number`

#### Inherited from

[`QueuedRequest`](QueuedRequest.md).[`retries`](QueuedRequest.md#retries)

***

### statusCode

> **statusCode**: `number`

***

### type

> **type**: `string`

#### Inherited from

[`QueuedRequest`](QueuedRequest.md).[`type`](QueuedRequest.md#type)
