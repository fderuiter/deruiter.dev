[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [hooks/useOfflineQueue](../README.md) / retryDLQItem

# Function: retryDLQItem()

> **retryDLQItem**(`id`): `void`

Retry an item from the dead-letter queue by re-enqueueing it into the offline queue.

## Parameters

### id

`string`

Unique identifier of the dead-letter item to retry.

## Returns

`void`
