[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/review-package](../README.md) / createReviewPackageSnapshot

# Function: createReviewPackageSnapshot()

> **createReviewPackageSnapshot**(`study`): [`ReviewPackageSnapshot`](../interfaces/ReviewPackageSnapshot.md)

Takes the one snapshot a package is generated from. The study is deep
cloned and frozen, so later edits to the working draft cannot reach it.

## Parameters

### study

[`StudyProtocol`](../../types/interfaces/StudyProtocol.md)

The working study.

## Returns

[`ReviewPackageSnapshot`](../interfaces/ReviewPackageSnapshot.md)

The frozen snapshot and the revision it identifies.
