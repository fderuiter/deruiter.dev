[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/laser-loon/engine](../README.md) / parseActBestRecord

# Function: parseActBestRecord()

> **parseActBestRecord**(`raw`): [`ActBestRecord`](../type-aliases/ActBestRecord.md)

Reads the saved act bests, dropping anything malformed so a damaged entry
never breaks the cabinet.

## Parameters

### raw

`string` \| `null`

The stored JSON, or null when nothing is saved.

## Returns

[`ActBestRecord`](../type-aliases/ActBestRecord.md)
