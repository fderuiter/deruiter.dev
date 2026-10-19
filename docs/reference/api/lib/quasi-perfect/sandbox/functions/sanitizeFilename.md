[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/quasi-perfect/sandbox](../README.md) / sanitizeFilename

# Function: sanitizeFilename()

> **sanitizeFilename**(`name`, `defaultName?`): `string`

Sanitizes a title or theorem name into a valid, safe filename.

Replaces non-alphanumeric characters (except underscores/hyphens) with underscores,
collapses consecutive underscores, strips leading/trailing underscores,
and falls back to `defaultName` if empty.

## Parameters

### name

`string`

### defaultName?

`string` = `"export"`

## Returns

`string`
