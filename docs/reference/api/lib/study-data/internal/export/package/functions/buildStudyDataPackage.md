[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/export/package](../README.md) / buildStudyDataPackage

# Function: buildStudyDataPackage()

> **buildStudyDataPackage**(`run`, `options`): `Promise`\<[`StudyDataPackage`](../interfaces/StudyDataPackage.md)\>

Builds the study data package for a pipeline run.

Every SDTM and ADaM dataset is written as Dataset-JSON, CSV and XPT under
the eCTD module 5 folders, and each folder gets a Define-XML document and
a reviewer guide (cSDRG-lite or ADRG-lite) for its datasets; collected data
is not exported. The returned run manifest has
`outputs` filled with the path, media type and SHA-256 of every hashed
file, and `define` and `export` added to its stages.

## Parameters

### run

[`PipelineRun`](../../../../types/interfaces/PipelineRun.md)

A pipeline run from `runPipeline`.

### options

[`PackageOptions`](../interfaces/PackageOptions.md)

When the package was built, and the reporting event for
  the ADRG-lite's output index.

## Returns

`Promise`\<[`StudyDataPackage`](../interfaces/StudyDataPackage.md)\>

The files, the manifest and the findings the formats raised.

## Throws

RangeError when `generatedAt` is not an ISO 8601 timestamp, two
  exported datasets share a name, a dataset cannot be written as XPT, the
  metadata cannot be written as Define-XML (see `buildDefine`), or a
  derived variable names a method with no derivation text.
