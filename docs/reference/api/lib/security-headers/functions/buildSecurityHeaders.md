[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/security-headers](../README.md) / buildSecurityHeaders

# Function: buildSecurityHeaders()

> **buildSecurityHeaders**(`admin`, `wasm?`): `Record`\<`string`, `string`\>

Builds the standard security header set for the public or admin surface.

## Parameters

### admin

`boolean`

Whether the headers are for the admin surface.

### wasm?

`boolean` = `false`

Whether the policy also allows WebAssembly compilation.

## Returns

`Record`\<`string`, `string`\>
