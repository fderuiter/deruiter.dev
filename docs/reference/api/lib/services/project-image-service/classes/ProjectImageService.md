[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/services/project-image-service](../README.md) / ProjectImageService

# Class: ProjectImageService

## Constructors

### Constructor

> **new ProjectImageService**(): `ProjectImageService`

#### Returns

`ProjectImageService`

## Methods

### deleteMediaAsset()

> `static` **deleteMediaAsset**(`key`): `Promise`\<[`MediaStorageResult`](../../media-storage/type-aliases/MediaStorageResult.md)\<`null`\>\>

Deletes a media asset from the active provider by key. A deployment with
no configured provider resolves to `STORAGE_UNCONFIGURED`, so missing
production credentials still fail closed.

#### Parameters

##### key

`string`

#### Returns

`Promise`\<[`MediaStorageResult`](../../media-storage/type-aliases/MediaStorageResult.md)\<`null`\>\>

***

### extractMediaKeyFromUrl()

> `static` **extractMediaKeyFromUrl**(`url`): `string` \| `null`

Extracts the storage key from a media asset URL or path.

#### Parameters

##### url

`string` \| `null` \| `undefined`

#### Returns

`string` \| `null`

***

### getMediaAsset()

> `static` **getMediaAsset**(`key`): `Promise`\<[`MediaStorageResult`](../../media-storage/type-aliases/MediaStorageResult.md)\<[`MediaAssetRecord`](../../media-storage/interfaces/MediaAssetRecord.md) \| `null`\>\>

Retrieves a media asset from storage by key. A provider without read
support, or a missing asset, resolves to `null` data.

#### Parameters

##### key

`string`

#### Returns

`Promise`\<[`MediaStorageResult`](../../media-storage/type-aliases/MediaStorageResult.md)\<[`MediaAssetRecord`](../../media-storage/interfaces/MediaAssetRecord.md) \| `null`\>\>

***

### saveMediaAsset()

> `static` **saveMediaAsset**(`key`, `buffer`, `contentType`): `Promise`\<[`MediaStorageResult`](../../media-storage/type-aliases/MediaStorageResult.md)\<`string`\>\>

Saves a validated media buffer to the active storage provider and returns
its asset URL. A failure means the asset was not stored durably, so the
caller must not persist a URL for it.

#### Parameters

##### key

`string`

##### buffer

`Buffer`

##### contentType

`string`

#### Returns

`Promise`\<[`MediaStorageResult`](../../media-storage/type-aliases/MediaStorageResult.md)\<`string`\>\>

***

### uploadProjectImage()

> `static` **uploadProjectImage**(`slug`, `fileBuffer`, `mimeType`): `Promise`\<[`ProjectImageResult`](../type-aliases/ProjectImageResult.md)\>

Processes, validates, persists, and links a project image asset to a case study.
If database persistence fails, the prior asset is preserved.

Never throws: every failure is returned as a typed [ProjectImageErrorCode](../variables/ProjectImageErrorCode.md).

#### Parameters

##### slug

`string`

##### fileBuffer

`Buffer`

##### mimeType

`string`

#### Returns

`Promise`\<[`ProjectImageResult`](../type-aliases/ProjectImageResult.md)\>
