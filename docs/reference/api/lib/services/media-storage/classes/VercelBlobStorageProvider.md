[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/services/media-storage](../README.md) / VercelBlobStorageProvider

# Class: VercelBlobStorageProvider

Cloud storage provider directing media uploads to Vercel Blob.
Active in preview and production environments with BLOB_READ_WRITE_TOKEN.

Constructed without a token, explicit or from the environment, every
operation returns `STORAGE_UNCONFIGURED` without making a request.

## Implements

- [`MediaStorageProvider`](../interfaces/MediaStorageProvider.md)

## Constructors

### Constructor

> **new VercelBlobStorageProvider**(`token?`): `VercelBlobStorageProvider`

#### Parameters

##### token?

`string`

#### Returns

`VercelBlobStorageProvider`

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

### isConfigured()

> **isConfigured**(): `boolean`

Whether a Blob read-write token is available to this provider.

#### Returns

`boolean`

***

### upload()

> **upload**(`file`, `filename`, `contentType`): `Promise`\<[`MediaStorageResult`](../type-aliases/MediaStorageResult.md)\<[`MediaUploadResult`](../interfaces/MediaUploadResult.md)\>\>

#### Parameters

##### file

`Buffer`

##### filename

`string`

##### contentType

`string`

#### Returns

`Promise`\<[`MediaStorageResult`](../type-aliases/MediaStorageResult.md)\<[`MediaUploadResult`](../interfaces/MediaUploadResult.md)\>\>

#### Implementation of

[`MediaStorageProvider`](../interfaces/MediaStorageProvider.md).[`upload`](../interfaces/MediaStorageProvider.md#upload)
