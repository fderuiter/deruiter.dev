[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/review-package](../README.md) / openReviewPackage

# Function: openReviewPackage()

> **openReviewPackage**(`data`): `Promise`\<[`OpenedReviewPackage`](../interfaces/OpenedReviewPackage.md)\>

Reads a review package archive and reopens its native source, exactly as
an author receiving the package would.

## Parameters

### data

`ArrayBuffer` \| `Blob` \| `Uint8Array`\<`ArrayBufferLike`\>

The archive bytes.

## Returns

`Promise`\<[`OpenedReviewPackage`](../interfaces/OpenedReviewPackage.md)\>

The manifest, the reopened study and the archive's file paths.
