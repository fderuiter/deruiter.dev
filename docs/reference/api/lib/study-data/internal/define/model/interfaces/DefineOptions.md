[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/define/model](../README.md) / DefineOptions

# Interface: DefineOptions

Inputs to `buildDefine` that are not in the run itself.

## Properties

### createdAt

> `readonly` **createdAt**: `string`

The ODM `CreationDateTime`, an ISO 8601 timestamp with a zone. The study
data package passes its fixed reproducibility timestamp, so the bytes
depend only on the run; the real build time stays in its timestamp file.

***

### layer

> `readonly` **layer**: [`DefineLayer`](../type-aliases/DefineLayer.md)

Which layer's datasets the document describes.
