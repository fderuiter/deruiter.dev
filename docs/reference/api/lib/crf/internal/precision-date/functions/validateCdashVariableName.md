[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/crf/internal/precision-date](../README.md) / validateCdashVariableName

# Function: validateCdashVariableName()

> **validateCdashVariableName**(`name`): `object`

Strict CDASH 2.2 / SAS Variable Name Validator
Rules:
- 1 to 8 characters in length
- Must start with a letter (A-Z)
- May contain only uppercase letters (A-Z), numbers (0-9), and underscores (_)
- No spaces or special characters

## Parameters

### name

`string`

## Returns

`object`

### error?

> `optional` **error?**: `string`

### isValid

> **isValid**: `boolean`

### sanitized

> **sanitized**: `string`
