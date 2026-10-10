[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/form-templates](../README.md) / importFormTemplates

# Function: importFormTemplates()

> **importFormTemplates**(`json`, `storage?`): `object`

Imports a package into the store. Stops at [MAX\_FORM\_TEMPLATES](../variables/MAX_FORM_TEMPLATES.md); the
rest count as skipped.

## Parameters

### json

`string`

### storage?

[`RawStorage`](../../../safe-storage/type-aliases/RawStorage.md)

## Returns

`object`

### imported

> **imported**: `number`

### result

> **result**: [`SaveFormTemplatesResult`](../type-aliases/SaveFormTemplatesResult.md)

### skipped

> **skipped**: `number`
