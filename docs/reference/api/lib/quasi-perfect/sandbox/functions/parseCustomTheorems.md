[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/quasi-perfect/sandbox](../README.md) / parseCustomTheorems

# Function: parseCustomTheorems()

> **parseCustomTheorems**(`raw`): [`CustomTheorem`](../interfaces/CustomTheorem.md)[]

Parse the saved custom theorems without throwing. Malformed JSON, a
non-array value and entries without a string id and formula are dropped,
and anything past [MAX\_CUSTOM\_THEOREMS](../variables/MAX_CUSTOM_THEOREMS.md) is ignored.

## Parameters

### raw

`string` \| `null`

The stored string, or null when nothing is stored.

## Returns

[`CustomTheorem`](../interfaces/CustomTheorem.md)[]

The saved theorems, oldest first.
