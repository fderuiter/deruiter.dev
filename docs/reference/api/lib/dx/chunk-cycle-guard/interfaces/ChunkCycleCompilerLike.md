[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/dx/chunk-cycle-guard](../README.md) / ChunkCycleCompilerLike

# Interface: ChunkCycleCompilerLike

A webpack compiler, reduced to what the plugin reads.

## Properties

### context?

> `optional` **context?**: `string`

***

### hooks

> **hooks**: `object`

#### compilation

> **compilation**: `object`

##### compilation.tap()

> **tap**(`name`, `callback`): `void`

###### Parameters

###### name

`string`

###### callback

(`compilation`) => `void`

###### Returns

`void`

***

### webpack?

> `optional` **webpack?**: `object`

#### WebpackError?

> `optional` **WebpackError?**: new (`message`) => `Error`

##### Parameters

###### message

`string`

##### Returns

`Error`
