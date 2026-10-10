[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/form-templates](../README.md) / captureFormTemplate

# Function: captureFormTemplate()

> **captureFormTemplate**(`options`): [`FormTemplate`](../interfaces/FormTemplate.md)

Captures a form, with the codelists its fields use, into a new template.
The copy is independent of the study, and a data lock on the source form
does not carry over.

## Parameters

### options

#### codelists

readonly [`CodelistDefinition`](../../types/interfaces/CodelistDefinition.md)[]

#### description?

`string`

#### form

[`CRFForm`](../../types/interfaces/CRFForm.md)

#### name?

`string`

#### now?

`Date`

## Returns

[`FormTemplate`](../interfaces/FormTemplate.md)
