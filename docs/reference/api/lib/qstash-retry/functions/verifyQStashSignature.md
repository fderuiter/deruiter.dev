[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/qstash-retry](../README.md) / verifyQStashSignature

# Function: verifyQStashSignature()

> **verifyQStashSignature**(`signature`, `body`): `Promise`\<`boolean`\>

Verifies an inbound QStash delivery against both signing keys (current, then
next, so key rotation never drops messages). Returns false for a missing
signature, missing keys, wrong signature or wrong target URL.

## Parameters

### signature

`string` \| `null`

### body

`string`

## Returns

`Promise`\<`boolean`\>
