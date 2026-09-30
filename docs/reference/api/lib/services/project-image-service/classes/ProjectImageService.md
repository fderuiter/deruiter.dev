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

> `static` **deleteMediaAsset**(`key`): `Promise`\<`boolean`\>

Deletes a media asset from the active provider by key.
Returns false when deletion fails. Provider selection/configuration errors
remain exceptions so missing production credentials fail closed.

#### Parameters

##### key

`string`

#### Returns

`Promise`\<`boolean`\>

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

> `static` **getMediaAsset**(`key`): `Promise`\<[`MediaAssetRecord`](../../media-storage/interfaces/MediaAssetRecord.md) \| `null`\>

Retrieves a media asset from storage by key.

#### Parameters

##### key

`string`

#### Returns

`Promise`\<[`MediaAssetRecord`](../../media-storage/interfaces/MediaAssetRecord.md) \| `null`\>

***

### saveMediaAsset()

> `static` **saveMediaAsset**(`key`, `buffer`, `contentType`): `Promise`\<`string`\>

Saves a validated media buffer to the active storage provider and returns
its asset URL. Upload failures are propagated so callers never persist a
URL for an asset that was not stored durably.

#### Parameters

##### key

`string`

##### buffer

`Buffer`

##### contentType

`string`

#### Returns

`Promise`\<`string`\>

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
