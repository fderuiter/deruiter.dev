[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/crf/internal/export-acrf](../README.md) / generateAcrfHtml

# Function: generateAcrfHtml()

> **generateAcrfHtml**(`form`, `study`, `options?`): `string`

Generates an HTML printable document with optional annotated SDTM/CDASH tags overlaid for a single form.

## Parameters

### form

[`CRFForm`](../../../types/interfaces/CRFForm.md)

The form to render

### study

[`StudyProtocol`](../../../types/interfaces/StudyProtocol.md)

The parent study protocol

### options?

[`AcrfHtmlOptions`](../interfaces/AcrfHtmlOptions.md) = `{}`

Mode ("blank" | "annotated") and branding overrides

## Returns

`string`

HTML document string
