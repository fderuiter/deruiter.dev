[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/services/telemetry-service](../README.md) / TelemetryService

# Class: TelemetryService

## Constructors

### Constructor

> **new TelemetryService**(): `TelemetryService`

#### Returns

`TelemetryService`

## Methods

### clearAggregateCache()

> `static` **clearAggregateCache**(): `void`

Clears the in-memory aggregate stats cache.

#### Returns

`void`

***

### clearAggregateStatsCache()

> `static` **clearAggregateStatsCache**(): `void`

Clears the in-memory aggregate stats cache.

#### Returns

`void`

***

### getAggregateStats()

> `static` **getAggregateStats**(): `Promise`\<`Record`\<`string`, \{ `clicks`: `number`; `views`: `number`; \}\>\>

Fetches aggregate portfolio view/click telemetry statistics.
Results are cached in memory for 10 seconds.

#### Returns

`Promise`\<`Record`\<`string`, \{ `clicks`: `number`; `views`: `number`; \}\>\>

***

### isRateLimited()

> `static` **isRateLimited**(`req`): `Promise`\<\{ `headers?`: `Record`\<`string`, `string`\>; `limited`: `boolean`; \}\>

Evaluates rate limiting anonymously using Web Crypto SHA-256 IP hashing.

#### Parameters

##### req

`NextRequest`

#### Returns

`Promise`\<\{ `headers?`: `Record`\<`string`, `string`\>; `limited`: `boolean`; \}\>

***

### recordEvent()

> `static` **recordEvent**(`data`): `Promise`\<\{ `buffered`: `boolean`; `event`: [`BufferedTelemetryEvent`](../interfaces/BufferedTelemetryEvent.md); \}\>

Records a telemetry interaction event into the Redis buffer queue.

The Redis buffer is the only store in front of the sync job, so a failed
enqueue drops the event outright. `buffered` reports whether the event was
actually accepted so callers never present a dropped event as durable.

#### Parameters

##### data

[`TelemetryEventInput`](../interfaces/TelemetryEventInput.md)

#### Returns

`Promise`\<\{ `buffered`: `boolean`; `event`: [`BufferedTelemetryEvent`](../interfaces/BufferedTelemetryEvent.md); \}\>

***

### rollupAndPruneRawEvents()

> `static` **rollupAndPruneRawEvents**(`before`): `Promise`\<[`TelemetryRetentionResult`](../type-aliases/TelemetryRetentionResult.md)\>

Rolls raw events older than the cutoff into daily aggregates and removes
only the rows committed by the same database transaction.

#### Parameters

##### before

`Date`

#### Returns

`Promise`\<[`TelemetryRetentionResult`](../type-aliases/TelemetryRetentionResult.md)\>

***

### syncBufferedEvents()

> `static` **syncBufferedEvents**(`batchSize`): `Promise`\<[`TelemetrySyncResult`](../type-aliases/TelemetrySyncResult.md)\>

Synchronizes buffered telemetry events from Redis into PostgreSQL.

Events move from `telemetry_buffer` to `telemetry_processing` one at a time
with LMOVE, so a crash mid-transfer cannot drop them, and a batch that
fails to reach the database stays in `telemetry_processing` for the next
run. Acknowledgement is per event rather than per queue: only the events
this invocation persisted are removed, so an overlapping invocation's
batch survives. Re-processing is idempotent through the explicit event id.

#### Parameters

##### batchSize

`number`

#### Returns

`Promise`\<[`TelemetrySyncResult`](../type-aliases/TelemetrySyncResult.md)\>
