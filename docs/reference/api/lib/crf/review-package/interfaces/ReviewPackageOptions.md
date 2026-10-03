[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/review-package](../README.md) / ReviewPackageOptions

# Interface: ReviewPackageOptions

Options shared by preview and generation.

## Extended by

- [`BuildReviewPackageOptions`](BuildReviewPackageOptions.md)

## Properties

### baseline?

> `optional` **baseline?**: [`ReviewPackageBaseline`](ReviewPackageBaseline.md) \| `null`

Baseline to summarize changes against. Without one, the change summary is left out.

***

### exclude?

> `optional` **exclude?**: readonly [`ReviewPackageOptionalArtifactId`](../type-aliases/ReviewPackageOptionalArtifactId.md)[]

Optional artifacts to leave out. The native source cannot be excluded.

***

### generatedAt?

> `optional` **generatedAt?**: `string` \| `Date`

Timestamp recorded in the manifest and report headers. Defaults to now.

***

### isScenarioStale?

> `optional` **isScenarioStale?**: [`ReviewPackageStalenessResolver`](../type-aliases/ReviewPackageStalenessResolver.md)

Overrides the built-in staleness check for scenario evidence.
