[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/export/dataset-json](../README.md) / writeDatasetJson

# Function: writeDatasetJson()

> **writeDatasetJson**(`dataset`, `options`): `string`

Serialises one dataset as Dataset-JSON 1.1 text: compact JSON with a
trailing newline. Number formatting is ECMAScript's shortest round-trip
form, so the bytes do not depend on the platform or locale.

## Parameters

### dataset

[`Dataset`](../../../../types/interfaces/Dataset.md)

### options

[`DatasetJsonOptions`](../interfaces/DatasetJsonOptions.md)

## Returns

`string`
