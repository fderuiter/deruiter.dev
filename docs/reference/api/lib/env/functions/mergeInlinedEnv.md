[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/env](../README.md) / mergeInlinedEnv

# Function: mergeInlinedEnv()

> **mergeInlinedEnv**(`processEnv`, `inlined`): `Record`\<`string`, `string` \| `undefined`\>

Merge the runtime `process.env` object with the inlined values.

On the server the two agree. In the browser the object is empty and the
inlined values are the only source, so an inlined value wins wherever it is
defined.

## Parameters

### processEnv

`Record`\<`string`, `string` \| `undefined`\>

The runtime `process.env` object.

### inlined

`Record`\<`string`, `string` \| `undefined`\>

The values the bundler substituted, by name.

## Returns

`Record`\<`string`, `string` \| `undefined`\>

The environment to validate.
