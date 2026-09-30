[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [hooks/useOfflineQueue](../README.md) / useOfflineQueue

# Function: useOfflineQueue()

> **useOfflineQueue**(`options?`): `object`

Custom hook providing access to the persistent offline request queue, dead-letter queue, and online status.
Uses useSyncExternalStore for hydration-safe, referentially stable, cross-tab synchronized state.

## Parameters

### options?

[`UseOfflineQueueOptions`](../interfaces/UseOfflineQueueOptions.md)

Optional hook configuration options.

## Returns

`object`

### clear

> **clear**: () => `void`

#### Returns

`void`

### clearDLQ

> **clearDLQ**: () => `void` = `clearDLQCallback`

#### Returns

`void`

### dequeue

> **dequeue**: (`id`) => `void`

#### Parameters

##### id

`string`

#### Returns

`void`

### dismissDLQItem

> **dismissDLQItem**: (`id`) => `void` = `dismissDLQItemCallback`

#### Parameters

##### id

`string`

#### Returns

`void`

### dlqLength

> **dlqLength**: `number` = `dlqQueue.length`

### dlqQueue

> **dlqQueue**: [`DeadLetterItem`](../interfaces/DeadLetterItem.md)\<`unknown`\>[]

### enqueue

> **enqueue**: \<`T`\>(`request`) => [`QueuedRequest`](../interfaces/QueuedRequest.md)\<`T`\>

#### Type Parameters

##### T

`T` = `unknown`

#### Parameters

##### request

`Omit`\<[`QueuedRequest`](../interfaces/QueuedRequest.md)\<`T`\>, `"id"` \| `"createdAt"` \| `"retries"`\> & `object`

#### Returns

[`QueuedRequest`](../interfaces/QueuedRequest.md)\<`T`\>

### flush

> **flush**: () => `Promise`\<\{ `failed`: `number`; `processed`: `number`; \}\>

#### Returns

`Promise`\<\{ `failed`: `number`; `processed`: `number`; \}\>

### isOnline

> **isOnline**: `boolean`

### isProcessing

> **isProcessing**: `boolean` = `isProcessingQueue`

### queue

> **queue**: [`QueuedRequest`](../interfaces/QueuedRequest.md)\<`unknown`\>[]

### queueLength

> **queueLength**: `number` = `queue.length`

### retryDLQItem

> **retryDLQItem**: (`id`) => `void` = `retryDLQItemCallback`

#### Parameters

##### id

`string`

#### Returns

`void`
