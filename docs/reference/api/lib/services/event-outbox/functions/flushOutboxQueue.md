[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/services/event-outbox](../README.md) / flushOutboxQueue

# Function: flushOutboxQueue()

> **flushOutboxQueue**\<`TEvent`, `_TEntity`\>(`config`): `Promise`\<[`OutboxFlushResult`](../type-aliases/OutboxFlushResult.md)\>

Flushes buffered events from an Upstash Redis list queue to Postgres in atomic batches.

Enforces batch depth clamping using Redis `llen` and atomic transfers via `lmove`.
Enforces idempotent re-processing recovery from `processingKey` across interrupted runs.

## Type Parameters

### TEvent

`TEvent`

Event structure buffered in Redis.

### _TEntity

`_TEntity` = `unknown`

## Parameters

### config

[`EventOutboxConfig`](../interfaces/EventOutboxConfig.md)\<`TEvent`, `_TEntity`\>

Outbox configuration specifying queue keys, predicates, and database handlers.

## Returns

`Promise`\<[`OutboxFlushResult`](../type-aliases/OutboxFlushResult.md)\>

Standard [ServiceResult](../../service-result/type-aliases/ServiceResult.md) envelope containing `processed` and `inserted` counts or failure metadata.
