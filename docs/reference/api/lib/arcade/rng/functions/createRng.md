[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/arcade/rng](../README.md) / createRng

# Function: createRng()

> **createRng**(`seed`): [`SessionRng`](../interfaces/SessionRng.md)

A seeded Mulberry32 stream. The same seed always gives the same draws, and
`setState(getState())` on another stream continues the same sequence.

## Parameters

### seed

[`RngSeed`](../type-aliases/RngSeed.md)

The run's seed.

## Returns

[`SessionRng`](../interfaces/SessionRng.md)

The stream.
