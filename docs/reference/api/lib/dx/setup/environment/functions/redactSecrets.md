[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/dx/setup/environment](../README.md) / redactSecrets

# Function: redactSecrets()

> **redactSecrets**(`text`, `values`): `string`

Replaces every occurrence of a secret value in `text` with `[redacted]`.
Used on subprocess output before it is shown, in case a tool echoes a
value back.

## Parameters

### text

`string`

### values

`Readonly`\<`Record`\<`string`, `string`\>\>

## Returns

`string`
