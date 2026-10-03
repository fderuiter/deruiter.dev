[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/dx/setup/environment](../README.md) / upsertEnvContent

# Function: upsertEnvContent()

> **upsertEnvContent**(`content`, `updates`): `string`

Applies `updates` to dotenv `content` and returns the new text. Existing
assignments are replaced on the line they occupy (the last one, if a key
repeats); new keys are appended. Comments, blank lines and unrelated
values are kept byte for byte.

## Parameters

### content

`string`

### updates

`Readonly`\<`Record`\<`string`, `string`\>\>

## Returns

`string`
