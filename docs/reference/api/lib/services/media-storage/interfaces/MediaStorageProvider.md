[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/services/media-storage](../README.md) / MediaStorageProvider

# Interface: MediaStorageProvider

Pluggable media storage provider contract per ADR 0043.

Operations return a [MediaStorageResult](../type-aliases/MediaStorageResult.md) instead of throwing. A missing
asset is a success with `null` data, not a failure.

## Methods

### delete()

> **delete**(`key`): `Promise`\<[`MediaStorageResult`](../type-aliases/MediaStorageResult.md)\<`null`\>\>

#### Parameters

##### key

`string`

#### Returns

`Promise`\<[`MediaStorageResult`](../type-aliases/MediaStorageResult.md)\<`null`\>\>

***

### getAsset()?

> `optional` **getAsset**(`key`): `Promise`\<[`MediaStorageResult`](../type-aliases/MediaStorageResult.md)\<[`MediaAssetRecord`](MediaAssetRecord.md) \| `null`\>\>

#### Parameters

##### key

`string`

#### Returns

`Promise`\<[`MediaStorageResult`](../type-aliases/MediaStorageResult.md)\<[`MediaAssetRecord`](MediaAssetRecord.md) \| `null`\>\>

***

### getUrl()

> **getUrl**(`key`): `string`

#### Parameters

##### key

`string`

#### Returns

`string`

***

### upload()

> **upload**(`file`, `filename`, `contentType`): `Promise`\<[`MediaStorageResult`](../type-aliases/MediaStorageResult.md)\<[`MediaUploadResult`](MediaUploadResult.md)\>\>

#### Parameters

##### file

`Buffer`

##### filename

`string`

##### contentType

`string`

#### Returns

`Promise`\<[`MediaStorageResult`](../type-aliases/MediaStorageResult.md)\<[`MediaUploadResult`](MediaUploadResult.md)\>\>
