[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/download](../README.md) / sanitizeFilename

# Function: sanitizeFilename()

> **sanitizeFilename**(`name`, `fallback`): `string`

Turns a title or identifier into a file name stem that is safe on every
common file system. Accents are folded to their base letters, each run of
characters other than ASCII letters, digits, dots, underscores and hyphens
becomes one underscore, and leading or trailing dots, underscores and
hyphens are removed, so the result is never a hidden file.

## Parameters

### name

`string`

The text to derive the stem from, such as a theorem name.

### fallback

`string`

Returned when nothing usable is left of `name`.

## Returns

`string`

The sanitized stem, without an extension.
