[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/export/ibm-float](../README.md) / encodeIbmFloat

# Function: encodeIbmFloat()

> **encodeIbmFloat**(`value`): `Uint8Array`

Encodes one number as an 8-byte big-endian IBM double. `null` encodes the
SAS missing value `.`; zero, positive or negative, encodes as eight zero
bytes.

## Parameters

### value

`number` \| `null`

A finite number, or `null` for missing.

## Returns

`Uint8Array`

Eight bytes.

## Throws

RangeError when the value is not finite or outside the IBM range
  (about 5.4e-79 to 7.2e75 in magnitude).
