[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/trial-and-error/internal/seed](../README.md) / dailySeed

# Function: dailySeed()

> **dailySeed**(`isoDate`): `string`

The Daily Protocol seed for a UTC date, `YYYY-MM-DD`. Everyone playing on
the same UTC day gets the same seed, wherever they are. Pure: it takes the
date and never reads the clock. Throws on anything but a real date.

## Parameters

### isoDate

`string`

## Returns

`string`
