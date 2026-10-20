[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [hooks/useGarminService](../README.md) / useGarminService

# Function: useGarminService()

> **useGarminService**(): `object`

Custom React hook providing access to Garmin Watch Simulator domain service operations.
Wraps AllocateGarminMemoryHandler, GarbageCollectHandler, and SyncFlashStorageHandler
with Zod input validation and zero-exception ServiceResult error handling.

## Returns

`object`

### allocateMemory

> **allocateMemory**: (`input`) => [`AllocateGarminMemoryResult`](../../../lib/services/garmin/allocate-memory/spec/type-aliases/AllocateGarminMemoryResult.md)

#### Parameters

##### input

###### name?

`string` = `...`

###### state

[`GameEngineState`](../../../lib/garmin/engine/interfaces/GameEngineState.md) = `...`

###### type

`"string"` \| `"int"` \| `"array"` \| `"float"` = `VariableTypeSchema`

#### Returns

[`AllocateGarminMemoryResult`](../../../lib/services/garmin/allocate-memory/spec/type-aliases/AllocateGarminMemoryResult.md)

### garbageCollect

> **garbageCollect**: (`input`) => [`GarbageCollectResult`](../../../lib/services/garmin/garbage-collect/spec/type-aliases/GarbageCollectResult.md)

#### Parameters

##### input

###### state

[`GameEngineState`](../../../lib/garmin/engine/interfaces/GameEngineState.md) = `...`

#### Returns

[`GarbageCollectResult`](../../../lib/services/garmin/garbage-collect/spec/type-aliases/GarbageCollectResult.md)

### syncFlashStorage

> **syncFlashStorage**: (`input`) => `Promise`\<[`SyncFlashStorageResult`](../../../lib/services/garmin/sync-flash-storage/spec/type-aliases/SyncFlashStorageResult.md)\>

#### Parameters

##### input

###### action

`"load"` \| `"save"` \| `"clear"` = `...`

###### variables?

`object`[] = `...`

#### Returns

`Promise`\<[`SyncFlashStorageResult`](../../../lib/services/garmin/sync-flash-storage/spec/type-aliases/SyncFlashStorageResult.md)\>
