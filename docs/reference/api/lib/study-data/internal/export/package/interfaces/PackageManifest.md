[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/export/package](../README.md) / PackageManifest

# Interface: PackageManifest

`MANIFEST.json`: the run inputs, standards and a hash of every file.

## Properties

### csvNotice

> `readonly` **csvNotice**: `string`

***

### fileFormats

> `readonly` **fileFormats**: `Readonly`\<`Record`\<`"json"` \| `"csv"` \| `"xpt"` \| `"xml"` \| `"html"`, `string`\>\>

***

### files

> `readonly` **files**: readonly ([`ManifestEntry`](../../../../types/interfaces/ManifestEntry.md) & `object`)[]

***

### findings

> `readonly` **findings**: readonly [`Finding`](../../../../types/interfaces/Finding.md)[]

***

### fixedTimestamp

> `readonly` **fixedTimestamp**: `string`

***

### formatVersion

> `readonly` **formatVersion**: `string`

***

### notHashed

> `readonly` **notHashed**: readonly `string`[]

***

### notice

> `readonly` **notice**: `string`

***

### nSubjects

> `readonly` **nSubjects**: `number`

***

### seed

> `readonly` **seed**: `number`

***

### stages

> `readonly` **stages**: readonly [`PipelineStageId`](../../../../types/type-aliases/PipelineStageId.md)[]

***

### standards

> `readonly` **standards**: [`StandardVersions`](../../../../types/type-aliases/StandardVersions.md)

***

### studyId

> `readonly` **studyId**: `string`

***

### timestampFile

> `readonly` **timestampFile**: `string`
