[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/tlf/win-ratio](../README.md) / normalQuantile

# Function: normalQuantile()

> **normalQuantile**(`p`): `number`

The standard normal quantile, by Wichura's algorithm AS 241 (PPND16),
accurate to about 1 part in 10^16.

## Parameters

### p

`number`

A probability strictly between 0 and 1.

## Returns

`number`

## Throws

RangeError when `p` is outside (0, 1).
