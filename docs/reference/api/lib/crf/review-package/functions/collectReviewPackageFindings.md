[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/review-package](../README.md) / collectReviewPackageFindings

# Function: collectReviewPackageFindings()

> **collectReviewPackageFindings**(`snapshot`, `options?`): [`ReviewPackageFindings`](../interfaces/ReviewPackageFindings.md)

Collects everything still unresolved at the snapshot: open review threads,
stale, failing and never-run tests, and readiness errors and warnings.

## Parameters

### snapshot

[`ReviewPackageSnapshot`](../interfaces/ReviewPackageSnapshot.md)

The packaged snapshot.

### options?

`Pick`\<[`ReviewPackageOptions`](../interfaces/ReviewPackageOptions.md), `"isScenarioStale"`\> = `{}`

Supplies the optional staleness resolver.

## Returns

[`ReviewPackageFindings`](../interfaces/ReviewPackageFindings.md)

Findings in a stable order.
