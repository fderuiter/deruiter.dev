[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/review-package](../README.md) / ReviewPackageFindings

# Interface: ReviewPackageFindings

Everything still unresolved at the packaged revision.

## Properties

### failingTests

> **failingTests**: [`ReviewPackageScenarioFinding`](ReviewPackageScenarioFinding.md)[]

***

### neverRunTests

> **neverRunTests**: [`ReviewPackageScenarioFinding`](ReviewPackageScenarioFinding.md)[]

***

### openReviewThreads

> **openReviewThreads**: [`ReviewPackageOpenThread`](ReviewPackageOpenThread.md)[]

***

### passingTestCount

> **passingTestCount**: `number`

***

### readiness

> **readiness**: `object`

#### errors

> **errors**: [`ReviewPackageReadinessFinding`](ReviewPackageReadinessFinding.md)[]

#### score

> **score**: `number`

#### warnings

> **warnings**: [`ReviewPackageReadinessFinding`](ReviewPackageReadinessFinding.md)[]

***

### resolvedReviewThreadCount

> **resolvedReviewThreadCount**: `number`

***

### staleTests

> **staleTests**: [`ReviewPackageScenarioFinding`](ReviewPackageScenarioFinding.md)[]
