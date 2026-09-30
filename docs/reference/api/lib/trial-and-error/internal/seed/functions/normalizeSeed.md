[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/trial-and-error/internal/seed](../README.md) / normalizeSeed

# Function: normalizeSeed()

> **normalizeSeed**(`input`): `string` \| `null`

A codec seed in its canonical `XXXX-XXXX` form, or null when `input` is
not eight base32 characters. Case, spaces and hyphens are ignored, and
I and L read as 1, O as 0.

## Parameters

### input

`string`

## Returns

`string` \| `null`
