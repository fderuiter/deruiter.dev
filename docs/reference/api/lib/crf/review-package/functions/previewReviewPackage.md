[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/review-package](../README.md) / previewReviewPackage

# Function: previewReviewPackage()

> **previewReviewPackage**(`snapshot`, `options?`): [`ReviewPackagePreview`](../interfaces/ReviewPackagePreview.md)

Describes what a package of this snapshot would contain, without generating
anything. Used for the preview an author confirms before generation.

## Parameters

### snapshot

[`ReviewPackageSnapshot`](../interfaces/ReviewPackageSnapshot.md)

The snapshot taken with [createReviewPackageSnapshot](createReviewPackageSnapshot.md).

### options?

[`ReviewPackageOptions`](../interfaces/ReviewPackageOptions.md) = `{}`

Baseline, exclusions and staleness resolver.

## Returns

[`ReviewPackagePreview`](../interfaces/ReviewPackagePreview.md)

Contents, scope, unresolved findings and limitations.
