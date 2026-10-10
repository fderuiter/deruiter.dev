[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/form-templates](../README.md) / parseFormTemplatePackage

# Function: parseFormTemplatePackage()

> **parseFormTemplatePackage**(`json`): `object`

Validates a package and returns its templates with fresh ids, so importing
never replaces a saved template.

## Parameters

### json

`string`

## Returns

`object`

### skipped

> **skipped**: `number`

### templates

> **templates**: [`FormTemplate`](../interfaces/FormTemplate.md)[]

## Throws

Error with a message fit to show the user when the package is too
large, not JSON, not a template package, or holds no valid template.
