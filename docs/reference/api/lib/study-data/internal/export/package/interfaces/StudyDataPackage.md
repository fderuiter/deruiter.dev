[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/export/package](../README.md) / StudyDataPackage

# Interface: StudyDataPackage

A built package, before it is zipped.

## Properties

### files

> `readonly` **files**: readonly [`PackageFile`](PackageFile.md)[]

Every file, the manifest and the timestamp file included, by path.

***

### findings

> `readonly` **findings**: readonly [`Finding`](../../../../types/interfaces/Finding.md)[]

Findings the formats' limits raised, for example XPT truncations.

***

### manifest

> `readonly` **manifest**: [`RunManifest`](../../../../types/interfaces/RunManifest.md)

The run manifest with `outputs` filled and the export stage added.

***

### manifestSha256

> `readonly` **manifestSha256**: `string`

SHA-256 of the `MANIFEST.json` bytes, which hold no timestamp.

***

### packageManifest

> `readonly` **packageManifest**: [`PackageManifest`](PackageManifest.md)

The content of `MANIFEST.json`.
