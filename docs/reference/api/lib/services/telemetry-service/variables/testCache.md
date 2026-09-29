[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/services/telemetry-service](../README.md) / \_testCache

# Variable: \_testCache

> `const` **\_testCache**: `object`

## Type Declaration

### active

#### Get Signature

> **get** **active**(): `Map`\<`string`, [`LocalCacheEntry`](../interfaces/LocalCacheEntry.md)\>

##### Returns

`Map`\<`string`, [`LocalCacheEntry`](../interfaces/LocalCacheEntry.md)\>

### aggregateStats

#### Get Signature

> **get** **aggregateStats**(): \{ `data`: `Record`\<`string`, \{ `clicks`: `number`; `views`: `number`; \}\>; `expiresAt`: `number`; \} \| `null`

##### Returns

\{ `data`: `Record`\<`string`, \{ `clicks`: `number`; `views`: `number`; \}\>; `expiresAt`: `number`; \} \| `null`

### circuitBreakerCooldownUntil

#### Get Signature

> **get** **circuitBreakerCooldownUntil**(): `number`

##### Returns

`number`

### inactive

#### Get Signature

> **get** **inactive**(): `Map`\<`string`, [`LocalCacheEntry`](../interfaces/LocalCacheEntry.md)\>

##### Returns

`Map`\<`string`, [`LocalCacheEntry`](../interfaces/LocalCacheEntry.md)\>

### clearAggregateCache()

> **clearAggregateCache**(): `void`

#### Returns

`void`

### clearAggregateStatsCache()

> **clearAggregateStatsCache**(): `void`

#### Returns

`void`

### reset()

> **reset**(): `void`

#### Returns

`void`

### swap()

> **swap**(): `void`

#### Returns

`void`
