[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-standards/bom](../README.md) / compareVersions

# Function: compareVersions()

> **compareVersions**(`a`, `b`): `number`

Compares two dotted versions numerically, ignoring a leading `v`.

## Parameters

### a

`string`

A version such as `3.4` or `v0.17.1`.

### b

`string`

Another version, or an ISO date such as `2026-09-25`.

## Returns

`number`

Negative, zero or positive, as for `Array.prototype.sort`.
