[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/services/garmin/allocate-memory/handler](../README.md) / AllocateGarminMemoryHandler

# Class: AllocateGarminMemoryHandler

## Implements

- [`AllocateGarminMemorySpec`](../../spec/interfaces/AllocateGarminMemorySpec.md)

## Constructors

### Constructor

> **new AllocateGarminMemoryHandler**(): `AllocateGarminMemoryHandler`

#### Returns

`AllocateGarminMemoryHandler`

## Methods

### execute()

> **execute**(`input`): [`AllocateGarminMemoryResult`](../../spec/type-aliases/AllocateGarminMemoryResult.md)

#### Parameters

##### input

###### name?

`string` = `...`

###### state

[`GameEngineState`](../../../../../garmin/engine/interfaces/GameEngineState.md) = `...`

###### type

`"string"` \| `"int"` \| `"array"` \| `"float"` = `VariableTypeSchema`

#### Returns

[`AllocateGarminMemoryResult`](../../spec/type-aliases/AllocateGarminMemoryResult.md)

#### Implementation of

[`AllocateGarminMemorySpec`](../../spec/interfaces/AllocateGarminMemorySpec.md).[`execute`](../../spec/interfaces/AllocateGarminMemorySpec.md#execute)
