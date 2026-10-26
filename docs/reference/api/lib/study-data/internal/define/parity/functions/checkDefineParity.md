[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/define/parity](../README.md) / checkDefineParity

# Function: checkDefineParity()

> **checkDefineParity**(`define`, `datasets`): [`Finding`](../../../../types/interfaces/Finding.md)[]

Compares a Define-XML document model with the datasets of its layer.

## Parameters

### define

[`DefineDocument`](../../model/interfaces/DefineDocument.md)

The document, as `buildDefine` returns it.

### datasets

readonly [`Dataset`](../../../../types/interfaces/Dataset.md)[]

The run's datasets; only those of the document's layer
  are compared.

## Returns

[`Finding`](../../../../types/interfaces/Finding.md)[]

One error finding per gap, in document order; none when the
  document and the data agree.
