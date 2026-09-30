[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/services/event-outbox](../README.md) / EventOutboxConfig

# Interface: EventOutboxConfig\<TEvent, _TEntity\>

Configuration parameters for generic Redis event outbox queue flushing.

## Template

**TEntity**

Optional database entity input type.

## Type Parameters

### TEvent

`TEvent`

Event type stored in the Redis queue and processing list.

### _TEntity

`_TEntity` = `unknown`

## Properties

### batchSize?

> `optional` **batchSize?**: `number`

Maximum number of events to process in a single flush cycle (default: 500).

***

### expireSeconds?

> `optional` **expireSeconds?**: `number`

Expiration in seconds for the processing queue key (default: 48 hours).

***

### flushErrorMessage?

> `optional` **flushErrorMessage?**: `string`

Custom error message when Redis queue read/transfer fails.

***

### isValidEvent

> **isValidEvent**: (`item`) => `item is TEvent`

Type validation predicate for events read from Redis lists.

#### Parameters

##### item

`unknown`

#### Returns

`item is TEvent`

***

### loggerName?

> `optional` **loggerName?**: `string`

Logger context tag for diagnostic messages.

***

### onAcknowledge?

> `optional` **onAcknowledge?**: (`events`, `ackPipeline`) => `void` \| `Promise`\<`void`\>

Optional callback invoked before executing the acknowledgement pipeline.
Allows appending domain-specific Redis operations (such as buffer counter decrements)
into the same atomic pipeline as event `lrem` removal.

#### Parameters

##### events

`TEvent`[]

##### ackPipeline

`Pipeline`\<\[\]\>

#### Returns

`void` \| `Promise`\<`void`\>

***

### persistenceErrorMessage?

> `optional` **persistenceErrorMessage?**: `string`

Custom error message when database persistence fails.

***

### persistEvents

> **persistEvents**: (`events`) => `Promise`\<\{ `count`: `number`; \}\>

Callback to persist a batch of events to the database (e.g. Prisma `createMany`).

#### Parameters

##### events

`TEvent`[]

#### Returns

`Promise`\<\{ `count`: `number`; \}\>

***

### postAcknowledge?

> `optional` **postAcknowledge?**: (`events`, `createResult`) => `Promise`\<`void`\>

Optional callback invoked after successful database persistence and queue acknowledgement.
Useful for post-flush maintenance like buffer cleanup, dirty flag removal, or count hydration.

#### Parameters

##### events

`TEvent`[]

##### createResult

###### count

`number`

#### Returns

`Promise`\<`void`\>

***

### processingKey

> **processingKey**: `string`

Scoped Redis key for the processing queue during flush recovery.

***

### queueKey

> **queueKey**: `string`

Scoped Redis key for the pending event queue.
