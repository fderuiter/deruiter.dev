[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/dx/setup/environment](../README.md) / formatEnvAssignment

# Function: formatEnvAssignment()

> **formatEnvAssignment**(`key`, `value`): `string`

Formats one assignment. Values are double-quoted, with `$` escaped so
Next.js's dotenv expansion leaves passwords containing `$` intact. A value
holding a quote or a line break cannot round-trip safely and is refused.

## Parameters

### key

`string`

### value

`string`

## Returns

`string`
