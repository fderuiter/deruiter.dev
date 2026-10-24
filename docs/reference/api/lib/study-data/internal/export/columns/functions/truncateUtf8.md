[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/export/columns](../README.md) / truncateUtf8

# Function: truncateUtf8()

> **truncateUtf8**(`bytes`, `maxBytes`): `object`

Cuts UTF-8 bytes to at most `maxBytes` without splitting a character.

## Parameters

### bytes

`Uint8Array`

### maxBytes

`number`

## Returns

`object`

The kept bytes and whether anything was cut.

### bytes

> `readonly` **bytes**: `Uint8Array`

### truncated

> `readonly` **truncated**: `boolean`
