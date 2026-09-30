[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/services/media-storage](../README.md) / LocalStorageProvider

# Class: LocalStorageProvider

Local filesystem storage provider persisting media assets to disk (.media-storage/).
Used in local development and automated testing environments.

## Implements

- [`MediaStorageProvider`](../interfaces/MediaStorageProvider.md)

## Constructors

### Constructor

> **new LocalStorageProvider**(`baseDir?`): `LocalStorageProvider`

#### Parameters

##### baseDir?

`string`

#### Returns

`LocalStorageProvider`

## Methods

### delete()

> **delete**(`key`): `Promise`\<[`MediaStorageResult`](../type-aliases/MediaStorageResult.md)\<`null`\>\>

#### Parameters

##### key

`string`

#### Returns

`Promise`\<[`MediaStorageResult`](../type-aliases/MediaStorageResult.md)\<`null`\>\>

#### Implementation of

[`MediaStorageProvider`](../interfaces/MediaStorageProvider.md).[`delete`](../interfaces/MediaStorageProvider.md#delete)

***

### getAsset()

> **getAsset**(`key`): `Promise`\<[`MediaStorageResult`](../type-aliases/MediaStorageResult.md)\<[`MediaAssetRecord`](../interfaces/MediaAssetRecord.md) \| `null`\>\>

#### Parameters

##### key

`string`

#### Returns

`Promise`\<[`MediaStorageResult`](../type-aliases/MediaStorageResult.md)\<[`MediaAssetRecord`](../interfaces/MediaAssetRecord.md) \| `null`\>\>

#### Implementation of

[`MediaStorageProvider`](../interfaces/MediaStorageProvider.md).[`getAsset`](../interfaces/MediaStorageProvider.md#getasset)

***

### getUrl()

> **getUrl**(`key`): `string`

#### Parameters

##### key

`string`

#### Returns

`string`

#### Implementation of

[`MediaStorageProvider`](../interfaces/MediaStorageProvider.md).[`getUrl`](../interfaces/MediaStorageProvider.md#geturl)

***

### upload()

> **upload**(`file`, `filename`, `_contentType`): `Promise`\<[`MediaStorageResult`](../type-aliases/MediaStorageResult.md)\<[`MediaUploadResult`](../interfaces/MediaUploadResult.md)\>\>

#### Parameters

##### file

`Buffer`

##### filename

`string`

##### \_contentType

`string`

#### Returns

`Promise`\<[`MediaStorageResult`](../type-aliases/MediaStorageResult.md)\<[`MediaUploadResult`](../interfaces/MediaUploadResult.md)\>\>

#### Implementation of

[`MediaStorageProvider`](../interfaces/MediaStorageProvider.md).[`upload`](../interfaces/MediaStorageProvider.md#upload)
