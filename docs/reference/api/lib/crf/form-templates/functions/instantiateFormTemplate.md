[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/form-templates](../README.md) / instantiateFormTemplate

# Function: instantiateFormTemplate()

> **instantiateFormTemplate**(`template`, `study`): `object`

An independent copy of the template, ready to add to a study: fresh ids
throughout, edit-check references remapped, and CDASH variable names that
collide with the study's renamed. `codelists` are only those the study does
not already have.

## Parameters

### template

[`FormTemplate`](../interfaces/FormTemplate.md)

### study

[`StudyProtocol`](../../types/interfaces/StudyProtocol.md)

## Returns

`object`

### codelists

> **codelists**: [`CodelistDefinition`](../../types/interfaces/CodelistDefinition.md)[]

### form

> **form**: [`CRFForm`](../../types/interfaces/CRFForm.md)
