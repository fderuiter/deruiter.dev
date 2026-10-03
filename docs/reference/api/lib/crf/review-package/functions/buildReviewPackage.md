[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/review-package](../README.md) / buildReviewPackage

# Function: buildReviewPackage()

> **buildReviewPackage**(`snapshot`, `options?`): `Promise`\<[`ReviewPackageResult`](../interfaces/ReviewPackageResult.md)\>

Generates every included artifact from one snapshot, reopens the native
source to check it, and writes the manifest and readme.

Generation yields between artifacts and reports progress. If an artifact
fails, or `signal` aborts, a [ReviewPackageBuildError](../classes/ReviewPackageBuildError.md) is thrown that
carries the artifacts already completed; pass them back as `reuse` to
resume.

## Parameters

### snapshot

[`ReviewPackageSnapshot`](../interfaces/ReviewPackageSnapshot.md)

The snapshot taken with [createReviewPackageSnapshot](createReviewPackageSnapshot.md).

### options?

[`BuildReviewPackageOptions`](../interfaces/BuildReviewPackageOptions.md) = `{}`

Baseline, exclusions, staleness resolver, progress and abort.

## Returns

`Promise`\<[`ReviewPackageResult`](../interfaces/ReviewPackageResult.md)\>

The manifest and every file in the package.
