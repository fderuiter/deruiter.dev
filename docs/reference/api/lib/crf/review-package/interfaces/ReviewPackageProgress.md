[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/review-package](../README.md) / ReviewPackageProgress

# Interface: ReviewPackageProgress

One progress notification while a package is generated.

## Properties

### index

> **index**: `number`

Zero-based position of this step.

***

### label

> **label**: `string`

***

### status

> **status**: `"running"` \| `"done"` \| `"reused"`

***

### stepId

> **stepId**: [`ReviewPackageArtifactId`](../type-aliases/ReviewPackageArtifactId.md) \| `"verify_native_source"` \| `"manifest"`

***

### total

> **total**: `number`
