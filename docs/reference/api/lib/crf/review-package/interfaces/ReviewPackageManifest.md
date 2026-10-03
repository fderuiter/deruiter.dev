[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/review-package](../README.md) / ReviewPackageManifest

# Interface: ReviewPackageManifest

The machine-readable manifest written to `MANIFEST.json`.

## Properties

### comparison

> **comparison**: \{ `baselineChecksum`: `string`; `baselineId`: `string`; `label`: `string`; `totalChanges`: `number`; `versionTag`: `string`; \} \| `null`

***

### contents

> **contents**: `object`[]

#### bytes

> **bytes**: `number` \| `null`

#### checksum

> **checksum**: `string` \| `null`

Content checksum for text artifacts; null for rendered PDFs.

#### format

> **format**: `"text"` \| `"json"` \| `"csv"` \| `"pdf"`

#### id

> **id**: [`ReviewPackageArtifactId`](../type-aliases/ReviewPackageArtifactId.md) \| `"manifest"` \| `"readme"`

#### path

> **path**: `string`

#### title

> **title**: `string`

***

### excluded

> **excluded**: `object`[]

#### id

> **id**: [`ReviewPackageArtifactId`](../type-aliases/ReviewPackageArtifactId.md)

#### reason

> **reason**: `string`

#### title

> **title**: `string`

***

### format

> **format**: `"crf-review-package"`

***

### formatVersion

> **formatVersion**: `1`

***

### generatedAt

> **generatedAt**: `string`

***

### generator

> **generator**: `object`

#### name

> **name**: `string`

#### version

> **version**: `string`

***

### limitations

> **limitations**: `string`[]

***

### nativeSource

> **nativeSource**: [`ReviewPackageNativeSourceCheck`](ReviewPackageNativeSourceCheck.md)

***

### revision

> **revision**: [`ReviewPackageRevision`](ReviewPackageRevision.md)

***

### scope

> **scope**: [`ReviewPackageScope`](ReviewPackageScope.md)

***

### unresolvedFindings

> **unresolvedFindings**: [`ReviewPackageFindings`](ReviewPackageFindings.md)
