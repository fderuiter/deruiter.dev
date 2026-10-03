[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/dx/setup/environment](../README.md) / collectEnvValue

# Function: collectEnvValue()

> **collectEnvValue**(`key`, `prompter`, `current`, `template?`, `hint?`): `Promise`\<`string` \| `undefined`\>

Asks for one value. When the key already holds a real value the user is
first asked, by name only, whether to replace it. Returns `undefined` when
nothing should change.

## Parameters

### key

`string`

### prompter

[`SetupPrompter`](../../prompts/interfaces/SetupPrompter.md)

### current

`string` \| `undefined`

### template?

`string`

### hint?

`string`

## Returns

`Promise`\<`string` \| `undefined`\>
