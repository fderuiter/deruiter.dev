[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/form-catalog](../README.md) / instantiateCatalogForm

# Function: instantiateCatalogForm()

> **instantiateCatalogForm**(`entryId`, `study`, `savedTemplates?`): \{ `codelists`: [`CodelistDefinition`](../../types/interfaces/CodelistDefinition.md)[]; `form`: [`CRFForm`](../../types/interfaces/CRFForm.md); \} \| `null`

An independent copy of a form entry, ready to add to `study`: fresh ids,
colliding CDASH variable names renamed, and only the codelists the study
lacks. Returns null for a block entry or an id the catalog does not hold.

## Parameters

### entryId

`string`

### study

[`StudyProtocol`](../../types/interfaces/StudyProtocol.md)

### savedTemplates?

readonly [`FormTemplate`](../../form-templates/interfaces/FormTemplate.md)[] = `[]`

## Returns

\{ `codelists`: [`CodelistDefinition`](../../types/interfaces/CodelistDefinition.md)[]; `form`: [`CRFForm`](../../types/interfaces/CRFForm.md); \} \| `null`
