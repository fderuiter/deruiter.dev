[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/crf/internal/export-pdf](../README.md) / generateStudyPdf

# Function: generateStudyPdf()

> **generateStudyPdf**(`study`, `options`): `Promise`\<`Blob`\>

Generates a high-fidelity PDF document representing a study or selected forms.

## Parameters

### study

[`StudyProtocol`](../../../types/interfaces/StudyProtocol.md)

StudyProtocol definition

### options

[`ExportPdfOptions`](../../../types/interfaces/ExportPdfOptions.md)

Export options. `all` includes every form; `single` includes the form matching
  the first `selectedFormIds` entry; `selected` includes matching requested forms in study order.
  Those scopes throw a `RangeError` if `selectedFormIds` is missing or empty, if the first ID
  does not resolve for `single`, or if no IDs resolve for `selected`.

## Returns

`Promise`\<`Blob`\>

Promise resolving to binary Blob
