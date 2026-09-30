[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/safe-storage](../README.md) / SafeStorageAdapter

# Class: SafeStorageAdapter

## Constructors

### Constructor

> **new SafeStorageAdapter**(): `SafeStorageAdapter`

#### Returns

`SafeStorageAdapter`

## Accessors

### length

#### Get Signature

> **get** **length**(): `number`

Gets total number of stored keys.

##### Returns

`number`

## Methods

### clear()

> **clear**(): `void`

Clears all items from storage and memory cache.

#### Returns

`void`

***

### clearCache()

> **clearCache**(): `void`

Clear all internal memory cache entries.

#### Returns

`void`

***

### getEnvelope()

> **getEnvelope**\<`T`\>(`key`): [`StorageEnvelope`](../interfaces/StorageEnvelope.md)\<`T`\> \| `null`

Gets the metadata envelope for a key if present or constructs default metadata.

#### Type Parameters

##### T

`T` = `any`

#### Parameters

##### key

`string`

#### Returns

[`StorageEnvelope`](../interfaces/StorageEnvelope.md)\<`T`\> \| `null`

***

### getItem()

> **getItem**\<`T`\>(`key`, `defaultValue?`): `T` \| `null`

Reads an item from storage or memory fallback cache.
Updates lastAccessedAt timestamp and auto-evicts expired items.

#### Type Parameters

##### T

`T` = `any`

#### Parameters

##### key

`string`

##### defaultValue?

`T`

#### Returns

`T` \| `null`

***

### getRawItem()

> **getRawItem**(`key`): `string` \| `null`

Reads the stored string exactly as written, without JSON parsing or
envelope unwrapping. It is the read counterpart of `setRawItem` for keys
whose legacy format is a bare string (for example a high score "1200"
that `getItem` would return as the number 1200). Falls back to the
in-memory cache when storage is unavailable or throws.

#### Parameters

##### key

`string`

The storage key to read

#### Returns

`string` \| `null`

The stored string, or null when the key is absent

***

### invalidateCacheKey()

> **invalidateCacheKey**(`key`): `void`

Invalidate memory cache key if raw storage content differs.

#### Parameters

##### key

`string`

#### Returns

`void`

***

### isAvailable()

> **isAvailable**(): `boolean`

Safely checks whether localStorage API is accessible in the current environment.

#### Returns

`boolean`

***

### key()

> **key**(`index`): `string` \| `null`

Returns key at specified index.

#### Parameters

##### index

`number`

#### Returns

`string` \| `null`

***

### pruneExpired()

> **pruneExpired**(): `number`

Prunes all expired keys across storage and memory cache.
Returns count of pruned entries.

#### Returns

`number`

***

### removeItem()

> **removeItem**(`key`): `void`

Removes an item from storage and memory cache.

#### Parameters

##### key

`string`

#### Returns

`void`

***

### setItem()

> **setItem**\<`T`\>(`key`, `value`, `options?`): `boolean`

Writes an item wrapped in a metadata envelope to storage.
Handles QuotaExceededError by triggering LRU metadata eviction.

#### Type Parameters

##### T

`T` = `any`

#### Parameters

##### key

`string`

##### value

`T`

##### options?

[`StorageOptions`](../interfaces/StorageOptions.md)

#### Returns

`boolean`

***

### setRawItem()

> **setRawItem**(`key`, `raw`, `options?`): `boolean`

Writes a raw string to storage exactly as given, without the metadata
envelope that `setItem` adds. Use it only for keys whose stored format
predates the envelope and must stay byte-identical so existing visitors
keep their settings. `getItem` reads such values back unchanged. Storage
failures fall back to the in-memory cache instead of throwing, unless
`options.retainInMemory` is false: the key is then never held in memory,
so a failed write is dropped and reads see only localStorage.

#### Parameters

##### key

`string`

The storage key to write

##### raw

`string`

The exact string to store

##### options?

[`RawWriteOptions`](../interfaces/RawWriteOptions.md)

Whether the value is kept in memory (default true)

#### Returns

`boolean`

true when the value reached localStorage, false when it did not
