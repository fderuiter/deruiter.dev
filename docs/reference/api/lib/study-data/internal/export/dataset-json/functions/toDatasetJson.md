[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/export/dataset-json](../README.md) / toDatasetJson

# Function: toDatasetJson()

> **toDatasetJson**(`dataset`, `options`): [`DatasetJson`](../interfaces/DatasetJson.md)

Builds the Dataset-JSON 1.1 document for one SDTM or ADaM dataset.

Text columns carry their longest UTF-8 byte length. ADaM dates, datetimes
and times keep their ISO 8601 text with `targetDataType: "integer"`, the
Dataset-JSON 1.1 way of saying the value is a SAS numeric date. Missing
values are `null`.

## Parameters

### dataset

[`Dataset`](../../../../types/interfaces/Dataset.md)

An SDTM or ADaM dataset.

### options

[`DatasetJsonOptions`](../interfaces/DatasetJsonOptions.md)

Study id and creation timestamp.

## Returns

[`DatasetJson`](../interfaces/DatasetJson.md)

The document, ready for `JSON.stringify`.

## Throws

TypeError or RangeError when a value does not match its column.
