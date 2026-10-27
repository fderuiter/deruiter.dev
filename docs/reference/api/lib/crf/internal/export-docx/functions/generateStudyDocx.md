[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/crf/internal/export-docx](../README.md) / generateStudyDocx

# Function: generateStudyDocx()

> **generateStudyDocx**(`study`, `options`): `Promise`\<`Blob`\>

Generates a complete Microsoft Word (.docx) document representing the CRF Study or a Single Form.

## Parameters

### study

[`StudyProtocol`](../../../types/interfaces/StudyProtocol.md)

StudyProtocol definition

### options

[`ExportDocxOptions`](../../../types/interfaces/ExportDocxOptions.md)

Export options. `all` includes every form; `single` includes the form matching
  the first `selectedFormIds` entry; `selected` includes matching requested forms in study order.
  Those scopes throw a `RangeError` if `selectedFormIds` is missing or empty, if the first ID
  does not resolve for `single`, or if no IDs resolve for `selected`.

## Returns

`Promise`\<`Blob`\>

Promise resolving to binary Blob
