[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/export/dataset-json](../README.md) / DatasetJsonOptions

# Interface: DatasetJsonOptions

Inputs to the Dataset-JSON writer that are not in the dataset itself.

## Properties

### createdAt

> `readonly` **createdAt**: `string`

`datasetJSONCreationDateTime`. The package passes its fixed
reproducibility timestamp so the file bytes depend only on the run.

***

### studyId

> `readonly` **studyId**: `string`

Study identifier, for the study and metadata version OIDs.
