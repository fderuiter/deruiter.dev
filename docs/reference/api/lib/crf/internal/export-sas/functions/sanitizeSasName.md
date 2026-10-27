[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/crf/internal/export-sas](../README.md) / sanitizeSasName

# Function: sanitizeSasName()

> **sanitizeSasName**(`name`, `maxLength?`): `string`

Sanitizes a string into a valid SAS variable or dataset name.
- Maximum 32 characters
- Must start with letter or underscore
- May contain letters, numbers, underscores
- Converted to uppercase

## Parameters

### name

`string`

### maxLength?

`number` = `32`

## Returns

`string`
