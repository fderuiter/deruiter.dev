[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/dx/setup/environment](../README.md) / AtomicWriteIo

# Interface: AtomicWriteIo

File operations used by [writeFileAtomic](../functions/writeFileAtomic.md); injectable for tests.

## Methods

### renameSync()

> **renameSync**(`from`, `to`): `void`

#### Parameters

##### from

`string`

##### to

`string`

#### Returns

`void`

***

### rmSync()

> **rmSync**(`file`, `options`): `void`

#### Parameters

##### file

`string`

##### options

###### force

`boolean`

#### Returns

`void`

***

### writeFileSync()

> **writeFileSync**(`file`, `data`, `options`): `void`

#### Parameters

##### file

`string`

##### data

`string`

##### options

###### mode

`number`

#### Returns

`void`
