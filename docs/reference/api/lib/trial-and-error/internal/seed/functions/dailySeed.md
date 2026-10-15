[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/trial-and-error/internal/seed](../README.md) / dailySeed

# Function: dailySeed()

> **dailySeed**(`isoDate`): `string`

The Daily Protocol seed for a UTC date, `YYYY-MM-DD`. Everyone playing on
the same UTC day gets the same seed, wherever they are. Pure: it takes the
date and never reads the clock. Throws on anything but a real date.

The Daily Protocol is Trial & Error's Arcade Daily (#2113): its bytes are
drawn from the shared Arcade Daily key, which keeps the salt this function
always used, so every past and future daily link gives the same seed.

## Parameters

### isoDate

`string`

## Returns

`string`
