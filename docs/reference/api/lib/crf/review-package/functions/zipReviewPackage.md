[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/review-package](../README.md) / zipReviewPackage

# Function: zipReviewPackage()

> **zipReviewPackage**(`result`): `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Compresses a generated package into one zip archive. Entry timestamps are
the manifest's `generatedAt`, so the same package zips the same way.

## Parameters

### result

[`ReviewPackageResult`](../interfaces/ReviewPackageResult.md)

The result of [buildReviewPackage](buildReviewPackage.md).

## Returns

`Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

The archive bytes.
