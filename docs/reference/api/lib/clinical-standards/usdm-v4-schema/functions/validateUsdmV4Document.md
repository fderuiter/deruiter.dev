[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-standards/usdm-v4-schema](../README.md) / validateUsdmV4Document

# Function: validateUsdmV4Document()

> **validateUsdmV4Document**(`doc`): `Promise`\<`string`[]\>

Validates a document against the USDM v4.0.0 Wrapper schema.

## Parameters

### doc

`unknown`

The parsed document.

## Returns

`Promise`\<`string`[]\>

The schema issues as `path: message` strings, empty when the
  document is valid.
