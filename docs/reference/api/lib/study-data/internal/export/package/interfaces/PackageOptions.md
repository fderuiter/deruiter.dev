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

***

### reportingEvent?

> `readonly` `optional` **reportingEvent?**: [`ArsReportingEvent`](../../../../types/interfaces/ArsReportingEvent.md)

The run's ARS reporting event, from `buildTlfOutputs`. When given, the
ADRG-lite lists every output and the analyses it displays, and every
result whose rows do not resolve in the run is a finding.
