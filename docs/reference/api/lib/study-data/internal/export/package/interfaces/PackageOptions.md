[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/export/package](../README.md) / PackageOptions

# Interface: PackageOptions

Inputs to [buildStudyDataPackage](../functions/buildStudyDataPackage.md).

## Properties

### generatedAt

> `readonly` **generatedAt**: `string`

When the package was built, as an ISO 8601 timestamp with a zone, for
example `new Date().toISOString()`. It is written to
`RUN-TIMESTAMP.json` only and is not hashed.
