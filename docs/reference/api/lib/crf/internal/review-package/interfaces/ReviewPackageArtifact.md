[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/crf/internal/review-package](../README.md) / ReviewPackageArtifact

# Interface: ReviewPackageArtifact

One file in the package.

## Properties

### content

> **content**: `string` \| `Uint8Array`\<`ArrayBufferLike`\>

***

### format

> **format**: `"json"` \| `"text"` \| `"csv"` \| `"pdf"`

***

### id

> **id**: [`ReviewPackageArtifactId`](../type-aliases/ReviewPackageArtifactId.md) \| `"manifest"` \| `"readme"`

***

### mimeType

> **mimeType**: `string`

***

### path

> **path**: `string`

***

### revisionChecksum

> **revisionChecksum**: `string`

Checksum of the snapshot this artifact was generated from.

***

### title

> **title**: `string`
