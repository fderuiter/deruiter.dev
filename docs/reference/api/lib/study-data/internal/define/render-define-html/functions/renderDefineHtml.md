[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/define/render-define-html](../README.md) / renderDefineHtml

# Function: renderDefineHtml()

> **renderDefineHtml**(`define`): `string`

Renders a Define-XML document model as readable HTML.

The view lists the standards, the datasets, each dataset's variables with
their type, length, controlled terms, origin and method, the value-level
metadata, the codelists with their NCI codes and extended values, the
methods and the comments. Every anchor id starts with the layer, so the
SDTM and ADaM views can share one page.

## Parameters

### define

[`DefineDocument`](../../model/interfaces/DefineDocument.md)

The model from `buildDefine`.

## Returns

`string`

One HTML `article` element as a string, with a trailing newline.
