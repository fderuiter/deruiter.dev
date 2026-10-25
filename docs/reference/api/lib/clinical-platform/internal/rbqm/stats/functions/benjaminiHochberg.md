[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/rbqm/stats](../README.md) / benjaminiHochberg

# Function: benjaminiHochberg()

> **benjaminiHochberg**(`pValues`): `number`[]

Benjamini-Hochberg adjusted p-values (q-values). A hypothesis is rejected
at false discovery rate `q` exactly when its adjusted value is at most `q`.

## Parameters

### pValues

readonly `number`[]

p-values, each between 0 and 1.

## Returns

`number`[]

Adjusted values in the input order, each between 0 and 1.

## Throws

RangeError when a p-value is outside [0, 1].
