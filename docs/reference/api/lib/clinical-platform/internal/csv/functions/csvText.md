[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/clinical-platform/internal/csv](../README.md) / csvText

# Function: csvText()

> **csvText**(`value`): `string`

One CSV text field, quoted when it holds a comma, quote or line break.
Text a spreadsheet would read as a formula (starting with `=`, `+`, `-`,
`@`, a tab or a carriage return) is prefixed with an apostrophe, so
opening the file never runs anything.

## Parameters

### value

`string`

The text.

## Returns

`string`

The field as written.
